<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\AssignmentAnswer;
use App\Models\AssignmentSubmission;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LearningDay;
use App\Models\Material;
use App\Models\MaterialCompletion;
use App\Models\Role;
use App\Models\SessionAttendance;
use App\Models\StudyLog;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\XpService;
use Illuminate\Database\Seeder;

/**
 * Data contoh aktivitas belajar untuk akun Siswa demo (mengisi Dashboard, Materi, Tugas, Jadwal,
 * Laporan, dan Papan Peringkat dengan data nyata, bukan angka statis).
 *
 * Jalankan manual SETELAH DemoUserSeeder, DemoCourseSeeder, DemoAssignmentSeeder, dan DemoGamificationSeeder:
 *   php artisan db:seed --class=DemoLearningSeeder
 * Sengaja tidak masuk DatabaseSeeder agar `db:seed` biasa tidak membuat data contoh.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Fokus pada satu Siswa (adi.saputra@demo.test) agar progres, streak, kehadiran, dan XP-nya konsisten.
 * - Aman dijalankan berulang: seluruh data dicocokkan lewat kunci unik (peserta + materi/sesi/hari).
 */
class DemoLearningSeeder extends Seeder
{
    public const STUDENT = 'adi.saputra';

    /** Materi yang dianggap sudah diselesaikan, per judul kursus => judul materi. */
    private const COMPLETED = [
        'Dasar Pemrograman Web' => ['Welcome and Course Map', 'Cheat Sheet HTML dan CSS'],
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoLearningSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $student = User::query()->where('email', self::STUDENT.'@'.DemoUserSeeder::DOMAIN)->first();
        if ($student === null || ! $student->hasRole(Role::SISWA)) {
            $this->command?->error('Akun Siswa demo belum ada. Jalankan `php artisan db:seed --class=DemoUserSeeder` dulu.');

            return;
        }

        // Kursus kedua agar kartu Materi dan laporan punya lebih dari satu baris.
        $second = Course::query()->where('title', 'Matematika Dasar SMP')->first();
        if ($second !== null) {
            Enrollment::query()->firstOrCreate(
                ['course_id' => $second->id, 'user_id' => $student->id],
                ['status' => Enrollment::STATUS_ACTIVE, 'source' => Enrollment::SOURCE_ADMIN, 'enrolled_at' => now()->subDays(20)],
            );
        }

        $this->seedCompletions($student);
        $this->seedStudyLogs($student);
        $this->seedActiveDays($student);
        $this->seedAttendance($student);
        $this->seedGradedSubmission($student);

        $this->command?->info('Data belajar demo untuk '.$student->name.' siap.');
    }

    private function seedCompletions(User $student): void
    {
        $xp = app(XpService::class);

        foreach (self::COMPLETED as $courseTitle => $materialTitles) {
            $course = Course::query()->where('title', $courseTitle)->first();
            if ($course === null) {
                continue;
            }

            foreach ($materialTitles as $index => $materialTitle) {
                $material = Material::query()
                    ->whereIn('course_module_id', $course->modules()->pluck('id'))
                    ->where('title', $materialTitle)
                    ->first();
                if ($material === null) {
                    continue;
                }

                $completion = MaterialCompletion::query()->firstOrCreate(
                    ['user_id' => $student->id, 'material_id' => $material->id],
                    ['completed_at' => now()->subDays(4 - $index), 'xp_awarded' => (int) $material->xp_points],
                );

                if ($completion->wasRecentlyCreated && $material->xp_points > 0) {
                    $xp->award($student, (int) $material->xp_points, XpService::SOURCE_MATERIAL, $material->id, 'Menyelesaikan materi: '.$material->title);
                }
            }
        }
    }

    /** Waktu belajar enam bulan terakhir (menit), agar grafik laporan berisi data nyata. */
    private function seedStudyLogs(User $student): void
    {
        $courses = Course::query()
            ->whereIn('id', Enrollment::query()->where('user_id', $student->id)->pluck('course_id'))
            ->get();

        foreach ($courses as $courseIndex => $course) {
            for ($back = 5; $back >= 0; $back--) {
                $minutes = 40 + $courseIndex * 15 + (5 - $back) * 10;

                StudyLog::query()->firstOrCreate(
                    [
                        'user_id' => $student->id,
                        'course_id' => $course->id,
                        'studied_on' => now()->startOfMonth()->subMonths($back)->addDays(5)->toDateString(),
                    ],
                    ['minutes' => $minutes],
                );
            }
        }

        // Beberapa hari di bulan berjalan agar "Total Belajar" bulan ini tidak nol.
        $primary = $courses->firstWhere('title', 'Dasar Pemrograman Web') ?? $courses->first();
        if ($primary !== null) {
            foreach ([0, 1, 2, 3] as $daysAgo) {
                $day = now()->subDays($daysAgo)->toDateString();
                if (now()->subDays($daysAgo)->month !== now()->month) {
                    continue;
                }

                $log = StudyLog::query()
                    ->where('user_id', $student->id)
                    ->where('course_id', $primary->id)
                    ->whereDate('studied_on', $day)
                    ->first() ?? new StudyLog([
                        'user_id' => $student->id,
                        'course_id' => $primary->id,
                        'studied_on' => $day,
                        'minutes' => 0,
                    ]);
                $log->minutes = max((int) $log->minutes, 45);
                $log->save();
            }
        }
    }

