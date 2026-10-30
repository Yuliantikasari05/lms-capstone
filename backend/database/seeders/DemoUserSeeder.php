<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Akun contoh untuk development (mengisi halaman Manajemen User: paginasi, filter role/status, tab Dihapus).
 *
 * Jalankan manual:   php artisan db:seed --class=DemoUserSeeder
 * Sengaja TIDAK dimasukkan ke DatabaseSeeder agar `db:seed` biasa tidak pernah membuat data demo.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Password dari DEMO_USER_PASSWORD di .env; jika kosong dibuat acak dan ditampilkan sekali.
 * - Aman dijalankan berulang: akun dicocokkan lewat email, tidak menggandakan data.
 * - Akun Admin tidak disentuh (buat lewat `php artisan lms:create-admin`).
 * - Hapus semua akun demo:  User::withTrashed()->where('email', 'like', '%@demo.test')->forceDelete();
 */
class DemoUserSeeder extends Seeder
{
    public const DOMAIN = 'demo.test';

    /**
     * [nama, email (tanpa domain), role, status, dihapus?, login terakhir (hari lalu, null = belum pernah), bergabung (hari lalu)]
     *
     * @var array<int, array{0:string,1:string,2:string,3:string,4:bool,5:int|null,6:int}>
     */
    private const USERS = [
        // Mentor
        ['Rina Kusumawati', 'rina.kusumawati', Role::MENTOR, 'active', false, 0, 120],
        ['Bagas Prasetyo', 'bagas.prasetyo', Role::MENTOR, 'active', false, 1, 110],
        ['Intan Maharani', 'intan.maharani', Role::MENTOR, 'active', false, 3, 95],
        ['Fajar Nugroho', 'fajar.nugroho', Role::MENTOR, 'inactive', false, 40, 90],

        // Siswa
        ['Adi Saputra', 'adi.saputra', Role::SISWA, 'active', false, 0, 60],
        ['Bunga Lestari', 'bunga.lestari', Role::SISWA, 'active', false, 1, 58],
        ['Chandra Wijaya', 'chandra.wijaya', Role::SISWA, 'active', false, 2, 55],
        ['Dewi Anggraini', 'dewi.anggraini', Role::SISWA, 'active', false, 2, 52],
        ['Eko Firmansyah', 'eko.firmansyah', Role::SISWA, 'active', false, 5, 50],
        ['Fitri Handayani', 'fitri.handayani', Role::SISWA, 'active', false, 7, 47],
        ['Gilang Ramadhan', 'gilang.ramadhan', Role::SISWA, 'active', false, 9, 45],
        ['Hana Puspita', 'hana.puspita', Role::SISWA, 'active', false, 12, 40],
        ['Irfan Maulana', 'irfan.maulana', Role::SISWA, 'active', false, 15, 38],
        ['Jihan Aulia', 'jihan.aulia', Role::SISWA, 'active', false, null, 3],
        ['Kevin Pratama', 'kevin.pratama', Role::SISWA, 'active', false, null, 2],
        ['Larasati Putri', 'larasati.putri', Role::SISWA, 'inactive', false, 60, 130],
        ['Muhammad Rizki', 'muhammad.rizki', Role::SISWA, 'inactive', false, 75, 125],
        ['Nadia Safitri', 'nadia.safitri', Role::SISWA, 'suspended', false, 20, 70],
        ['Oscar Hidayat', 'oscar.hidayat', Role::SISWA, 'suspended', false, 33, 66],
        ['Putri Ayu', 'putri.ayu', Role::SISWA, 'active', true, 80, 140],

        // Karyawan
        ['Rudi Hartono', 'rudi.hartono', Role::KARYAWAN, 'active', false, 1, 80],
        ['Sari Wulandari', 'sari.wulandari', Role::KARYAWAN, 'active', false, 4, 78],
        ['Teguh Santoso', 'teguh.santoso', Role::KARYAWAN, 'active', false, 6, 75],
        ['Umi Kalsum', 'umi.kalsum', Role::KARYAWAN, 'active', false, null, 1],
        ['Vino Aditya', 'vino.aditya', Role::KARYAWAN, 'inactive', false, 50, 100],
        ['Wawan Setiawan', 'wawan.setiawan', Role::KARYAWAN, 'active', true, 90, 150],

        // Lembaga Bimbingan (1 akun = 1 lembaga)
        ['Bimbel Cerdas Mandiri', 'bimbel.cerdas', Role::LEMBAGA, 'active', false, 2, 85],
        ['Lembaga Prima Edukasi', 'prima.edukasi', Role::LEMBAGA, 'active', false, 8, 82],
        ['Bimbel Nusantara', 'bimbel.nusantara', Role::LEMBAGA, 'suspended', false, 45, 100],
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoUserSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $password = (string) (config('lms.demo_password') ?: '');
        $generated = false;

        if ($password === '') {
            $password = Str::password(16, symbols: false); // acak: huruf besar/kecil + angka
            $generated = true;
        } elseif (Validator::make(['p' => $password], ['p' => [Password::min(12)->letters()->numbers()]])->fails()) {
            $this->command?->error('DEMO_USER_PASSWORD tidak valid (min. 12 karakter, ada huruf dan angka). Dibatalkan.');

            return;
        }

        $roles = Role::pluck('id', 'slug');
        if ($roles->count() < 5) {
            $this->command?->error('Role belum ada. Jalankan `php artisan db:seed --class=RolePermissionSeeder` dulu.');

            return;
        }

        $hash = Hash::make($password); // di-hash sekali, dipakai semua akun demo

        foreach (self::USERS as [$name, $local, $role, $status, $deleted, $lastLoginDaysAgo, $joinedDaysAgo]) {
            $user = User::withTrashed()->firstOrNew(['email' => "{$local}@".self::DOMAIN]);

            $user->forceFill([
                'name' => $name,
                'password' => $hash,
                'status' => $status,
                'email_verified_at' => now(),
                'last_login_at' => $lastLoginDaysAgo === null ? null : now()->subDays($lastLoginDaysAgo)->subMinutes(random_int(5, 600)),
                'created_at' => now()->subDays($joinedDaysAgo),
                'deleted_at' => $deleted ? now()->subDays(max(1, intdiv($joinedDaysAgo, 4))) : null,
            ])->save();

            $user->roles()->sync([$roles[$role]]); // tepat satu role per akun
        }

        $this->command?->info(count(self::USERS).' akun demo siap (domain @'.self::DOMAIN.').');

        if ($generated) {
            $this->command?->warn("Password semua akun demo (ditampilkan sekali): {$password}");
            $this->command?->line('Tetapkan DEMO_USER_PASSWORD di .env agar password tetap sama setiap seeding.');
        } else {
            $this->command?->line('Password semua akun demo = nilai DEMO_USER_PASSWORD di .env Anda.');
        }
    }
}
