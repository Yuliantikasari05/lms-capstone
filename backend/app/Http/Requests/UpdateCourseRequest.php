<?php

namespace App\Http\Requests;

use App\Models\Course;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Gate::authorize melempar pengecualian dengan pesan dari Policy (mis. "Program Lembaga hanya dapat diubah...").
        Gate::authorize('update', $this->route('course'));

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', Rule::in(Course::STATUSES)],
            // Jenis tidak dapat diubah (mengubahnya merusak aturan peserta dan XP). Mentor lewat endpoint tersendiri.
            'type' => ['prohibited'],
            'mentor_id' => ['prohibited'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            /** @var Course $course */
            $course = $this->route('course');

            if ($this->input('status') === Course::STATUS_ACTIVE && $course->requiresMentor() && $course->mentor_id === null) {
                $validator->errors()->add('status', 'Kursus harus memiliki Mentor sebelum diaktifkan.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul kursus wajib diisi.',
            'title.max' => 'Judul kursus maksimal 150 karakter.',
            'description.max' => 'Deskripsi maksimal 5000 karakter.',
            'status.in' => 'Status tidak valid.',
            'type.prohibited' => 'Jenis kursus tidak dapat diubah setelah dibuat.',
            'mentor_id.prohibited' => 'Mentor diganti lewat menu "Ganti Mentor", bukan dari form ubah.',
        ];
    }
}
