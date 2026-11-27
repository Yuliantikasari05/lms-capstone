<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignmentRequest;
use App\Http\Resources\AssignmentResource;
use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\User;
use App\Notifications\LearningNotification;
use App\Support\Notifications\NotificationRecipients;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;

/** Tugas, kuis, dan ujian: daftar, buat, ubah, hapus, aktif/nonaktif, dan review Admin. */
class AssignmentController extends Controller
{
    /** Daftar tugas dari kursus yang boleh dilihat pengguna (Mentor = kursus yang diampu). */
    public function index(Request $request)
    {
        $query = Assignment::query()
            ->with(['course', 'questions'])
            ->withCount(['questions', 'submissions'])
            ->whereHas('course', fn ($course) => $course->visibleTo($request->user()));

        if ($request->filled('course_id')) {
            $query->where('course_id', $request->integer('course_id'));
        }
        if ($request->filled('kind')) {
            $query->where('kind', (string) $request->input('kind'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }
        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->string('search').'%');
        }

        return AssignmentResource::collection(
            $query->latest('id')->paginate(min(100, max(1, $request->integer('per_page', 100)))),
        );
    }

    public function show(Assignment $assignment): AssignmentResource
    {
        Gate::authorize('view', $assignment);

        return new AssignmentResource(
            $assignment->load(['course', 'questions'])->loadCount(['questions', 'submissions']),
        );
    }

