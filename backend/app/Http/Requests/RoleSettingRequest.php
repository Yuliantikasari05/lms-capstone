<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;

/** Membuat role khusus atau mengubah nama, deskripsi, dan izin role. Kelayakan izin diperiksa RoleMatrix::assertValid. */
class RoleSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('roles.manage') ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    public function rules(): array
    {
        /** @var Role|null $role */
        $role = $this->route('role');
        $required = $role ? ['sometimes', 'required'] : ['required'];

        return [
            'name' => [...$required, 'string', 'min:3', 'max:100', function (string $attribute, mixed $value, \Closure $fail) use ($role) {
                $taken = Role::query()
                    ->whereRaw('lower(name) = ?', [mb_strtolower((string) $value)])
                    ->when($role, fn ($q) => $q->where('id', '!=', $role->id))
                    ->exists();

                if ($taken) {
                    $fail('Nama role sudah dipakai.');
                }
            }],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'permissions' => [$role ? 'sometimes' : 'nullable', 'array', 'max:200'],
            'permissions.*' => ['string', 'distinct'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama role wajib diisi.',
            'name.min' => 'Nama role minimal 3 karakter.',
            'name.max' => 'Nama role maksimal 100 karakter.',
            'description.max' => 'Deskripsi maksimal 255 karakter.',
            'permissions.array' => 'Daftar izin harus berupa larik.',
            'permissions.*.distinct' => 'Ada izin yang dikirim dua kali.',
        ];
    }
}
