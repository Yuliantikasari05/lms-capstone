<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GradeSubmissionRequest;
use App\Http\Resources\AssignmentSubmissionResource;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AuditLog;
use App\Notifications\LearningNotification;
use Illuminate\Http\Request;
use App\Services\XpService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/** Pengumpulan tugas peserta dan penilaian oleh Mentor. */
class AssignmentSubmissionController extends Controller
{
    public function index(Request $request, Assignment $assignment)
    {
        Gate::authorize('grade', $assignment);

        $query = $assignment->submissions()
            ->with(['assignment.course', 'user', 'answers.question'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', (string) $request->input('status')));

        return AssignmentSubmissionResource::collection($query->paginate(100));
    }

    public function show(AssignmentSubmission $submission): AssignmentSubmissionResource
    {
        $submission->load(['assignment.course', 'user', 'answers.question']);
        abort_if($submission->assignment === null || $submission->assignment->course === null, 404);

        Gate::authorize('grade', $submission->assignment);

        return new AssignmentSubmissionResource($submission);
    }

    /** Menyimpan nilai dan feedback. */
    public function grade(GradeSubmissionRequest $request, AssignmentSubmission $submission, XpService $xp): AssignmentSubmissionResource
    {
        $validated = $request->validated();

        DB::transaction(function () use ($submission, $validated, $request) {
            $submission->fill([
                'score' => $validated['score'],
                'feedback' => $validated['feedback'] ?? null,
                'status' => AssignmentSubmission::STATUS_GRADED,
                'graded_by' => $request->user()->id,
                'graded_at' => now(),
            ])->save();

            foreach ($validated['answers'] ?? [] as $answer) {
                $submission->answers()
                    ->where('question_id', $answer['question_id'])
                    ->update(['points_awarded' => $answer['points_awarded'] ?? null]);
            }

            AuditLog::record('submission.graded', $submission, [
                'assignment_id' => $submission->assignment_id,
                'score' => $submission->score,
            ], $request);
        });

        // XP ujian baru diberikan setelah dinilai (tugas/kuis sudah diberi saat pengumpulan).
        $assignment = $submission->assignment;
        if ($assignment !== null
            && $assignment->kind === Assignment::KIND_EXAM
            && $assignment->xp_points > 0
            && $submission->user !== null) {
            $xp->award($submission->user, (int) $assignment->xp_points, XpService::SOURCE_EXAM, $assignment->id, 'Ujian dinilai: '.$assignment->title);
        }

        // Beri tahu peserta bahwa hasilnya sudah dinilai (notifikasi dalam aplikasi).
        if ($assignment !== null && $submission->user !== null) {
            $submission->user->notify(new LearningNotification(
                LearningNotification::CATEGORY_ASSESSMENT,
                'Tugas sudah dinilai: '.$assignment->title,
                'Nilaimu '.$submission->score.' untuk '.$assignment->title.'. Buka detail tugas untuk membaca feedback Mentor.',
                $request->user()->name,
                $request->user()->roles->first()?->name ?? 'Mentor',
                'Lihat nilai',
                '/siswa/assignments',
            ));
        }

        return new AssignmentSubmissionResource($submission->load(['assignment.course', 'user', 'answers.question']));
    }
}
