<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Role;
use App\Models\User;
use App\Notifications\LearningNotification;
use App\Services\StudentLearningService;
use App\Services\XpService;
use App\Support\Notifications\NotificationRecipients;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Tugas dan evaluasi Siswa (FR-41, FR-48).
 *
 * Hanya tugas/kuis/ujian berstatus disetujui & aktif pada kursus yang diikuti.
 * Kunci jawaban tidak pernah dikirim ke peserta.
 */
class StudentAssignmentController extends Controller
{
    public function index(Request $request, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $assignments = $learning->availableAssignments($student)
            ->orderByDesc('due_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Assignment $assignment) => [
                'id' => $assignment->id,
                'title' => $assignment->title,
                'description' => $assignment->description,
                'kind' => $assignment->kind,
                'kind_label' => $assignment->kindLabel(),
                'course_id' => $assignment->course_id,
                'course_title' => $assignment->course?->title,
                'mentor_name' => $assignment->course?->mentor?->name,
                'starts_at' => $assignment->starts_at?->toIso8601String(),
                'due_at' => $assignment->due_at?->toIso8601String(),
                'allow_late' => $assignment->allow_late,
                'xp_points' => (int) $assignment->xp_points,
                'max_score' => $assignment->max_score,
                'questions_count' => $assignment->questions_count,
                'submission' => $learning->submissionState($student, $assignment),
            ])
            ->values();

