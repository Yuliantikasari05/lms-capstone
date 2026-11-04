<?php

namespace App\Http\Requests;

use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Material;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Tambah materi (multipart/form-data bila ada file). Aturan mengikuti tipe:
 * link = URL wajib; pdf/dokumen = file wajib; video = file ATAU URL (tepat salah satu).
 * Isi file diperiksa dari isinya (bukan sekadar ekstensi), dan hanya jenis yang diizinkan yang diterima.
 */
class StoreMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        $course = $this->course();

        if ($course->trashed()) {
            abort(404);
        }

        Gate::authorize('manageContent', $course);

        return true;
    }

    private function course(): Course
    {
        /** @var CourseModule $module */
        $module = $this->route('module');

        return $module->course;
    }

    public function rules(): array
    {
        $max = (int) config('lms.uploads.max_kb', 51200);
        $type = $this->input('type');

        $file = match ($type) {
            Material::TYPE_PDF => ['required', 'file', 'mimes:pdf', "max:{$max}"],
            Material::TYPE_DOCUMENT => ['required', 'file', 'mimes:doc,docx,ppt,pptx,xls,xlsx,txt,csv', "max:{$max}"],
            Material::TYPE_VIDEO => ['nullable', 'file', 'mimes:mp4,webm', "max:{$max}"],
            default => ['prohibited'],
        };

        $url = match ($type) {
            Material::TYPE_LINK => ['required', 'string', 'url:http,https', 'max:2048'],
            Material::TYPE_VIDEO => ['nullable', 'string', 'url:http,https', 'max:2048'],
            default => ['prohibited'],
        };

        return [
            'type' => ['required', Rule::in(Material::TYPES)],
            'title' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:5000'],
            'file' => $file,
            'external_url' => $url,
            'duration_minutes' => $type === Material::TYPE_VIDEO ? ['nullable', 'integer', 'min:1', 'max:1440'] : ['prohibited'],
            'xp_points' => ['nullable', 'integer', 'min:0', 'max:100'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($this->input('type') === Material::TYPE_VIDEO) {
                $hasFile = $this->hasFile('file');
                $hasUrl = filled($this->input('external_url'));

                if (! $hasFile && ! $hasUrl) {
                    $validator->errors()->add('file', 'Video harus berupa file unggahan atau tautan.');
                } elseif ($hasFile && $hasUrl) {
                    $validator->errors()->add('file', 'Pilih salah satu: file unggahan atau tautan video, bukan keduanya.');
                }
            }

            if ((int) $this->input('xp_points', 0) > 0 && ! $this->course()->allowsXp()) {
                $validator->errors()->add('xp_points', 'Kursus Pelatihan dan Webinar tidak memakai XP.');
            }
        }];
    }

    public function messages(): array
    {
        $max = (int) config('lms.uploads.max_kb', 51200);

        return [
            'type.required' => 'Tipe materi wajib dipilih.',
            'type.in' => 'Tipe materi tidak valid.',
            'title.required' => 'Judul materi wajib diisi.',
            'title.max' => 'Judul materi maksimal 150 karakter.',
            'file.required' => 'File wajib diunggah.',
            'file.mimes' => 'Jenis file tidak diizinkan untuk tipe materi ini.',
            'file.max' => 'Ukuran file maksimal '.round($max / 1024, 1).' MB.',
            'file.uploaded' => 'File gagal diunggah. Periksa batas ukuran upload server.',
            'file.prohibited' => 'Tipe materi ini tidak memakai file.',
            'external_url.required' => 'Tautan wajib diisi.',
            'external_url.url' => 'Tautan harus diawali http:// atau https://.',
            'external_url.prohibited' => 'Tipe materi ini tidak memakai tautan.',
            'duration_minutes.prohibited' => 'Durasi hanya untuk materi video.',
            'xp_points.max' => 'XP maksimal 100.',
        ];
    }
}
