<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdminCommand extends Command
{
    protected $signature = 'lms:create-admin {--name= : Nama Admin} {--email= : Email Admin}';

    protected $description = 'Membuat atau memperbarui akun Admin dengan password yang diinput secara tersembunyi.';

    public function handle(): int
    {
        $adminRole = Role::where('slug', Role::ADMIN)->first();

        if (! $adminRole) {
            $this->error('Role admin belum ada. Jalankan `php artisan db:seed` terlebih dahulu.');

            return self::FAILURE;
        }

        $name = $this->option('name') ?: $this->ask('Nama Admin', 'Administrator');
        $email = mb_strtolower(trim((string) ($this->option('email') ?: $this->ask('Email Admin'))));
        $password = (string) $this->secret('Password (min. 12 karakter, tidak akan ditampilkan)');
        $confirmation = (string) $this->secret('Ulangi password');

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password, 'password_confirmation' => $confirmation],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255'],
                'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
            ]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        $admin = User::updateOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => $password, 'status' => User::STATUS_ACTIVE]
        );
        $admin->roles()->syncWithoutDetaching([$adminRole->id]);

        $this->info("Akun Admin siap digunakan: {$admin->email}");

        return self::SUCCESS;
    }
}
