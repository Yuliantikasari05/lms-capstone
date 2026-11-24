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
        'users.delete' => 'Menghapus dan memulihkan pengguna',
        'users.export' => 'Mengekspor daftar pengguna',
        'users.reset_password' => 'Mereset kata sandi pengguna (kata sandi sementara)',
        'audit.view' => 'Melihat riwayat aktivitas pengelolaan akun',
        'courses.view' => 'Melihat daftar dan detail kursus',
        'courses.create' => 'Membuat kursus',
        'courses.update' => 'Mengubah kursus',
        'courses.delete' => 'Menghapus kursus',
        'courses.assign_mentor' => 'Menetapkan atau mengganti Mentor kursus',
        'content.manage' => 'Mengelola modul, materi, dan sesi kursus',
        'enrollments.manage' => 'Mendaftarkan dan mencabut peserta kursus',
        'coupons.view' => 'Melihat daftar kupon',
        'coupons.create' => 'Membuat kupon',
        'coupons.update' => 'Mengubah kupon',
        'coupons.delete' => 'Menghapus kupon',
        'gamification.view' => 'Melihat papan peringkat, ringkasan XP, dan level',
        'gamification.manage' => 'Mengatur level dan mengoreksi XP Siswa',
        'institutions.view' => 'Melihat daftar, detail, dan dashboard Lembaga Bimbingan',
        'institutions.create' => 'Membuat Lembaga Bimbingan beserta akunnya',
        'institutions.update' => 'Mengubah profil, bagi hasil, rekening, dan status Lembaga Bimbingan',
        'institutions.delete' => 'Menghapus dan memulihkan Lembaga Bimbingan',
        'institutions.payout' => 'Mengajukan dan memproses pencairan dana Lembaga Bimbingan',
        'roles.manage' => 'Mengatur role dan hak akses (Pengaturan)',
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
        Role::ADMIN => ['users.view', 'users.create', 'users.update', 'users.delete', 'users.export', 'users.reset_password', 'audit.view', 'roles.view', 'dashboard.admin',
            'courses.view', 'courses.create', 'courses.update', 'courses.delete', 'courses.assign_mentor', 'content.manage', 'enrollments.manage',
            'coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete',
            'gamification.view', 'gamification.manage',
            'institutions.view', 'institutions.create', 'institutions.update', 'institutions.delete', 'institutions.payout',
            'roles.manage'],
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
