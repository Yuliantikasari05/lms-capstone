<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('update', $this->route('user')) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->email)) {
            $this->merge(['email' => mb_strtolower(trim($this->email))]);
        }
    }

    public function rules(): array
    {
        $target = $this->route('user');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($target?->id)],
            'password' => ['sometimes', 'nullable', 'string', Password::min(12)->letters()->numbers()],
            'role' => ['sometimes', 'required', 'string', 'exists:roles,slug'],
            'status' => ['sometimes', 'required', Rule::in(User::STATUSES)],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'Email sudah terdaftar (termasuk akun yang sudah dihapus; pulihkan dari tab Dihapus).',
            'email.email' => 'Format email tidak valid.',
            'role.exists' => 'Role tidak dikenal.',
            'status.in' => 'Status tidak valid.',
        ];
    }
}
