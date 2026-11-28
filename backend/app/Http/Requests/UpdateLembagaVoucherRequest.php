<?php

namespace App\Http\Requests;

use App\Models\Coupon;
use App\Models\Course;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLembagaVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('lembaga.vouchers.update') ?? false;
    }

    public function rules(): array
    {
        /** @var Coupon $coupon */
        $coupon = $this->route('coupon');
        $type = $this->input('discount_type', $coupon->discount_type);

        return [
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'code' => ['sometimes', 'required', 'string', 'max:30', 'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('coupons', 'code')->ignore($coupon->id)],
            'discount_type' => ['sometimes', Rule::in(Coupon::TYPES)],
            'discount_value' => ['sometimes', 'integer', 'min:1', 'max:1000000000',
                Rule::when($type === Coupon::TYPE_PERCENTAGE, ['max:100'])],
            'usage_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:1000000'],
            'course_id' => ['sometimes', 'nullable', 'integer', Rule::exists('courses', 'id')->where(
                fn ($query) => $query
                    ->where('type', Course::TYPE_INSTITUTION)
                    ->where('created_by', $this->user()?->id)
                    ->whereNull('deleted_at'),
            )],
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Kode voucher sudah dipakai. Pilih kode lain.',
            'code.regex' => 'Kode voucher hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah.',
            'discount_value.max' => 'Diskon persentase maksimal 100%.',
            'course_id.exists' => 'Program yang dipilih bukan program lembaga Anda.',
        ];
    }
}
