<?php

namespace App\Support\Rbac;

/**
 * Katalog izin untuk Pengaturan > Role & Akses: SATU sumber kebenaran untuk
 *   - apa saja aktivitas yang tampil di matriks tiap role (rancangan hi-fi 3.18 dan FR-05 s.d. FR-48),
 *   - kolom C/R/U/D mana yang ada untuk tiap aktivitas,
 *   - slug permission yang BENAR-BENAR ditegakkan backend pada tiap sel,
 *   - role mana saja yang boleh menerima izin itu.
 *
 * Aturan yang dijaga (dan diuji di RbacCatalogTest / RbacEnforcementTest):
 *  1. Sel dengan status "active" selalu menunjuk permission yang ditegakkan oleh API (route middleware atau policy).
 *     Mematikan izin = endpoint-nya 403; menyalakan = endpoint-nya terbuka (dengan batas kepemilikan data bila ada).
 *  2. Fitur yang belum dibangun berstatus "planned": tampil di matriks (sesuai desain) tetapi tidak dapat dinyalakan,
 *     sehingga tidak ada sakelar yang tampak aktif padahal tidak mengendalikan apa pun.
 *  3. Izin hanya dapat diberikan ke role yang tercantum pada selnya. Izin yang dapat menaikkan hak sendiri
 *     (kelola pengguna, kelola role, riwayat aktivitas) hanya untuk Admin.
 *
 * Beberapa sel memakai slug yang sama karena backend memang mengendalikannya dengan satu izin (mis. membuat/ubah/hapus modul
 * dan sesi = content.manage). Sel berslug sama otomatis bergerak bersama dan ditandai "shared" pada API.
 */
final class Catalog
{
    public const ADMIN = 'admin';
    public const MENTOR = 'mentor';
    public const SISWA = 'siswa';
    public const KARYAWAN = 'karyawan';
    public const LEMBAGA = 'lembaga';
    /** Role buatan Admin. Hanya menerima izin yang tidak bergantung pada kepemilikan data. */
    public const CUSTOM = 'custom';

    public const SYSTEM_ROLES = [self::ADMIN, self::MENTOR, self::SISWA, self::KARYAWAN, self::LEMBAGA];

    /** Kolom matriks (urutan C, R, U, D seperti hi-fi). */
    public const COLUMNS = ['create', 'read', 'update', 'delete'];

    public const STATUS_ACTIVE = 'active';
    public const STATUS_PLANNED = 'planned';

    /** Izin tambahan yang WAJIB tetap dimiliki role tertentu agar tidak terkunci dari sistem. */
    private const REQUIRED = [
        self::ADMIN => ['dashboard.admin', 'roles.view', 'roles.manage'],
        self::MENTOR => ['dashboard.mentor'],
        self::SISWA => ['dashboard.siswa'],
        self::KARYAWAN => ['dashboard.karyawan'],
        self::LEMBAGA => ['dashboard.lembaga'],
    ];

    /** Izin yang hanya mengatur halaman (dikirim ke frontend lewat /auth/me), belum ada endpoint API-nya. */
    public const CLIENT_ONLY = ['dashboard.mentor', 'dashboard.siswa', 'dashboard.karyawan', 'dashboard.lembaga'];

    /** Izin yang menyangkut uang atau data sensitif: dapat didelegasikan, tetapi diberi tanda peringatan pada API. */
    public const SENSITIVE = ['institutions.update', 'institutions.payout', 'users.delete', 'users.reset_password', 'roles.manage'];

    /** @return array<string,string> kunci modul => nama tampil (urutan = urutan tampil) */
    public static function modules(): array
    {
        return [
            'dashboard' => 'Dashboard',
            'users' => 'Manajemen Pengguna',
            'curriculum' => 'Kurikulum dan Kursus',
            'learning' => 'Pembelajaran',
            'assessment' => 'Tugas dan Ujian',
            'students' => 'Siswa',
            'payment' => 'Pembayaran dan Sertifikat',
            'coupons' => 'Manajemen Kupon',
            'gamification' => 'Gamifikasi dan XP',
            'institutions' => 'Lembaga Bimbingan',
            'institution_self' => 'Pengelolaan Lembaga',
            'settings' => 'Setting',
        ];
    }

