<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', User::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) {
            $this->merge(['email' => mb_strtolower(trim($this->email))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            // Admin tidak memilih kata sandi: sistem membuat kata sandi sementara (wajib diganti saat login pertama).
            'password' => ['prohibited'],
            'role' => ['required', 'string', 'exists:roles,slug'],
            'status' => ['nullable', Rule::in(User::STATUSES)],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama wajib diisi.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'email.unique' => 'Email sudah terdaftar (termasuk akun yang sudah dihapus; pulihkan dari tab Dihapus).',
            'password.prohibited' => 'Kata sandi tidak diatur oleh Admin. Sistem membuat kata sandi sementara otomatis.',
            'role.required' => 'Role wajib dipilih.',
            'role.exists' => 'Role tidak dikenal.',
            'status.in' => 'Status tidak valid.',
        ];
    }
}
