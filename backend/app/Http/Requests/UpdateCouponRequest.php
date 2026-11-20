<?php

namespace App\Http\Requests;

use App\Models\Coupon;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class UpdateCouponRequest extends FormRequest
{
    private function coupon(): Coupon
    {
        return $this->route('coupon');
    }

    public function authorize(): bool
    {
        Gate::authorize('update', $this->coupon());

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $type = $this->input('discount_type', $this->coupon()->discount_type);
        $max = $type === Coupon::TYPE_PERCENTAGE ? 100 : 100_000_000;

        return [
            'code' => ['sometimes', 'required', 'string', 'regex:/^[A-Z0-9_-]{3,30}$/', Rule::unique('coupons', 'code')->ignore($this->coupon())],
            'name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'discount_type' => ['sometimes', 'required', Rule::in(Coupon::TYPES)],
            'discount_value' => ['sometimes', 'required', 'integer', 'min:1', "max:{$max}"],
            'usage_limit' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:10000000'],
            'course_id' => ['sometimes', 'nullable', 'integer', Rule::exists('courses', 'id')->whereNull('deleted_at')],
            // Saat mengubah, tanggal lampau diizinkan (mis. memperbaiki kupon yang sudah kedaluwarsa).
            'expires_at' => ['sometimes', 'nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** @return array<int, callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator) {
            $coupon = $this->coupon();
            $used = $coupon->usedCount();

            // Kode yang sudah pernah dipakai tidak boleh berubah (riwayat pemakaian merujuk ke kode itu).
            if ($this->has('code') && $this->input('code') !== $coupon->code && $used > 0) {
                $validator->errors()->add('code', 'Kode kupon tidak dapat diubah karena sudah pernah dipakai.');
            }

            // Batas penggunaan tidak boleh di bawah jumlah pemakaian yang sudah terjadi.
            $limit = $this->input('usage_limit');
            if ($this->has('usage_limit') && $limit !== null && (int) $limit < $used) {
                $validator->errors()->add('usage_limit', "Batas penggunaan tidak boleh kurang dari jumlah pemakaian ({$used}).");
            }
        }];
    }

    public function messages(): array
    {
        return (new StoreCouponRequest)->messages();
    }
}
