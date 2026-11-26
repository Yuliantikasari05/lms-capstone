<?php

namespace Database\Seeders;

use App\Models\ClassSession;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Material;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Data contoh kursus untuk development (mengisi halaman Manajemen Kursus: kartu, filter, modul, sesi, peserta).
 *
 * Jalankan manual (setelah DemoUserSeeder):
 *   php artisan db:seed --class=DemoUserSeeder
 *   php artisan db:seed --class=DemoCourseSeeder
 * Sengaja TIDAK dimasukkan ke DatabaseSeeder agar `db:seed` biasa tidak pernah membuat data demo.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Memakai akun @demo.test dari DemoUserSeeder (Mentor, Siswa, Karyawan, Lembaga).
 * - Aman dijalankan berulang: kursus dicocokkan lewat judul, modul/materi/sesi/peserta tidak digandakan.
 * - Materi hanya berupa tautan (tanpa file) agar tidak memenuhi penyimpanan: bertipe video bila punya durasi,
 *   tautan bila tidak. Jadwal sesi dihitung dari hari ini.
 * - Hapus semua data demo kursus:  Course::withTrashed()->whereIn('title', DemoCourseSeeder::titles())->forceDelete();
 */
class DemoCourseSeeder extends Seeder
{
    /**
     * Tautan Google Meet contoh untuk sesi demo. Hanya untuk data contoh lokal; saat Mentor membuat
     * sesi sungguhan, tautan asli wajib diisi (divalidasi backend).
     */
    public const DEMO_MEETING_URL = 'https://meet.google.com/hbk-givp-vaz';

    /** @return array<int,string> */
    public static function titles(): array
    {
        return array_column(self::definitions(), 'title');
    }

    /**
     * mentor/lembaga: bagian depan email @demo.test. participants: [bagian depan email].
     * modules: judul => daftar materi [judul, durasi menit|null, xp].
     * sessions: [judul, hari dari sekarang, jam mulai, durasi jam].
     *
     * @return array<int, array<string,mixed>>
     */
    private static function definitions(): array
    {
        return [
            [
                'title' => 'Dasar Pemrograman Web', 'type' => Course::TYPE_ACADEMIC, 'status' => Course::STATUS_ACTIVE, 'mentor' => 'rina.kusumawati',
                'description' => 'Belajar HTML, CSS, dan JavaScript dari nol sampai bisa membuat halaman web sendiri.',
                'modules' => [
                    'Pengenalan Web' => [['Welcome and Course Map', 10, 10], ['Cheat Sheet HTML dan CSS', null, 5]],
                    'JavaScript Dasar' => [['Variabel dan Tipe Data', 15, 10], ['Latihan Fungsi', 20, 15]],
                ],
                'sessions' => [['Kelas Perdana', 3, 9, 2], ['Tanya Jawab Pekan 1', 10, 19, 1]],
                'participants' => ['adi.saputra', 'bunga.lestari', 'chandra.wijaya', 'dewi.anggraini', 'eko.firmansyah', 'fitri.handayani'],
            ],
            [
                'title' => 'Matematika Dasar SMP', 'type' => Course::TYPE_ACADEMIC, 'status' => Course::STATUS_ACTIVE, 'mentor' => 'bagas.prasetyo',
                'description' => 'Penguatan konsep bilangan, aljabar, dan geometri untuk siswa SMP.',
                'modules' => ['Bilangan dan Operasinya' => [['Pengantar Bilangan Bulat', 12, 10]]],
                'sessions' => [['Kelas Bilangan', 5, 16, 2]],
                'participants' => ['gilang.ramadhan', 'hana.puspita', 'irfan.maulana'],
            ],
            [
                'title' => 'Bahasa Inggris Percakapan', 'type' => Course::TYPE_ACADEMIC, 'status' => Course::STATUS_DRAFT, 'mentor' => 'intan.maharani',
                'description' => 'Draf kursus percakapan sehari-hari. Belum dibuka untuk peserta.',
                'modules' => ['Greetings' => [['Daftar Ungkapan Sapaan', null, 0]]],
                'sessions' => [],
                'participants' => [],
            ],
            [
                'title' => 'Excel untuk Karyawan', 'type' => Course::TYPE_TRAINING, 'status' => Course::STATUS_ACTIVE, 'mentor' => 'rina.kusumawati',
                'description' => 'Pelatihan Excel dari rumus dasar sampai tabel pivot untuk pekerjaan kantor.',
                'modules' => ['Rumus Dasar' => [['Pengenalan Rumus', 18, 0], ['Latihan SUM dan IF', null, 0]]],
                'sessions' => [['Sesi Pelatihan 1', 4, 13, 3]],
                'participants' => ['rudi.hartono', 'sari.wulandari', 'teguh.santoso'],
            ],
            [
                'title' => 'Webinar Karier di Era AI', 'type' => Course::TYPE_WEBINAR, 'status' => Course::STATUS_ACTIVE, 'mentor' => 'bagas.prasetyo',
                'description' => 'Webinar satu sesi tentang peluang karier dan keterampilan yang dibutuhkan.',
                'modules' => [],
                'sessions' => [['Webinar Karier', 7, 19, 2]],
                'participants' => ['rudi.hartono', 'sari.wulandari'],
            ],
            [
                'title' => 'Fisika Dasar (Arsip)', 'type' => Course::TYPE_ACADEMIC, 'status' => Course::STATUS_INACTIVE, 'mentor' => 'intan.maharani',
                'description' => 'Kursus lama yang sudah dinonaktifkan.',
                'modules' => ['Gerak Lurus' => [['Ringkasan Materi', null, 0]]],
                'sessions' => [],
                'participants' => [],
            ],
            [
                'title' => 'Program Beasiswa Prima Edukasi', 'type' => Course::TYPE_INSTITUTION, 'status' => Course::STATUS_ACTIVE, 'lembaga' => 'prima.edukasi',
                'description' => 'Contoh Program Lembaga. Admin hanya dapat melihatnya (diubah oleh lembaganya).',
                'modules' => ['Persiapan Seleksi' => [['Panduan Seleksi', null, 10]]],
                'sessions' => [],
                'participants' => [],
            ],
        ];
    }

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoCourseSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $email = fn (string $local) => $local.'@'.DemoUserSeeder::DOMAIN;
        $users = User::query()->where('email', 'like', '%@'.DemoUserSeeder::DOMAIN)->get()->keyBy('email');

