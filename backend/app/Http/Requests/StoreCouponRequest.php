<?php

namespace App\Http\Requests;

use App\Models\Coupon;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class StoreCouponRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', Coupon::class);

        return true;
    }

    /** Kode dinormalkan (huruf besar, tanpa spasi pinggir) sebelum divalidasi. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    public function rules(): array
    {
        $max = $this->input('discount_type') === Coupon::TYPE_PERCENTAGE ? 100 : 100_000_000;

        return [
            // Unik termasuk kupon yang sudah dihapus (kodenya tetap tercadangkan).
            'code' => ['required', 'string', 'regex:/^[A-Z0-9_-]{3,30}$/', Rule::unique('coupons', 'code')],
            'name' => ['nullable', 'string', 'max:100'],
            'discount_type' => ['required', Rule::in(Coupon::TYPES)],
            'discount_value' => ['required', 'integer', 'min:1', "max:{$max}"],
            'usage_limit' => ['nullable', 'integer', 'min:1', 'max:10000000'],
            'course_id' => ['nullable', 'integer', Rule::exists('courses', 'id')->whereNull('deleted_at')],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.required' => 'Kode kupon wajib diisi.',
            'code.regex' => 'Kode kupon hanya boleh huruf besar, angka, "_" dan "-", sepanjang 3 sampai 30 karakter.',
            'code.unique' => 'Kode kupon sudah dipakai (termasuk oleh kupon yang sudah dihapus).',
            'name.max' => 'Nama kupon maksimal 100 karakter.',
            'discount_type.required' => 'Tipe diskon wajib dipilih.',
            'discount_type.in' => 'Tipe diskon tidak valid. Pilih Persentase atau Nominal Tetap.',
            'discount_value.required' => 'Nilai diskon wajib diisi.',
            'discount_value.integer' => 'Nilai diskon harus berupa bilangan bulat.',
            'discount_value.min' => 'Nilai diskon minimal 1.',
            'discount_value.max' => 'Nilai diskon terlalu besar (persentase maksimal 100).',
            'usage_limit.min' => 'Batas penggunaan minimal 1. Kosongkan bila tanpa batas.',
            'usage_limit.max' => 'Batas penggunaan terlalu besar.',
            'course_id.exists' => 'Kursus tidak ditemukan.',
            'expires_at.after' => 'Tanggal kedaluwarsa harus setelah saat ini.',
            'expires_at.date' => 'Tanggal kedaluwarsa tidak valid.',
        ];
    }
}
