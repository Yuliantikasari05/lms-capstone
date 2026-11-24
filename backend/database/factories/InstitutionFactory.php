<?php

namespace Database\Factories;

use App\Models\Institution;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Institution> */
class InstitutionFactory extends Factory
{
    protected $model = Institution::class;

    public function definition(): array
    {
        return [
            'user_id' => fn () => $this->lembagaUser()->id,
            'name' => 'Bimbel '.fake()->unique()->company(),
            'description' => null,
            'phone' => null,
            'address' => null,
            'revenue_share_percent' => 80,
            'bank_name' => null,
            'bank_account_holder' => null,
            'bank_account_number' => null,
        ];
    }

    /** Akun ber-role lembaga (butuh RolePermissionSeeder sudah dijalankan). */
    private function lembagaUser(): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::where('slug', Role::LEMBAGA)->firstOrFail());

        return $user;
    }

    public function forUser(User $user): static
    {
        return $this->state(['user_id' => $user->id]);
    }

    public function share(?int $percent): static
    {
        return $this->state(['revenue_share_percent' => $percent]);
    }

    public function withBank(string $bank = 'BCA', string $holder = 'Bimbel CN', string $number = '1234567810'): static
    {
        return $this->state(['bank_name' => $bank, 'bank_account_holder' => $holder, 'bank_account_number' => $number]);
    }
}