    /**
     * Daftar aktivitas. Tiap sel: [slug atau null, daftar role yang memilikinya].
     *
     * @return array<int, array<string,mixed>>
     */
    public static function activities(): array
    {
        $A = [self::ADMIN];
        $AC = [self::ADMIN, self::CUSTOM];

        $planned = 'Fitur belum dibangun.';

        return [
            // ------------------------------------------------------------------ Dashboard
            self::act('dashboard', 'dashboard_admin', 'Lihat Dashboard Admin', 'Mengakses halaman dashboard Admin.', ['read' => ['dashboard.admin', $A]]),
            self::act('dashboard', 'platform_statistics', 'Lihat Statistik Platform', 'Menampilkan jumlah pengguna, kursus, dan login terbaru pada dashboard.', ['read' => ['dashboard.admin', $A]]),
            self::act('dashboard', 'dashboard_mentor', 'Lihat Dashboard Mentor', 'Mengakses halaman dashboard Mentor.', ['read' => ['dashboard.mentor', [self::MENTOR]]]),
            self::act('dashboard', 'dashboard_siswa', 'Lihat Dashboard Siswa', 'Mengakses halaman dashboard Siswa.', ['read' => ['dashboard.siswa', [self::SISWA]]]),
            self::act('dashboard', 'dashboard_karyawan', 'Lihat Dashboard Karyawan', 'Mengakses halaman dashboard Karyawan.', ['read' => ['dashboard.karyawan', [self::KARYAWAN]]]),
            self::act('dashboard', 'dashboard_lembaga', 'Lihat Dashboard Lembaga Bimbingan', 'Mengakses halaman dashboard Lembaga Bimbingan.', ['read' => ['dashboard.lembaga', [self::LEMBAGA]]]),

            // ------------------------------------------------------------------ Manajemen Pengguna (khusus Admin: dapat menaikkan hak)
            self::act('users', 'users', 'Data Pengguna', 'Membuat, melihat, ubah, dan hapus data pengguna.', [
                'create' => ['users.create', $A], 'read' => ['users.view', $A], 'update' => ['users.update', $A], 'delete' => ['users.delete', $A],
            ]),
            self::act('users', 'users_export', 'Ekspor Data Pengguna', 'Mengunduh daftar pengguna.', ['read' => ['users.export', $A]]),
            self::act('users', 'users_reset_password', 'Reset Kata Sandi Pengguna', 'Membuat kata sandi sementara untuk pengguna lain.', ['update' => ['users.reset_password', $A]]),
            self::act('users', 'audit_log', 'Riwayat Aktivitas', 'Melihat riwayat aktivitas pengelolaan akun dan sistem.', ['read' => ['audit.view', $A]]),

            // ------------------------------------------------------------------ Kurikulum dan Kursus
            self::act('curriculum', 'courses', 'Data Kursus dan Kurikulum', 'Membuat, melihat, ubah, dan hapus data kursus.', [
                'create' => ['courses.create', [self::ADMIN, self::MENTOR]],
                'read' => ['courses.view', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'update' => ['courses.update', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'delete' => ['courses.delete', $A],
            ], labels: [
                self::MENTOR => ['Kursus yang Saya Ampu', 'Membuat dan mengelola kursus yang diampu sendiri.'],
                self::LEMBAGA => ['Program Lembaga Saya', 'Melihat dan mengubah program milik lembaga sendiri.'],
            ], own: [self::MENTOR, self::LEMBAGA]),
            self::act('curriculum', 'modules_materials', 'Modul dan Materi', 'Mengelola modul, materi, video, dan berkas pembelajaran.', [
                'create' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'read' => ['courses.view', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'update' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'delete' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
            ], own: [self::MENTOR, self::LEMBAGA]),
            self::act('curriculum', 'sessions', 'Sesi dan Live', 'Mengatur sesi, jadwal, dan tautan pertemuan online.', [
                'create' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'read' => ['courses.view', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'update' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
                'delete' => ['content.manage', [self::ADMIN, self::MENTOR, self::LEMBAGA]],
            ], own: [self::MENTOR, self::LEMBAGA]),
            self::act('curriculum', 'assign_mentor', 'Penunjukan Mentor', 'Menetapkan atau mengganti Mentor kursus.', ['update' => ['courses.assign_mentor', $A]]),
            self::act('curriculum', 'participants', 'Peserta Kursus', 'Melihat, mendaftarkan, dan mencabut peserta kursus.', [
                'create' => ['enrollments.manage', $A], 'read' => ['enrollments.manage', $A], 'delete' => ['enrollments.manage', $A],
            ]),
            self::planned('curriculum', 'discussions', 'Kelola Diskusi dan Komentar', 'Menyetujui atau menghapus komentar dan diskusi pengguna.', [
                self::ADMIN => ['create', 'read', 'update', 'delete'], self::MENTOR => ['create', 'read', 'update', 'delete'], self::LEMBAGA => ['create', 'read', 'update', 'delete'],
            ], $planned),
            self::planned('curriculum', 'exam_review', 'Review Soal Ujian', 'Menyetujui pengajuan soal ujian dari Mentor (FR-11).', [self::ADMIN => ['read', 'update']], $planned),
            self::planned('curriculum', 'certification', 'Sertifikasi Karyawan', 'Memproses pengajuan sertifikasi Karyawan (FR-12).', [self::ADMIN => ['read', 'update']], $planned),

            // ------------------------------------------------------------------ Mentor: siswa, tugas, ujian (belum dibangun)
            self::planned('students', 'mentor_students', 'Siswa yang Diampu', 'Melihat profil dan progres belajar siswa/karyawan yang diampu (FR-32).', [self::MENTOR => ['read']], $planned),
            self::planned('assessment', 'assignments', 'Master Tugas dan Ujian', 'Membuat tugas atau ujian untuk siswa/karyawan (FR-33).', [self::MENTOR => ['create', 'read', 'update', 'delete']], $planned),
            self::planned('assessment', 'grading', 'Penilaian dan Feedback', 'Menilai tugas/ujian dan memberi feedback (FR-34).', [self::MENTOR => ['read', 'update']], $planned),

            // ------------------------------------------------------------------ Siswa dan Karyawan (belum dibangun)
            self::planned('learning', 'schedule', 'Jadwal dan Deadline', 'Melihat jadwal tugas, bimbingan, dan deadline (FR-37).', [self::SISWA => ['read']], $planned),
            self::planned('learning', 'leaderboard_student', 'Papan Peringkat', 'Melihat papan peringkat dalam satu kurikulum (FR-38).', [self::SISWA => ['read']], $planned),
            self::planned('learning', 'my_classes', 'Kelas dan Materi yang Diikuti', 'Melihat kelas yang diikuti dan mengakses materinya (FR-39, FR-44).', [self::SISWA => ['read'], self::KARYAWAN => ['read']], $planned),
            self::planned('assessment', 'my_assignments', 'Tugas dan Evaluasi', 'Mengakses tugas, mengerjakan, dan melihat nilai (FR-41, FR-48).', [self::SISWA => ['create', 'read'], self::KARYAWAN => ['create', 'read']], $planned),
            self::planned('learning', 'learning_report', 'Laporan Belajar', 'Melihat laporan hasil belajar (FR-42, FR-47).', [self::SISWA => ['read'], self::KARYAWAN => ['read']], $planned),
            self::planned('payment', 'payment', 'Pembayaran Kelas', 'Membayar kelas atau webinar yang akan diikuti (FR-40, FR-45).', [self::SISWA => ['create'], self::KARYAWAN => ['create']], $planned),
            self::planned('payment', 'certificate_request', 'Pengajuan Sertifikat', 'Mengajukan sertifikasi dari pelatihan atau webinar (FR-46).', [self::KARYAWAN => ['create', 'read']], $planned),

            // ------------------------------------------------------------------ Kupon (Admin; dapat didelegasikan ke role khusus)
            self::act('coupons', 'coupons', 'Data Kupon', 'Membuat, melihat, ubah, dan hapus kupon diskon Admin.', [
                'create' => ['coupons.create', $AC], 'read' => ['coupons.view', $AC], 'update' => ['coupons.update', $AC], 'delete' => ['coupons.delete', $AC],
            ]),

            // ------------------------------------------------------------------ Gamifikasi dan XP
            self::act('gamification', 'leaderboard', 'Lihat Papan Peringkat', 'Melihat papan peringkat, ringkasan XP, dan riwayat XP Siswa.', ['read' => ['gamification.view', $AC]]),
            self::act('gamification', 'xp', 'Kelola XP Pengguna', 'Mengoreksi XP Siswa dan mereset XP ke 0.', ['update' => ['gamification.manage', $AC], 'delete' => ['gamification.manage', $AC]]),
            self::act('gamification', 'levels', 'Level', 'Mengatur nama level dan batas XP.', [
                'create' => ['gamification.manage', $AC], 'read' => ['gamification.view', $AC], 'update' => ['gamification.manage', $AC], 'delete' => ['gamification.manage', $AC],
            ]),
            self::planned('gamification', 'achievements', 'Kelola Achievement', 'Mengatur pencapaian dan lencana siswa.', [self::ADMIN => ['create', 'read', 'update', 'delete']], $planned),
            self::planned('gamification', 'daily_missions', 'Kelola Misi Harian', 'Mengatur misi harian untuk pengguna.', [self::ADMIN => ['create', 'read', 'update', 'delete']], $planned),

            // ------------------------------------------------------------------ Lembaga Bimbingan (Admin; dapat didelegasikan ke role khusus)
            self::act('institutions', 'institutions', 'Data Lembaga Bimbingan', 'Membuat, melihat, ubah, dan hapus lembaga beserta akunnya, bagi hasil, dan rekening.', [
                'create' => ['institutions.create', $AC], 'read' => ['institutions.view', $AC], 'update' => ['institutions.update', $AC], 'delete' => ['institutions.delete', $AC],
            ]),
            self::act('institutions', 'institution_payouts', 'Pencairan Dana Lembaga', 'Mengajukan dan memproses pencairan dana ke rekening lembaga.', [
                'create' => ['institutions.payout', $AC], 'update' => ['institutions.payout', $AC],
            ]),

            // ------------------------------------------------------------------ Pengelolaan oleh Lembaga sendiri (belum dibangun)
            self::planned('institution_self', 'lembaga_students', 'Kelola Siswa Lembaga', 'Melihat siswa sendiri, laporan belajar, dan berdiskusi (FR-22).', [self::LEMBAGA => ['read']], $planned),
            self::planned('institution_self', 'lembaga_vouchers', 'Voucher Lembaga', 'Mengelola voucher promosi milik lembaga (FR-24).', [self::LEMBAGA => ['create', 'read', 'update', 'delete']], $planned),
            self::planned('institution_self', 'lembaga_pricing', 'Atur Harga Modul', 'Mengatur harga modul pembelajaran lembaga.', [self::LEMBAGA => ['read', 'update']], $planned),
            self::planned('institution_self', 'lembaga_profile', 'Profil Lembaga', 'Melihat dan memperbarui profil dan pengaturan lembaga.', [self::LEMBAGA => ['read', 'update']], $planned),
            self::planned('institution_self', 'lembaga_report', 'Laporan Keuangan dan Jelajahi', 'Melihat laporan keuangan dan jumlah pendaftar modul (FR-23).', [self::LEMBAGA => ['read']], $planned),

            // ------------------------------------------------------------------ Setting (Admin)
            self::planned('settings', 'system_settings', 'Pengaturan Sistem', 'Melihat dan mengubah konfigurasi umum platform.', [self::ADMIN => ['read', 'update']], $planned),
            self::act('settings', 'roles', 'Kelola Role dan Permission', 'Melihat role, mengubah hak akses, dan membuat atau menghapus role khusus.', [
                'create' => ['roles.manage', $A], 'read' => ['roles.view', $A], 'update' => ['roles.manage', $A], 'delete' => ['roles.manage', $A],
            ]),
        ];
    }

    // ------------------------------------------------------------------ penurunan data

    /** Semua slug yang ditegakkan backend (sel berstatus active). */
    public static function enforcedSlugs(): array
    {
        $slugs = [];
        foreach (self::activities() as $activity) {
            if ($activity['status'] !== self::STATUS_ACTIVE) {
                continue;
            }
            foreach ($activity['cells'] as $cell) {
                $slugs[$cell['slug']] = true;
            }
        }

        return array_keys($slugs);
    }

    /**
     * Slug yang boleh diterima role tertentu (kunci role sistem atau "custom").
     *
     * @return array<int,string>
     */
    public static function assignable(string $roleKey): array
    {
        $slugs = [];
        foreach (self::activities() as $activity) {
            if ($activity['status'] !== self::STATUS_ACTIVE) {
                continue;
            }
            foreach ($activity['cells'] as $cell) {
                if (in_array($roleKey, $cell['roles'], true)) {
                    $slugs[$cell['slug']] = true;
                }
            }
        }

        return array_keys($slugs);
    }

    /** @return array<int,string> izin yang tidak boleh dicabut dari role ini. */
    public static function required(string $roleKey): array
    {
        return self::REQUIRED[$roleKey] ?? [];
    }

    /** Kunci katalog untuk sebuah role: slug role sistem, selain itu "custom". */
    public static function keyOf(string $roleSlug): string
    {
        return in_array($roleSlug, self::SYSTEM_ROLES, true) ? $roleSlug : self::CUSTOM;
    }

    public static function isSensitive(string $slug): bool
    {
        return in_array($slug, self::SENSITIVE, true);
    }

    // ------------------------------------------------------------------ pembantu pendefinisian

    /**
     * @param  array<string, array{0:string,1:array<int,string>}>  $cells
     * @param  array<string, array{0:string,1:string}>  $labels  nama/deskripsi pengganti per role
     * @param  array<int,string>  $own  role yang hanya mengakses data miliknya
     */
    private static function act(string $module, string $key, string $label, string $description, array $cells, array $labels = [], array $own = []): array
    {
        $out = [];
        foreach ($cells as $action => [$slug, $roles]) {
            $out[$action] = ['slug' => $slug, 'roles' => $roles];
        }

        return ['key' => $key, 'module' => $module, 'label' => $label, 'description' => $description, 'status' => self::STATUS_ACTIVE, 'note' => null, 'cells' => $out, 'labels' => $labels, 'own' => $own];
    }

    /**
     * Aktivitas yang ada di desain tetapi belum dibangun. $actions: role => daftar kolom yang ada.
     *
     * @param  array<string, array<int,string>>  $actions
     */
    private static function planned(string $module, string $key, string $label, string $description, array $actions, string $note): array
    {
        $cells = [];
        foreach ($actions as $role => $columns) {
            foreach ($columns as $column) {
                $cells[$column]['slug'] = null;
                $cells[$column]['roles'][] = $role;
            }
        }

        return ['key' => $key, 'module' => $module, 'label' => $label, 'description' => $description, 'status' => self::STATUS_PLANNED, 'note' => $note, 'cells' => $cells, 'labels' => [], 'own' => []];
    }
}
