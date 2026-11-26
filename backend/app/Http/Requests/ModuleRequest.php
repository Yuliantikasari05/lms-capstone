<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Models\CourseModule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/** Tambah (POST /courses/{course}/modules) dan ubah (PATCH /modules/{module}) judul modul. */
class ModuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $target = $this->route('course') ?? $this->route('module')?->course;

        if ($target instanceof Course && $target->trashed()) {
            abort(404);
        }

        Gate::authorize('manageContent', $target);

        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul modul wajib diisi.',
            'title.max' => 'Judul modul maksimal 150 karakter.',
            'description.max' => 'Deskripsi modul maksimal 500 karakter.',
        ];
    }
}
