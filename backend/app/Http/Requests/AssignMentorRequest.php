<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Rules\ActiveMentor;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class AssignMentorRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('assignMentor', $this->route('course'));

        return true;
    }

    public function rules(): array
    {
        // "present": kunci wajib dikirim; nilai null = mencabut Mentor (hanya untuk kursus yang belum aktif).
        return [
            'mentor_id' => ['present', 'nullable', 'integer', new ActiveMentor],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var Course $course */
            $course = $this->route('course');

            if ($this->input('mentor_id') === null && $course->status === Course::STATUS_ACTIVE && $course->requiresMentor()) {
                $validator->errors()->add('mentor_id', 'Kursus yang aktif harus memiliki Mentor. Pilih Mentor pengganti atau nonaktifkan kursus dulu.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'mentor_id.present' => 'Mentor wajib dikirim (gunakan null untuk mencabut Mentor).',
            'mentor_id.integer' => 'Mentor tidak valid.',
        ];
    }
}
