<?php

namespace App\Http\Requests;

use App\Models\InstitutionPayout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Menyelesaikan atau membatalkan pencairan yang masih menunggu. */
class UpdatePayoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('managePayouts', $this->route('institution'));

        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([InstitutionPayout::STATUS_COMPLETED, InstitutionPayout::STATUS_CANCELLED])],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => 'Status wajib diisi.',
            'status.in' => 'Status harus "completed" (selesai) atau "cancelled" (dibatalkan).',
            'note.max' => 'Catatan maksimal 255 karakter.',
        ];
    }
}
