<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Membuat akun Admin awal HANYA jika ADMIN_EMAIL dan ADMIN_PASSWORD diisi di .env.
 * Tidak ada password default di dalam source code.
 */
class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('lms.admin.email');
        $password = config('lms.admin.password');

        if (blank($email) || blank($password)) {
            $this->command?->warn('ADMIN_EMAIL/ADMIN_PASSWORD kosong: akun Admin tidak dibuat. Jalankan `php artisan lms:create-admin`.');

            return;
        }

        if (mb_strlen((string) $password) < 12) {
            $this->command?->error('ADMIN_PASSWORD minimal 12 karakter: akun Admin tidak dibuat.');

            return;
        }

        $admin = User::withTrashed()->firstOrNew(['email' => mb_strtolower(trim((string) $email))]);
        $admin->fill([
            'name' => config('lms.admin.name') ?: 'Administrator',
            'password' => $password,
            'status' => User::STATUS_ACTIVE,
        ])->save();

        if ($admin->trashed()) {
            $admin->restore();
        }

        // sync: setiap akun memiliki tepat satu role.
        $admin->roles()->sync([Role::where('slug', Role::ADMIN)->firstOrFail()->id]);

        $this->command?->info("Akun Admin siap: {$admin->email}");
    }
}
