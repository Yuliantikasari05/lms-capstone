<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Koreksi XP oleh Admin. Otorisasi lewat middleware permission:gamification.manage pada rute. */
class AdjustXpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'integer', 'not_in:0', 'between:-1000000,1000000'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.required' => 'Jumlah XP wajib diisi.',
            'amount.integer' => 'Jumlah XP harus berupa bilangan bulat.',
            'amount.not_in' => 'Jumlah koreksi tidak boleh 0.',
            'amount.between' => 'Jumlah koreksi maksimal 1.000.000 XP.',
            'reason.required' => 'Alasan koreksi wajib diisi.',
            'reason.min' => 'Alasan koreksi minimal 3 karakter.',
            'reason.max' => 'Alasan koreksi maksimal 255 karakter.',
        ];
    }
}