        return response()->json(['data' => $assignments, 'meta' => ['total' => $assignments->count()]]);
    }

    public function show(Request $request, Assignment $assignment, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        abort_unless(
            $learning->availableAssignments($student)->whereKey($assignment->id)->exists(),
            403,
            'Tugas ini tidak tersedia untuk Anda.',
        );

        $assignment->load(['course.mentor', 'questions']);
        $submission = AssignmentSubmission::query()
            ->where('assignment_id', $assignment->id)
            ->where('user_id', $student->id)
            ->with('answers')
            ->first();
        // Status disamakan dengan daftar tugas (selesai/dikumpulkan), bukan status mentah tabel.
        $state = $learning->submissionState($student, $assignment);

        return response()->json(['data' => [
            'id' => $assignment->id,
            'title' => $assignment->title,
            'description' => $assignment->description,
            'kind' => $assignment->kind,
            'kind_label' => $assignment->kindLabel(),
            'course_id' => $assignment->course_id,
            'course_title' => $assignment->course?->title,
            'mentor_name' => $assignment->course?->mentor?->name,
            'starts_at' => $assignment->starts_at?->toIso8601String(),
            'due_at' => $assignment->due_at?->toIso8601String(),
            'allow_late' => $assignment->allow_late,
            'late_penalty' => $assignment->late_penalty,
            'max_score' => $assignment->max_score,
            'xp_points' => (int) $assignment->xp_points,
            // Tanpa correct_option_ids: kunci jawaban tidak boleh sampai ke peserta.
            'questions' => $assignment->questions->map(fn ($question) => [
                'id' => $question->id,
                'type' => $question->type,
                'type_label' => $question->typeLabel(),
                'prompt' => $question->prompt,
                'options' => $question->options ?? [],
                'multi_select' => $question->multi_select,
                'max_words' => $question->max_words,
                'points' => $question->points,
                'position' => $question->position,
            ])->values(),
            'submission' => $submission === null ? null : [
                'id' => $submission->id,
                'submitted_at' => $submission->submitted_at?->toIso8601String(),
                'status' => $state['status'],
                'status_label' => $state['label'],
                'score' => $state['score'],
                'is_late' => $state['is_late'],
                'feedback' => $state['feedback'],
                'answers' => $submission->answers->map(fn ($answer) => [
                    'question_id' => $answer->question_id,
                    'answer_text' => $answer->answer_text,
                    'selected_option_ids' => $answer->selected_option_ids ?? [],
                    'points_awarded' => $answer->points_awarded,
                ])->values(),
            ],
        ]]);
    }

    /** Mengumpulkan jawaban peserta. XP tugas/kuis diberikan sekali saat pengumpulan. */
    public function submit(Request $request, Assignment $assignment, StudentLearningService $learning, XpService $xp): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        abort_unless(
            $learning->availableAssignments($student)->whereKey($assignment->id)->exists(),
            403,
            'Tugas ini tidak tersedia untuk Anda.',
        );

        $assignment->load('questions');
        $now = now();

        if ($assignment->starts_at !== null && $now->lt($assignment->starts_at)) {
            abort(422, 'Tugas ini belum dibuka.');
        }
        if ($assignment->due_at !== null && $now->gt($assignment->due_at) && ! $assignment->allow_late) {
            abort(422, 'Tenggat pengumpulan sudah lewat.');
        }
        if (AssignmentSubmission::query()->where('assignment_id', $assignment->id)->where('user_id', $student->id)->exists()) {
            abort(422, 'Anda sudah mengumpulkan tugas ini.');
        }

        $validated = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question_id' => ['required', 'integer'],
            'answers.*.answer_text' => ['nullable', 'string', 'max:5000'],
            'answers.*.selected_option_ids' => ['nullable', 'array'],
            'answers.*.selected_option_ids.*' => ['integer'],
        ]);

        $questions = $assignment->questions->keyBy('id');
        $answers = collect($validated['answers'])->keyBy('question_id');

        foreach ($answers as $questionId => $answer) {
            if (! $questions->has($questionId)) {
                throw ValidationException::withMessages(['answers' => 'Ada jawaban untuk soal yang bukan bagian tugas ini.']);
            }
        }

        foreach ($questions as $question) {
            $answer = $answers->get($question->id);
            $selected = array_map('intval', $answer['selected_option_ids'] ?? []);
            $text = trim((string) ($answer['answer_text'] ?? ''));

            if ($question->type === 'multiple_choice') {
                $optionIds = collect($question->options ?? [])->pluck('id')->map(fn ($id) => (int) $id)->all();
                if ($selected === []) {
                    throw ValidationException::withMessages(['answers' => "Soal nomor {$question->position} belum dijawab."]);
                }
                if (array_diff($selected, $optionIds) !== []) {
                    throw ValidationException::withMessages(['answers' => "Pilihan jawaban soal nomor {$question->position} tidak valid."]);
                }
                if (! $question->multi_select && count($selected) > 1) {
                    throw ValidationException::withMessages(['answers' => "Soal nomor {$question->position} hanya boleh satu jawaban."]);
                }
            }

            if ($question->type === 'essay') {
                if ($text === '') {
                    throw ValidationException::withMessages(['answers' => "Soal nomor {$question->position} belum dijawab."]);
                }
                if ($question->max_words !== null && str_word_count($text) > $question->max_words) {
                    throw ValidationException::withMessages(['answers' => "Jawaban soal nomor {$question->position} melebihi {$question->max_words} kata."]);
                }
            }

            if ($question->type === 'file_upload') {
                throw ValidationException::withMessages(['answers' => 'Soal unggah berkas belum didukung pada versi ini. Hubungi Mentor Anda.']);
            }
        }

        $submission = DB::transaction(function () use ($assignment, $student, $questions, $answers, $now) {
            $submission = AssignmentSubmission::query()->create([
                'assignment_id' => $assignment->id,
                'user_id' => $student->id,
                'submitted_at' => $now,
                'status' => AssignmentSubmission::STATUS_SUBMITTED,
            ]);

            foreach ($questions as $question) {
                $answer = $answers->get($question->id);
                $selected = array_map('intval', $answer['selected_option_ids'] ?? []);
                $text = trim((string) ($answer['answer_text'] ?? ''));

                $correctIds = array_map('intval', $question->correct_option_ids ?? []);
                sort($selected);
                sort($correctIds);
                $autoPoints = $question->type === 'multiple_choice' && $selected === $correctIds ? (int) $question->points : null;

                $submission->answers()->create([
                    'question_id' => $question->id,
                    'answer_text' => $question->type === 'essay' ? $text : null,
                    'selected_option_ids' => $question->type === 'multiple_choice' ? $selected : [],
                    'points_awarded' => $autoPoints,
                ]);
            }

            return $submission;
        });

        if (in_array($assignment->kind, [Assignment::KIND_TASK, Assignment::KIND_QUIZ], true) && $assignment->xp_points > 0) {
            // Idempoten: satu tugas hanya memberi XP sekali.
            $xp->award($student, (int) $assignment->xp_points, XpService::SOURCE_TASK, $assignment->id, 'Mengumpulkan '.$assignment->kindLabel().': '.$assignment->title);
        }

        $this->notifyMentor($assignment, $student);

        return response()->json([
            'data' => [
                'id' => $submission->id,
                'submitted_at' => $submission->submitted_at?->toIso8601String(),
                'status' => $submission->status,
            ],
            'message' => $assignment->due_at !== null && $now->gt($assignment->due_at)
                ? 'Tugas dikumpulkan setelah tenggat.'
                : 'Tugas berhasil dikumpulkan.',
        ], 201);
    }

    /** Beri tahu Mentor pengampu bahwa ada pengumpulan yang perlu dinilai (bila izin menilainya ada). */
    private function notifyMentor(Assignment $assignment, User $student): void
    {
        $course = $assignment->course;
        if ($course === null) {
            return;
        }

        $mentor = NotificationRecipients::courseMentor($course, 'assignments.grade', $student);
        if ($mentor === null) {
            return;
        }

        $mentor->notify(new LearningNotification(
            LearningNotification::CATEGORY_SUBMISSION,
            'Tugas menunggu penilaian: '.$assignment->title,
            $student->name.' mengumpulkan '.$assignment->title.' untuk '.$course->title.'. Buka daftar pengumpulan untuk memberi nilai.',
            $student->name,
            $student->roles->first()?->name ?? 'Siswa',
            'Beri penilaian',
            '/mentor/assignments',
        ));
    }
}
