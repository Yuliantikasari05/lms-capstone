<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Models\Role;
use App\Rules\ActiveMentor;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCourseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Course::class) ?? false;
    }

    private function canAssignMentor(): bool
    {
        return $this->user()?->hasPermission('courses.assign_mentor') ?? false;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(Course::CREATABLE_TYPES)],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            // Kursus baru boleh langsung aktif bila sudah punya Mentor.
            'status' => ['nullable', Rule::in([Course::STATUS_DRAFT, Course::STATUS_ACTIVE])],
            // Hanya yang berizin (Admin) yang menunjuk Mentor. Mentor yang membuat kursus otomatis menjadi pengampunya.
            'mentor_id' => $this->canAssignMentor() ? ['nullable', 'integer', new ActiveMentor] : ['prohibited'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            $hasMentor = filled($this->input('mentor_id'))
                || (! $this->canAssignMentor() && $this->user()?->hasRole(Role::MENTOR));

            if ($this->input('status') === Course::STATUS_ACTIVE && ! $hasMentor) {
                $validator->errors()->add('mentor_id', 'Kursus harus memiliki Mentor sebelum diaktifkan.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'type.required' => 'Jenis kursus wajib dipilih.',
            'type.in' => 'Jenis kursus tidak valid. Pilih Akademik, Pelatihan, atau Webinar (Program Lembaga dibuat oleh Lembaga).',
            'title.required' => 'Judul kursus wajib diisi.',
            'title.max' => 'Judul kursus maksimal 150 karakter.',
            'description.max' => 'Deskripsi maksimal 5000 karakter.',
            'status.in' => 'Status awal hanya boleh Draf atau Aktif.',
            'mentor_id.prohibited' => 'Anda tidak dapat menunjuk Mentor. Kursus yang Anda buat otomatis Anda ampu.',
            'mentor_id.integer' => 'Mentor tidak valid.',
        ];
    }
}
