<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProgramPricingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('lembaga.pricing.update') ?? false;
    }

    public function rules(): array
    {
        return [
            'price' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'discount_price' => ['nullable', 'integer', 'min:0', 'max:1000000000', 'lte:price'],
        ];
    }

    public function messages(): array
    {
        return [
            'price.required' => 'Harga normal wajib diisi.',
            'price.min' => 'Harga tidak boleh negatif.',
            'discount_price.lte' => 'Harga diskon tidak boleh lebih besar dari harga normal.',
        ];
    }
}
