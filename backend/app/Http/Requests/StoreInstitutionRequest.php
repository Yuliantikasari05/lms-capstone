<?php

namespace App\Http\Requests;

use App\Models\Institution;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Membuat lembaga sekaligus akunnya (kata sandi sementara dibuat sistem). */
class StoreInstitutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', Institution::class);

        return true;
    }

    protected function prepareForValidation(): void
    {
        $merge = [];
        if (is_string($this->input('email'))) {
            $merge['email'] = mb_strtolower(trim($this->input('email')));
        }
        if (is_string($this->input('name'))) {
            $merge['name'] = trim($this->input('name'));
        }
        if (is_string($this->input('bank_account_number'))) {
            // Spasi dan tanda hubung pada nomor rekening dibuang.
            $merge['bank_account_number'] = preg_replace('/[\s-]+/', '', $this->input('bank_account_number'));
        }

        $this->merge($merge);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150', self::uniqueName()],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            // Admin tidak memilih kata sandi: sistem membuat kata sandi sementara.
            'password' => ['prohibited'],
            'description' => ['nullable', 'string', 'max:1000'],
            'phone' => ['nullable', 'string', 'regex:/^[0-9+()\-\s]{6,30}$/'],
            'address' => ['nullable', 'string', 'max:500'],
            'revenue_share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'bank_name' => ['nullable', 'string', 'max:50', 'required_with:bank_account_holder,bank_account_number'],
            'bank_account_holder' => ['nullable', 'string', 'max:100', 'required_with:bank_name,bank_account_number'],
            'bank_account_number' => ['nullable', 'string', 'regex:/^[0-9]{5,30}$/', 'required_with:bank_name,bank_account_holder'],
            'status' => ['nullable', Rule::in(User::STATUSES)],
        ];
    }

    /** Nama lembaga unik tanpa membedakan huruf besar-kecil (di antara lembaga yang belum dihapus). */
    public static function uniqueName(?int $ignoreId = null): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($ignoreId) {
            $exists = Institution::query()
                ->whereRaw('lower(name) = ?', [mb_strtolower((string) $value)])
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists();

            if ($exists) {
                $fail('Nama lembaga sudah terdaftar.');
            }
        };
    }

    public function messages(): array
    {
        return self::sharedMessages();
    }

    /** @return array<string,string> */
    public static function sharedMessages(): array
    {
        return [
            'name.required' => 'Nama lembaga wajib diisi.',
            'name.max' => 'Nama lembaga maksimal 150 karakter.',
            'email.required' => 'Email akun lembaga wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah terdaftar (termasuk akun yang sudah dihapus).',
            'password.prohibited' => 'Kata sandi tidak diatur oleh Admin. Sistem membuat kata sandi sementara otomatis.',
            'description.max' => 'Deskripsi maksimal 1000 karakter.',
            'phone.regex' => 'Nomor telepon hanya boleh angka, spasi, "+", "-", "(" dan ")", sepanjang 6 sampai 30 karakter.',
            'address.max' => 'Alamat maksimal 500 karakter.',
            'revenue_share_percent.required' => 'Persentase bagi hasil lembaga wajib diisi.',
            'revenue_share_percent.integer' => 'Persentase bagi hasil harus berupa bilangan bulat.',
            'revenue_share_percent.min' => 'Persentase bagi hasil minimal 1.',
            'revenue_share_percent.max' => 'Persentase bagi hasil maksimal 100.',
            'bank_name.required_with' => 'Nama bank wajib diisi bila data rekening diisi.',
            'bank_account_holder.required_with' => 'Nama pemilik rekening wajib diisi bila data rekening diisi.',
            'bank_account_number.required_with' => 'Nomor rekening wajib diisi bila data rekening diisi.',
            'bank_account_number.regex' => 'Nomor rekening hanya boleh angka, sepanjang 5 sampai 30 digit.',
            'status.in' => 'Status tidak valid.',
        ];
    }
}
