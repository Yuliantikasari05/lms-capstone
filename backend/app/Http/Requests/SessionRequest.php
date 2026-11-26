<?php

namespace App\Http\Requests;

use App\Models\ClassSession;
use App\Models\Course;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Tambah (POST /courses/{course}/sessions) dan ubah (PATCH /sessions/{session}) sesi. */
class SessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $session = $this->route('session');
        $course = $this->route('course') ?? $session?->course;

        if ($course instanceof Course && $course->trashed()) {
            abort(404);
        }

        Gate::authorize('manageContent', $course);

        return true;
    }

    private function isUpdate(): bool
    {
        return $this->route('session') instanceof ClassSession;
    }

    public function rules(): array
    {
        $sometimes = $this->isUpdate() ? ['sometimes'] : [];
        $session = $this->route('session');
        // Mode default online agar permintaan lama (tanpa field mode) tetap berperilaku sama.
        $mode = $this->input('mode', $session instanceof ClassSession ? $session->mode : ClassSession::MODE_ONLINE);

        return [
            'title' => [...$sometimes, 'required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'starts_at' => [...$sometimes, 'required', 'date'],
            'ends_at' => [...$sometimes, 'required', 'date'],
            'mode' => [...$sometimes, Rule::in(ClassSession::MODES)],
            'location' => ['nullable', 'string', 'max:200'],
            'status' => [...$sometimes, Rule::in(ClassSession::STATUSES)],
            'cancellation_reason' => [
                'nullable', 'string', 'max:500',
                Rule::requiredIf(fn () => $this->input('status') === ClassSession::STATUS_CANCELLED && ! $this->route('session')?->cancellation_reason),
            ],
            // Sesi Offline tidak punya tautan meeting. Sesi Online wajib memilikinya dan hanya
            // boleh http/https (bukan javascript:, ftp:, dst).
            'meeting_url' => $mode === ClassSession::MODE_OFFLINE
                ? ['nullable', 'string', 'url:http,https', 'max:2048']
                : [...$sometimes, 'required', 'string', 'url:http,https', 'max:2048'],
        ];
    }

    /** @return array<int, callable(\Illuminate\Contracts\Validation\Validator): void> */
    public function after(): array
    {
        return [function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $session = $this->route('session');
            $start = $this->filled('starts_at') ? $this->moment($this->input('starts_at')) : $session?->starts_at;
            $end = $this->filled('ends_at') ? $this->moment($this->input('ends_at')) : $session?->ends_at;

            if ($start && $end && $end->lessThanOrEqualTo($start)) {
                $validator->errors()->add('ends_at', 'Waktu selesai harus setelah waktu mulai.');
            }
        }];
    }

    /**
     * Waktu dari browser sering memakai offset lain (mis. "...Z" = UTC). Dikonversi ke zona waktu aplikasi
     * (Asia/Jakarta) sebelum disimpan, supaya jam sesi tidak bergeser.
     */
    public function validated($key = null, $default = null)
    {
        $data = parent::validated();

        foreach (['starts_at', 'ends_at'] as $field) {
            if (isset($data[$field])) {
                $data[$field] = $this->moment($data[$field]);
            }
        }

        return $key === null ? $data : data_get($data, $key, $default);
    }

    private function moment(string $value): CarbonImmutable
    {
        return CarbonImmutable::parse($value)->setTimezone(config('app.timezone'));
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul sesi wajib diisi.',
            'title.max' => 'Judul sesi maksimal 150 karakter.',
            'description.max' => 'Deskripsi sesi maksimal 500 karakter.',
            'starts_at.required' => 'Waktu mulai wajib diisi.',
            'starts_at.date' => 'Waktu mulai tidak valid.',
            'ends_at.required' => 'Waktu selesai wajib diisi.',
            'ends_at.date' => 'Waktu selesai tidak valid.',
            'meeting_url.required' => 'Link meeting wajib diisi untuk sesi Online.',
            'meeting_url.url' => 'Link meeting harus diawali http:// atau https://.',
            'mode.in' => 'Mode sesi tidak dikenal.',
            'status.in' => 'Status sesi tidak dikenal.',
            'location.max' => 'Lokasi maksimal 200 karakter.',
            'cancellation_reason.max' => 'Alasan pembatalan maksimal 500 karakter.',
            'cancellation_reason.required' => 'Alasan pembatalan wajib diisi.',
        ];
    }
}
