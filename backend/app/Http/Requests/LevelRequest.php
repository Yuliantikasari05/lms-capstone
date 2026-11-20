<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Tambah/ubah level. Nama dan batas XP masing-masing unik. */
class LevelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $level = $this->route('level');
        $required = $level ? ['sometimes', 'required'] : ['required'];

        return [
            'name' => [...$required, 'string', 'max:50', Rule::unique('levels', 'name')->ignore($level)],
            'min_xp' => [...$required, 'integer', 'min:0', 'max:100000000', Rule::unique('levels', 'min_xp')->ignore($level)],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama level wajib diisi.',
            'name.max' => 'Nama level maksimal 50 karakter.',
            'name.unique' => 'Nama level sudah dipakai.',
            'min_xp.required' => 'Batas XP minimal wajib diisi.',
            'min_xp.integer' => 'Batas XP harus berupa bilangan bulat.',
            'min_xp.min' => 'Batas XP tidak boleh negatif.',
            'min_xp.max' => 'Batas XP terlalu besar.',
            'min_xp.unique' => 'Sudah ada level dengan batas XP yang sama.',
        ];
    }
}
