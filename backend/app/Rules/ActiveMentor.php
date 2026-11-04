<?php

namespace App\Rules;

use App\Models\Role;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Nilai harus id pengguna berrole Mentor yang aktif dan belum dihapus. */
class ActiveMentor implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $valid = is_numeric($value)
            && User::query()
                ->whereKey((int) $value)
                ->where('status', User::STATUS_ACTIVE)
                ->whereHas('roles', fn ($q) => $q->where('slug', Role::MENTOR))
                ->exists();

        if (! $valid) {
            $fail('Mentor tidak valid. Pilih pengguna dengan role Mentor yang aktif.');
        }
    }
}
