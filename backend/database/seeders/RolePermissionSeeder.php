<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /** Daftar permission yang benar-benar dipakai pada tahap ini. */
    public const PERMISSIONS = [
        'users.view' => 'Melihat daftar & detail pengguna',
        'users.create' => 'Membuat pengguna',
        'users.update' => 'Mengubah pengguna',
        'users.delete' => 'Menghapus pengguna',
        'roles.view' => 'Melihat daftar role',
        'dashboard.admin' => 'Mengakses dashboard Admin',
        'dashboard.mentor' => 'Mengakses dashboard Mentor',
        'dashboard.siswa' => 'Mengakses dashboard Siswa',
        'dashboard.karyawan' => 'Mengakses dashboard Karyawan',
        'dashboard.lembaga' => 'Mengakses dashboard Lembaga Bimbingan',
    ];

    public const ROLES = [
        Role::ADMIN => 'Admin',
        Role::MENTOR => 'Mentor',
        Role::SISWA => 'Siswa',
        Role::KARYAWAN => 'Karyawan',
        Role::LEMBAGA => 'Lembaga Bimbingan',
    ];

    /** Prinsip least privilege: tiap role hanya mendapat permission yang dibutuhkan. */
    public const MATRIX = [
        Role::ADMIN => ['users.view', 'users.create', 'users.update', 'users.delete', 'roles.view', 'dashboard.admin'],
        Role::MENTOR => ['dashboard.mentor'],
        Role::SISWA => ['dashboard.siswa'],
        Role::KARYAWAN => ['dashboard.karyawan'],
        Role::LEMBAGA => ['dashboard.lembaga'],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $slug => $name) {
            Permission::updateOrCreate(['slug' => $slug], ['name' => $name]);
        }

        foreach (self::ROLES as $slug => $name) {
            $role = Role::updateOrCreate(['slug' => $slug], ['name' => $name]);
            $role->permissions()->sync(
                Permission::whereIn('slug', self::MATRIX[$slug])->pluck('id')
            );
        }
    }
}
