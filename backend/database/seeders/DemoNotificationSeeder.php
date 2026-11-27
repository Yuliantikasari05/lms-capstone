<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use App\Notifications\LearningNotification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Notifikasi contoh untuk akun demo: Siswa (adi.saputra), Mentor (rina.kusumawati), dan setiap
 * akun Admin yang ada, agar lonceng dan halaman Notifikasi tiap peran langsung berisi data yang
 * sesuai pekerjaannya (bukan daftar yang sama untuk semua orang).
 *
 * Jalankan manual SETELAH DemoUserSeeder, DemoCourseSeeder, DemoAssignmentSeeder, DemoLearningSeeder:
 *   php artisan db:seed --class=DemoNotificationSeeder
 *
 * Hanya berjalan di lingkungan local/testing dan aman dijalankan berulang: hanya notifikasi
 * contoh (dicocokkan lewat judulnya) yang dihapus, notifikasi lain milik akun tersebut dibiarkan.
 */
class DemoNotificationSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoNotificationSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $student = $this->demoUser(DemoLearningSeeder::STUDENT);
        $mentor = $this->demoUser('rina.kusumawati');
        $web = Course::query()->where('title', 'Dasar Pemrograman Web')->first();
        $excel = Course::query()->where('title', 'Excel untuk Karyawan')->first();

        $targets = [];

        if ($student !== null && $student->hasRole(Role::SISWA)) {
            $targets[] = [$student, $this->studentItems($web?->mentor?->name ?? 'Mentor')];
        }

        if ($mentor !== null && $mentor->hasRole(Role::MENTOR)) {
            $targets[] = [$mentor, $this->mentorItems($web, $excel)];
        }

        foreach (User::query()->whereHas('roles', fn ($query) => $query->where('slug', Role::ADMIN))->get() as $admin) {
            $targets[] = [$admin, $this->adminItems($web, $mentor?->name ?? 'Mentor')];
        }

        if ($targets === []) {
            $this->command?->error('Akun demo/Admin belum ada. Jalankan DemoUserSeeder lebih dulu.');

            return;
        }

        foreach ($targets as [$user, $items]) {
            $this->seed($user, $items);
        }
    }

    private function demoUser(string $local): ?User
    {
        return User::query()->where('email', $local.'@'.DemoUserSeeder::DOMAIN)->first();
    }

    /** @return array<int, array<string, mixed>> */
    private function studentItems(string $mentorName): array
    {
        return [
            [
                'category' => LearningNotification::CATEGORY_ASSESSMENT,
                'title' => 'Tugas sudah dinilai',
                'message' => 'Tugas 1: Struktur HTML dan CSS mendapat nilai 88. Buka detail untuk membaca feedback Mentor.',
                'actor_name' => $mentorName, 'actor_role' => 'Mentor',
                'action_label' => 'Lihat nilai', 'href' => '/siswa/assignments',
                'read_at' => null, 'hours_ago' => 2,
            ],
            [
                'category' => LearningNotification::CATEGORY_SCHEDULE,
                'title' => 'Sesi bimbingan baru dijadwalkan',
                'message' => 'Sesi bimbingan untuk kursus yang Anda ikuti sudah dijadwalkan. Cek jadwal agar tidak terlewat.',
                'actor_name' => $mentorName, 'actor_role' => 'Mentor',
                'action_label' => 'Lihat jadwal', 'href' => '/siswa/schedule',
                'read_at' => null, 'hours_ago' => 26,
            ],
            [
                'category' => LearningNotification::CATEGORY_ACHIEVEMENT,
                'title' => 'Kamu naik ke level Ahli',
                'message' => 'Total XP kamu sudah melewati batas level Ahli. Terus belajar untuk mempertahankan posisi di papan peringkat.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Lihat peringkat', 'href' => '/siswa/leaderboard',
                'read_at' => null, 'hours_ago' => 50,
            ],
            [
                'category' => LearningNotification::CATEGORY_ACHIEVEMENT,
                'title' => '+10 XP dari materi',
                'message' => 'Kamu menyelesaikan materi Welcome and Course Map dan mendapat 10 XP.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Buka materi', 'href' => '/siswa/materials',
                'read_at' => now()->subDay(), 'hours_ago' => 72,
            ],
            [
                'category' => LearningNotification::CATEGORY_ASSESSMENT,
                'title' => 'Tenggat tugas mendekat',
                'message' => 'Masih ada tugas yang belum dikerjakan. Periksa daftar tugas dan kumpulkan sebelum tenggat.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Kerjakan tugas', 'href' => '/siswa/assignments',
                'read_at' => now()->subDays(2), 'hours_ago' => 96,
            ],
            [
                'category' => LearningNotification::CATEGORY_SYSTEM,
                'title' => 'Laporan belajar bulan ini tersedia',
                'message' => 'Ringkasan progres, nilai, kehadiran, dan waktu belajarmu sudah diperbarui di halaman Laporan.',
                'actor_name' => 'Admin LMS', 'actor_role' => 'Admin',
                'action_label' => 'Lihat laporan', 'href' => '/siswa/reports',
                'read_at' => now()->subDays(3), 'hours_ago' => 120,
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function mentorItems(?Course $web, ?Course $excel): array
    {
        $webHref = '/mentor/courses/'.($web?->id ?? '');
        $excelHref = '/mentor/courses/'.($excel?->id ?? '');

        return [
            [
                'category' => LearningNotification::CATEGORY_SUBMISSION,
                'title' => 'Tugas menunggu penilaian: Tugas 1: Struktur HTML dan CSS',
                'message' => 'Adi Saputra mengumpulkan Tugas 1: Struktur HTML dan CSS untuk Dasar Pemrograman Web. Buka daftar pengumpulan untuk memberi nilai.',
                'actor_name' => 'Adi Saputra', 'actor_role' => 'Siswa',
                'action_label' => 'Beri penilaian', 'href' => '/mentor/assignments',
                'read_at' => null, 'hours_ago' => 1,
            ],
            [
                'category' => LearningNotification::CATEGORY_ROSTER,
                'title' => 'Peserta baru di Dasar Pemrograman Web',
                'message' => 'Bunga Lestari baru bergabung ke kursus yang Anda ampu. Periksa daftar peserta untuk menyapa mereka.',
                'actor_name' => 'Admin LMS', 'actor_role' => 'Admin',
                'action_label' => 'Lihat peserta', 'href' => $webHref,
                'read_at' => null, 'hours_ago' => 6,
            ],
            [
                'category' => LearningNotification::CATEGORY_ASSESSMENT,
                'title' => 'Ujian disetujui: Ujian Materi 3',
                'message' => 'Admin menyetujui ujian ini sehingga sudah dapat dipakai peserta.',
                'actor_name' => 'Admin LMS', 'actor_role' => 'Admin',
                'action_label' => 'Lihat tugas', 'href' => '/mentor/assignments',
                'read_at' => null, 'hours_ago' => 20,
            ],
            [
                'category' => LearningNotification::CATEGORY_ASSESSMENT,
                'title' => 'Ujian perlu diperbaiki: Ujian Materi 4',
                'message' => 'Admin menolak pengajuan ujian ini. Catatan Admin: Perbaiki soal nomor 3, kunci jawaban belum sesuai materi.',
                'actor_name' => 'Admin LMS', 'actor_role' => 'Admin',
                'action_label' => 'Lihat catatan', 'href' => '/mentor/assignments',
                'read_at' => now()->subDay(), 'hours_ago' => 30,
            ],
            [
                'category' => LearningNotification::CATEGORY_SCHEDULE,
                'title' => 'Jadwal bimbingan pekan ini',
                'message' => 'Ada dua sesi bimbingan terjadwal untuk kursus yang Anda ampu. Periksa tautan pertemuan sebelum sesi dimulai.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Lihat jadwal', 'href' => '/mentor/schedule',
                'read_at' => now()->subDays(2), 'hours_ago' => 48,
            ],
            [
                'category' => LearningNotification::CATEGORY_SYSTEM,
                'title' => 'Anda ditunjuk mengampu Excel untuk Karyawan',
                'message' => 'Admin LMS menetapkan Anda sebagai Mentor kursus ini. Lengkapi modul dan jadwal agar peserta bisa mulai belajar.',
                'actor_name' => 'Admin LMS', 'actor_role' => 'Admin',
                'action_label' => 'Buka kursus', 'href' => $excelHref,
                'read_at' => now()->subDays(3), 'hours_ago' => 72,
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function adminItems(?Course $web, string $mentorName): array
    {
        return [
            [
                'category' => LearningNotification::CATEGORY_ASSESSMENT,
                'title' => 'Ujian menunggu review: Ujian Materi 3',
                'message' => $mentorName.' mengajukan ujian untuk Dasar Pemrograman Web. Tinjau soal sebelum dapat dipakai peserta.',
                'actor_name' => $mentorName, 'actor_role' => 'Mentor',
                'action_label' => 'Review ujian', 'href' => '/admin/courses',
                'read_at' => null, 'hours_ago' => 1,
            ],
            [
                'category' => LearningNotification::CATEGORY_SYSTEM,
                'title' => 'Kursus baru dari Mentor: Excel untuk Karyawan',
                'message' => $mentorName.' membuat kursus Pelatihan baru. Tinjau kelengkapannya sebelum kursus diaktifkan.',
                'actor_name' => $mentorName, 'actor_role' => 'Mentor',
                'action_label' => 'Lihat kursus', 'href' => '/admin/courses',
                'read_at' => null, 'hours_ago' => 5,
            ],
            [
                'category' => LearningNotification::CATEGORY_ROSTER,
                'title' => 'Peserta baru di Dasar Pemrograman Web',
                'message' => 'Adi Saputra baru didaftarkan ke kursus Dasar Pemrograman Web. Periksa daftar peserta bila perlu menyesuaikan kelas.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Lihat kursus', 'href' => '/admin/courses/'.($web?->id ?? ''),
                'read_at' => null, 'hours_ago' => 10,
            ],
            [
                'category' => LearningNotification::CATEGORY_SYSTEM,
                'title' => 'Kupon hampir kedaluwarsa',
                'message' => 'Ada kupon diskon yang masa berlakunya tinggal beberapa hari. Perbarui atau nonaktifkan bila tidak dipakai lagi.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Kelola kupon', 'href' => '/admin/coupons',
                'read_at' => now()->subDay(), 'hours_ago' => 34,
            ],
            [
                'category' => LearningNotification::CATEGORY_SYSTEM,
                'title' => 'Ringkasan platform diperbarui',
                'message' => 'Jumlah pengguna, kursus aktif, dan pendaftaran terbaru sudah diperbarui di dashboard Admin.',
                'actor_name' => 'Sistem', 'actor_role' => 'Sistem',
                'action_label' => 'Buka dashboard', 'href' => '/admin',
                'read_at' => now()->subDays(2), 'hours_ago' => 60,
            ],
        ];
    }

    /** @param array<int, array<string, mixed>> $items */
    private function seed(User $user, array $items): void
    {
        $titles = array_column($items, 'title');

        $user->notifications()->get()
            ->filter(fn ($notification) => in_array($notification->data['title'] ?? null, $titles, true))
            ->each->delete();

        foreach ($items as $item) {
            $createdAt = now()->subHours($item['hours_ago']);
            $payload = (new LearningNotification(
                $item['category'],
                $item['title'],
                $item['message'],
                $item['actor_name'],
                $item['actor_role'],
                $item['action_label'],
                $item['href'],
            ))->toArray($user);

            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(),
                'type' => LearningNotification::class,
                'notifiable_type' => $user->getMorphClass(),
                'notifiable_id' => $user->id,
                'data' => json_encode($payload),
                'read_at' => $item['read_at'],
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        $unread = $user->unreadNotifications()->count();
        $this->command?->info(count($items).' notifikasi demo untuk '.$user->name.' ('.$unread.' belum dibaca) siap.');
    }
}
