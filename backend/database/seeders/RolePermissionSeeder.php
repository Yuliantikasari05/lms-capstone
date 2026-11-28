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
        'assignments.view' => 'Melihat tugas, kuis, dan ujian',
        'assignments.manage' => 'Membuat dan mengubah tugas, kuis, dan ujian',
        'assignments.grade' => 'Menilai pengumpulan tugas peserta',
        'assignments.review' => 'Menyetujui atau menolak ujian buatan Mentor',
        'learning.view' => 'Melihat kelas dan materi yang diikuti (Siswa)',
        'learning.progress' => 'Menandai materi selesai dan mencatat waktu belajar (Siswa)',
        'assignments.submit' => 'Mengerjakan dan mengumpulkan tugas, kuis, serta ujian (Siswa)',
        'schedule.view' => 'Melihat jadwal bimbingan dan tenggat tugas (Siswa)',
        'schedule.join' => 'Bergabung ke sesi bimbingan dan mencatat kehadiran (Siswa)',
        'reports.view' => 'Melihat laporan belajar sendiri (Siswa)',
        'leaderboard.view' => 'Melihat papan peringkat Siswa',
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
        'lembaga.students.view' => 'Melihat siswa yang mengikuti program lembaga sendiri',
        'lembaga.vouchers.view' => 'Melihat voucher promosi milik lembaga sendiri',
        'lembaga.vouchers.create' => 'Membuat voucher promosi lembaga sendiri',
        'lembaga.vouchers.update' => 'Mengubah voucher promosi lembaga sendiri',
        'lembaga.vouchers.delete' => 'Menghapus voucher promosi lembaga sendiri',
        'lembaga.pricing.view' => 'Melihat harga program lembaga sendiri',
        'lembaga.pricing.update' => 'Mengatur harga program lembaga sendiri',
        'lembaga.profile.view' => 'Melihat profil lembaga sendiri',
        'lembaga.profile.update' => 'Memperbarui profil lembaga sendiri',
        'lembaga.report.view' => 'Melihat laporan pendapatan dan pendaftar program lembaga sendiri',
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
            'assignments.view', 'assignments.manage', 'assignments.grade', 'assignments.review',
            'coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete',
            'gamification.view', 'gamification.manage',
            'institutions.view', 'institutions.create', 'institutions.update', 'institutions.delete', 'institutions.payout',
            'roles.manage'],
        // Mentor: mengelola kursus yang diampu sendiri (kepemilikan tetap ditegakkan CoursePolicy).
        Role::MENTOR => ['dashboard.mentor', 'courses.view', 'courses.create', 'courses.update', 'content.manage',
            'assignments.view', 'assignments.manage', 'assignments.grade'],
        // Siswa: seluruh fitur belajar yang hanya mengakses data miliknya sendiri (enrollment aktif).
        Role::SISWA => ['dashboard.siswa', 'learning.view', 'learning.progress', 'assignments.submit',
            'schedule.view', 'schedule.join', 'reports.view', 'leaderboard.view'],
        Role::KARYAWAN => ['dashboard.karyawan'],
        // Lembaga: membangun dan mengelola program pembelajaran opsional miliknya sendiri.
        Role::LEMBAGA => ['dashboard.lembaga', 'courses.view', 'courses.create', 'courses.update', 'content.manage',
            'lembaga.students.view', 'lembaga.vouchers.view', 'lembaga.vouchers.create', 'lembaga.vouchers.update', 'lembaga.vouchers.delete',
            'lembaga.pricing.view', 'lembaga.pricing.update', 'lembaga.profile.view', 'lembaga.profile.update', 'lembaga.report.view'],
    ];

    /**
     * Aman dijalankan berulang TANPA menimpa pengaturan Admin di Pengaturan > Role & Akses:
     *  - permission baru dibuat, yang sudah ada hanya diperbarui namanya;
     *  - role baru mendapat seluruh izin bawaannya;
     *  - role yang sudah ada HANYA menerima izin bawaan yang baru dibuat pada eksekusi ini (mis. fitur baru),
     *    sehingga izin yang sengaja dimatikan Admin tidak dinyalakan lagi.
     * Untuk mengembalikan sebuah role ke bawaan: tombol "Atur ulang" di Pengaturan, atau
     * `php artisan lms:reset-role-permissions --role=<slug>`.
     */
    public function run(): void
    {
        $created = [];

        foreach (self::PERMISSIONS as $slug => $name) {
            $permission = Permission::firstOrNew(['slug' => $slug]);

            if (! $permission->exists) {
                $created[] = $slug;
            }

            $permission->name = $name;
            $permission->save();
        }

        foreach (self::ROLES as $slug => $name) {
            $role = Role::firstOrNew(['slug' => $slug]);
            $isNew = ! $role->exists;
            $role->name = $name;
            $role->save();

            $grant = $isNew ? self::MATRIX[$slug] : array_values(array_intersect(self::MATRIX[$slug], $created));

            $role->permissions()->syncWithoutDetaching(Permission::whereIn('slug', $grant)->pluck('id'));
        }
    }
}