        if ($users->isEmpty() || Role::count() < 5) {
            $this->command?->error('Akun demo belum ada. Jalankan `php artisan db:seed --class=DemoUserSeeder` dulu.');

            return;
        }

        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('slug', Role::ADMIN))->oldest('id')->first();
        $created = 0;

        foreach (self::definitions() as $def) {
            $course = Course::query()->where('title', $def['title'])->first() ?? new Course;
            $isNew = ! $course->exists;

            $course->fill(['type' => $def['type'], 'title' => $def['title'], 'description' => $def['description'], 'status' => $def['status']]);
            $course->mentor_id = isset($def['mentor']) ? $users->get($email($def['mentor']))?->id : null;
            $course->created_by = isset($def['lembaga']) ? $users->get($email($def['lembaga']))?->id : $admin?->id;
            $course->save();
            $created += $isNew ? 1 : 0;

            $this->seedModules($course, $def['modules']);
            $this->seedSessions($course, $def['sessions']);
            $this->seedParticipants($course, $def['participants'], $users, $email, $admin);
        }

        $this->command?->info(count(self::definitions()).' kursus demo siap ('.$created.' baru).');
    }

    /** @param array<string, array<int, array{0:string,1:int|null,2:int}>> $modules */
    private function seedModules(Course $course, array $modules): void
    {
        $position = 0;
        foreach ($modules as $title => $materials) {
            $module = CourseModule::query()->where('course_id', $course->id)->where('title', $title)->first() ?? new CourseModule;
            $module->course_id = $course->id;
            $module->fill(['title' => $title, 'position' => ++$position])->save();

            foreach (array_values($materials) as $i => [$materialTitle, $duration, $xp]) {
                $material = Material::query()->where('course_module_id', $module->id)->where('title', $materialTitle)->first() ?? new Material;
                $material->course_module_id = $module->id;
                $material->fill([
                    'title' => $materialTitle,
                    // Video boleh punya durasi dan tautan; tautan biasa tidak memakai durasi (sesuai aturan API).
                    'type' => $duration !== null ? Material::TYPE_VIDEO : Material::TYPE_LINK,
                    'external_url' => 'https://contoh.demo.test/materi/'.str($materialTitle)->slug(),
                    'duration_minutes' => $duration,
                    'xp_points' => $course->allowsXp() ? $xp : 0,
                    'position' => $i + 1,
                ])->save();
            }
        }
    }

    /** @param array<int, array{0:string,1:int,2:int,3:int}> $sessions */
    private function seedSessions(Course $course, array $sessions): void
    {
        foreach (array_values($sessions) as $index => [$title, $daysFromNow, $hour, $hours]) {
            $start = now()->addDays($daysFromNow)->setTime($hour, 0);
            // Sesi ganjil dibuat Offline agar halaman Jadwal menampilkan kedua mode.
            $offline = $index % 2 === 1;
            $session = ClassSession::query()->where('course_id', $course->id)->where('title', $title)->first() ?? new ClassSession;
            $session->course_id = $course->id;
            $session->fill([
                'title' => $title,
                'starts_at' => $start,
                'ends_at' => $start->copy()->addHours($hours),
                'mode' => $offline ? ClassSession::MODE_OFFLINE : ClassSession::MODE_ONLINE,
                'location' => $offline ? 'Ruang bimbingan 1' : null,
                'meeting_url' => $offline ? null : self::DEMO_MEETING_URL,
                'status' => $course->status === Course::STATUS_DRAFT ? ClassSession::STATUS_DRAFT : ClassSession::STATUS_SCHEDULED,
            ])->save();
        }
    }

    /** @param array<int,string> $participants */
    private function seedParticipants(Course $course, array $participants, $users, callable $email, ?User $admin): void
    {
        foreach ($participants as $local) {
            $user = $users->get($email($local));
            if ($user === null) {
                continue;
            }

            $enrollment = Enrollment::query()->where('course_id', $course->id)->where('user_id', $user->id)->first() ?? new Enrollment;
            $enrollment->course_id = $course->id;
            $enrollment->user_id = $user->id;
            $enrollment->enrolled_by = $admin?->id;
            $enrollment->fill(['status' => Enrollment::STATUS_ACTIVE, 'source' => Enrollment::SOURCE_ADMIN]);
            $enrollment->enrolled_at ??= $user->created_at ?? now();
            $enrollment->cancelled_at = null;
            $enrollment->save();
        }
    }
}
