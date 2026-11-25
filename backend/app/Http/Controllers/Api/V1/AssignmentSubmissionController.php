<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GradeSubmissionRequest;
use App\Http\Resources\AssignmentSubmissionResource;
use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\AuditLog;
use Illuminate\Http\Request;
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
    public function grade(GradeSubmissionRequest $request, AssignmentSubmission $submission): AssignmentSubmissionResource
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

        return new AssignmentSubmissionResource($submission->load(['assignment.course', 'user', 'answers.question']));
    }
}
