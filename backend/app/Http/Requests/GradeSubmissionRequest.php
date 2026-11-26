<?php

namespace App\Http\Requests;

use App\Models\AssignmentSubmission;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Menyimpan nilai dan feedback pengumpulan tugas. */
class GradeSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $submission = $this->route('submission');
        $course = $submission instanceof AssignmentSubmission ? $submission->assignment?->course : null;

        abort_if($course === null || $course->trashed(), 404);

        Gate::authorize('grade', $submission->assignment);

        return true;
    }

    public function rules(): array
    {
        return [
            'score' => ['required', 'integer', 'min:0', 'max:1000'],
            'feedback' => ['nullable', 'string', 'max:2000'],
            'reopen' => ['sometimes', 'boolean'],
            'answers' => ['sometimes', 'array'],
            'answers.*.question_id' => ['required_with:answers', 'integer'],
            'answers.*.points_awarded' => ['nullable', 'integer', 'min:0', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'score.required' => 'Nilai wajib diisi.',
            'score.integer' => 'Nilai harus berupa angka.',
            'score.min' => 'Nilai tidak boleh negatif.',
        ];
    }
}
