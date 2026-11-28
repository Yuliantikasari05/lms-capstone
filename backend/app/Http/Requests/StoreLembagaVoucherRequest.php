<?php

namespace App\Http\Requests;

use App\Models\Coupon;
use App\Models\Course;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLembagaVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('lembaga.vouchers.create') ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('coupons', 'code')],
            'discount_type' => ['required', Rule::in(Coupon::TYPES)],
            'discount_value' => ['required', 'integer', 'min:1', 'max:1000000000',
                Rule::when($this->input('discount_type') === Coupon::TYPE_PERCENTAGE, ['max:100'])],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'course_id' => ['nullable', 'integer', Rule::exists('courses', 'id')->where(
                fn ($query) => $query
                    ->where('type', Course::TYPE_INSTITUTION)
                    ->where('created_by', $this->user()?->id)
                    ->whereNull('deleted_at'),
            )],
            'expires_at' => ['required', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama voucher wajib diisi.',
            'code.required' => 'Kode voucher wajib diisi.',
            'code.unique' => 'Kode voucher sudah dipakai. Pilih kode lain.',
            'code.regex' => 'Kode voucher hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.',
            'discount_type.in' => 'Jenis diskon tidak valid.',
            'discount_value.max' => 'Diskon persentase maksimal 100%.',
            'course_id.exists' => 'Program yang dipilih bukan program lembaga Anda.',
            'expires_at.required' => 'Tanggal kedaluwarsa wajib diisi.',
        ];
    }
}
