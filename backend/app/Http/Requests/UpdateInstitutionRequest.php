<?php

namespace App\Http\Requests;

use App\Models\Institution;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Mengubah profil lembaga. Data rekening boleh diubah sebagian; kelengkapannya (semua terisi atau
 * semua kosong) diperiksa controller terhadap data akhir. Mengirim null mengosongkan kolom.
 */
class UpdateInstitutionRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('update', $this->route('institution'));

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
            $merge['bank_account_number'] = preg_replace('/[\s-]+/', '', $this->input('bank_account_number'));
        }

        $this->merge($merge);
    }

    public function rules(): array
    {
        /** @var Institution $institution */
        $institution = $this->route('institution');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:150', StoreInstitutionRequest::uniqueName($institution->id)],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($institution->user_id)],
            'password' => ['prohibited'],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^[0-9+()\-\s]{6,30}$/'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'revenue_share_percent' => ['sometimes', 'required', 'integer', 'min:1', 'max:100'],
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:50'],
            'bank_account_holder' => ['sometimes', 'nullable', 'string', 'max:100'],
            'bank_account_number' => ['sometimes', 'nullable', 'string', 'regex:/^[0-9]{5,30}$/'],
            'status' => ['sometimes', 'required', Rule::in(User::STATUSES)],
        ];
    }

    public function messages(): array
    {
        return StoreInstitutionRequest::sharedMessages();
    }
}
