<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/** Mengajukan pencairan. "amount" kosong = seluruh saldo yang dapat dicairkan. */
class StorePayoutRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('managePayouts', $this->route('institution'));

        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['nullable', 'integer', 'min:1', 'max:100000000000'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.integer' => 'Jumlah pencairan harus berupa bilangan bulat (rupiah).',
            'amount.min' => 'Jumlah pencairan harus lebih dari 0.',
            'amount.max' => 'Jumlah pencairan terlalu besar.',
            'note.max' => 'Catatan maksimal 255 karakter.',
        ];
    }
}