    private function seedActiveDays(User $student): void
    {
        // Empat hari beruntun sampai hari ini: streak dashboard langsung terlihat.
        foreach (range(0, 3) as $daysAgo) {
            LearningDay::query()->firstOrCreate([
                'user_id' => $student->id,
                'day' => now()->subDays($daysAgo)->toDateString(),
            ]);
        }

        // Beberapa hari di bulan lalu supaya laporan bulan sebelumnya juga punya isi.
        foreach ([28, 29, 30] as $daysAgo) {
            LearningDay::query()->firstOrCreate([
                'user_id' => $student->id,
                'day' => now()->subDays($daysAgo)->toDateString(),
            ]);
        }
    }

    /**
     * Sesi lampau + kehadiran, agar persentase kehadiran di laporan punya dasar nyata.
     * Sesi ini hanya data contoh lokal dan tidak mengubah jadwal mendatang.
     */
    private function seedAttendance(User $student): void
    {
        $course = Course::query()->where('title', 'Dasar Pemrograman Web')->first();
        if ($course === null) {
            return;
        }

        $session = ClassSession::query()->firstOrCreate(
            ['course_id' => $course->id, 'title' => 'Kelas Perdana (Pekan Lalu)'],
            [
                'description' => 'Sesi contoh yang sudah berlangsung untuk mengisi laporan kehadiran.',
                'starts_at' => now()->subDays(14)->setTime(9, 0),
                'ends_at' => now()->subDays(14)->setTime(11, 0),
                'mode' => ClassSession::MODE_ONLINE,
                'status' => ClassSession::STATUS_SCHEDULED,
                'meeting_url' => DemoCourseSeeder::DEMO_MEETING_URL,
            ],
        );

        SessionAttendance::query()->firstOrCreate(
            ['class_session_id' => $session->id, 'user_id' => $student->id],
            ['joined_at' => $session->starts_at],
        );
    }

    /** Satu pengumpulan yang sudah dinilai Mentor, agar halaman Tugas menampilkan nilai nyata. */
    private function seedGradedSubmission(User $student): void
    {
        $assignment = Assignment::query()
            ->where('title', 'Tugas 1: Struktur HTML dan CSS')
            ->where('status', Assignment::STATUS_APPROVED)
            ->first();
        if ($assignment === null) {
            return;
        }

        $submission = AssignmentSubmission::query()->firstOrCreate(
            ['assignment_id' => $assignment->id, 'user_id' => $student->id],
            [
                'submitted_at' => now()->subDays(3),
                'status' => AssignmentSubmission::STATUS_GRADED,
                'score' => 88,
                'feedback' => 'Struktur jawaban rapi. Perhatikan kembali perbedaan class dan id.',
                'graded_at' => now()->subDays(2),
            ],
        );

        if (! $submission->wasRecentlyCreated) {
            return;
        }

        foreach ($assignment->questions()->get() as $question) {
            $isChoice = $question->type === 'multiple_choice';

            AssignmentAnswer::query()->create([
                'submission_id' => $submission->id,
                'question_id' => $question->id,
                'answer_text' => $isChoice ? null : 'Class dapat dipakai berulang, id hanya sekali per halaman.',
                'selected_option_ids' => $isChoice ? array_slice($question->correct_option_ids ?? [], 0, 1) : [],
                'points_awarded' => (int) round($question->points * 0.88),
            ]);
        }

        // XP tugas diberikan saat pengumpulan (aturan 27 Okt 2026), termasuk untuk data contoh.
        if ($assignment->xp_points > 0) {
            app(XpService::class)->award($student, (int) $assignment->xp_points, XpService::SOURCE_TASK, $assignment->id, 'Mengumpulkan '.$assignment->kindLabel().': '.$assignment->title);
        }
    }
}