    public function store(AssignmentRequest $request, Course $course): JsonResponse
    {
        $data = $request->validated();
        $questions = $data['questions'];
        unset($data['questions']);

        $assignment = DB::transaction(function () use ($data, $questions, $course, $request) {
            $assignment = new Assignment($data);
            $assignment->course_id = $course->id;
            $assignment->created_by = $request->user()->id;
            // Ujian harus disetujui Admin dulu; tugas dan kuis langsung tersedia.
            $assignment->status = $assignment->kind === Assignment::KIND_EXAM
                ? Assignment::STATUS_PENDING
                : Assignment::STATUS_APPROVED;
            $assignment->is_active = $data['is_active'] ?? true;
            $assignment->max_score ??= array_sum(array_map(fn ($question) => (int) ($question['points'] ?? 0), $questions));
            $assignment->save();

            $this->syncQuestions($assignment, $questions);

            AuditLog::record('assignment.created', $assignment, ['course_id' => $course->id], $request);

            return $assignment;
        });

        $this->notifyReviewers($assignment, $course, $request->user());

        return (new AssignmentResource($assignment->load(['course', 'questions'])->loadCount(['questions', 'submissions'])))
            ->additional(['message' => 'Tugas berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(AssignmentRequest $request, Assignment $assignment): AssignmentResource
    {
        $data = $request->validated();
        $questions = $data['questions'] ?? null;
        unset($data['questions']);

        if ($questions !== null && $assignment->submissions()->exists()) {
            abort(response()->json([
                'message' => 'Soal tidak dapat diubah karena sudah ada pengumpulan.',
                'errors' => ['questions' => ['Soal tidak dapat diubah karena sudah ada pengumpulan.']],
            ], 422));
        }

        DB::transaction(function () use ($assignment, $data, $questions, $request) {
            $before = $assignment->only(['title', 'kind', 'status', 'is_active', 'due_at']);
            $assignment->fill($data);

            // Ujian yang diubah jenisnya kembali menunggu review Admin.
            if (array_key_exists('kind', $data) && $assignment->kind === Assignment::KIND_EXAM && $assignment->status === Assignment::STATUS_APPROVED) {
                $assignment->status = Assignment::STATUS_PENDING;
            }

            $assignment->save();

            if ($questions !== null) {
                $assignment->questions()->delete();
                $this->syncQuestions($assignment, $questions);
            }

            $after = $assignment->only(['title', 'kind', 'status', 'is_active', 'due_at']);
            if ($after !== $before) {
                AuditLog::record('assignment.updated', $assignment, ['course_id' => $assignment->course_id, 'before' => $before, 'after' => $after], $request);
            }
        });

        return new AssignmentResource($assignment->load(['course', 'questions'])->loadCount(['questions', 'submissions']));
    }

    public function destroy(Request $request, Assignment $assignment): JsonResponse
    {
        Gate::authorize('manage', $assignment);

        DB::transaction(function () use ($assignment, $request) {
            $assignment->delete();
            AuditLog::record('assignment.deleted', $assignment, ['course_id' => $assignment->course_id], $request);
        });

        return response()->json(['message' => 'Tugas berhasil dihapus.']);
    }

    /** Aktif/nonaktifkan tugas. Tugas yang belum disetujui Admin tidak dapat diaktifkan. */
    public function activation(Request $request, Assignment $assignment): AssignmentResource
    {
        Gate::authorize('manage', $assignment);

        $validated = $request->validate(
            ['is_active' => ['required', 'boolean']],
            ['is_active.required' => 'Status aktif wajib diisi.'],
        );

        if ($validated['is_active'] && $assignment->status !== Assignment::STATUS_APPROVED) {
            abort(response()->json([
                'message' => 'Tugas belum disetujui Admin sehingga tidak dapat diaktifkan.',
                'errors' => ['is_active' => ['Tugas belum disetujui Admin sehingga tidak dapat diaktifkan.']],
            ], 422));
        }

        $assignment->is_active = $validated['is_active'];
        $assignment->save();

        AuditLog::record('assignment.activation', $assignment, ['is_active' => $assignment->is_active], $request);

        return new AssignmentResource($assignment->load(['course', 'questions'])->loadCount(['questions', 'submissions']));
    }

    /** Persetujuan Admin atas ujian. */
    public function review(Request $request, Assignment $assignment): AssignmentResource
    {
        Gate::authorize('review', $assignment);

        $validated = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'decision.required' => 'Keputusan review wajib diisi.',
            'decision.in' => 'Keputusan review tidak dikenal.',
        ]);

        $approved = $validated['decision'] === 'approve';
        $assignment->status = $approved ? Assignment::STATUS_APPROVED : Assignment::STATUS_REJECTED;
        $assignment->review_note = $validated['note'] ?? null;
        $assignment->reviewed_by = $request->user()->id;
        $assignment->reviewed_at = now();
        $assignment->is_active = $approved;
        $assignment->save();

        AuditLog::record('assignment.reviewed', $assignment, ['status' => $assignment->status], $request);

        $this->notifyCreator($assignment, $request);

        return new AssignmentResource($assignment->load(['course', 'questions'])->loadCount(['questions', 'submissions']));
    }

    /** Ujian baru menunggu review: beri tahu pemegang izin review (Admin), bukan semua pengguna. */
    private function notifyReviewers(Assignment $assignment, Course $course, User $actor): void
    {
        if ($assignment->status !== Assignment::STATUS_PENDING) {
            return;
        }

        $reviewers = NotificationRecipients::withPermission('assignments.review', $actor);
        if ($reviewers->isEmpty()) {
            return;
        }

        Notification::send($reviewers, new LearningNotification(
            LearningNotification::CATEGORY_ASSESSMENT,
            'Ujian menunggu review: '.$assignment->title,
            $actor->name.' mengajukan ujian untuk '.$course->title.'. Tinjau soal sebelum dapat dipakai peserta.',
            $actor->name,
            $actor->roles->first()?->name ?? 'Mentor',
            'Review ujian',
            '/admin/courses',
        ));
    }

    /** Keputusan review Admin dikirim ke pembuat ujian (Mentor) agar tidak menebak hasilnya. */
    private function notifyCreator(Assignment $assignment, Request $request): void
    {
        $creator = $assignment->creator;
        if ($creator === null || $creator->is($request->user()) || ! $creator->isActive()) {
            return;
        }

        $approved = $assignment->status === Assignment::STATUS_APPROVED;
        $note = filled($assignment->review_note) ? ' Catatan Admin: '.$assignment->review_note : '';

        $creator->notify(new LearningNotification(
            LearningNotification::CATEGORY_ASSESSMENT,
            ($approved ? 'Ujian disetujui: ' : 'Ujian perlu diperbaiki: ').$assignment->title,
            ($approved
                ? 'Admin menyetujui ujian ini sehingga sudah dapat dipakai peserta.'
                : 'Admin menolak pengajuan ujian ini.').$note,
            $request->user()->name,
            $request->user()->roles->first()?->name ?? 'Admin',
            $approved ? 'Lihat tugas' : 'Lihat catatan',
            '/mentor/assignments',
        ));
    }

    /** @param array<int, array<string, mixed>> $questions */
    private function syncQuestions(Assignment $assignment, array $questions): void
    {
        foreach (array_values($questions) as $index => $question) {
            $assignment->questions()->create([
                'type' => $question['type'],
                'prompt' => $question['prompt'],
                'options' => $question['options'] ?? [],
                'correct_option_ids' => $question['correct_option_ids'] ?? [],
                'multi_select' => $question['multi_select'] ?? false,
                'max_words' => $question['max_words'] ?? null,
                'allowed_file_types' => $question['allowed_file_types'] ?? [],
                'max_file_size_mb' => $question['max_file_size_mb'] ?? null,
                'max_files' => $question['max_files'] ?? null,
                'points' => $question['points'] ?? 0,
                'position' => $index + 1,
            ]);
        }

        if ($assignment->max_score === null) {
            $assignment->max_score = $assignment->questions()->sum('points');
            $assignment->save();
        }
    }
}
