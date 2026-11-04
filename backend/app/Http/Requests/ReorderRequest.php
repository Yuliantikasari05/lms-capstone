<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Models\CourseModule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Urutan baru modul dalam sebuah kursus (PUT /courses/{course}/modules/order)
 * atau materi dalam sebuah modul (PUT /modules/{module}/materials/order).
 * Daftar id harus memuat semua item tepat satu kali.
 */
class ReorderRequest extends FormRequest
{
    public function authorize(): bool
    {
        $module = $this->route('module');
        $course = $this->route('course') ?? $module?->course;

        if ($course instanceof Course && $course->trashed()) {
            abort(404);
        }

        Gate::authorize('manageContent', $course);

        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'distinct'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $module = $this->route('module');
            $existing = $module instanceof CourseModule
                ? $module->materials()->pluck('id')
                : $this->route('course')->modules()->pluck('id');

            $given = collect($this->input('ids'))->map(fn ($id) => (int) $id)->sort()->values();

            if ($given->all() !== $existing->sort()->values()->all()) {
                $validator->errors()->add('ids', 'Daftar urutan harus memuat semua item tepat satu kali.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'ids.required' => 'Daftar urutan wajib dikirim.',
            'ids.array' => 'Daftar urutan tidak valid.',
            'ids.*.distinct' => 'Daftar urutan memuat item ganda.',
        ];
    }
}
