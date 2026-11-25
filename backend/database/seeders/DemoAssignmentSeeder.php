<?php

namespace Database\Seeders;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Data contoh tugas, kuis, dan ujian untuk kursus demo (mengisi halaman Tugas dan Penilaian Mentor).
 *
 * Jalankan manual SETELAH DemoUserSeeder dan DemoCourseSeeder:
 *   php artisan db:seed --class=DemoAssignmentSeeder
 * Sengaja tidak masuk DatabaseSeeder agar `db:seed` biasa tidak membuat data contoh.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Aman dijalankan berulang: tugas dicocokkan lewat kursus + judul, pengumpulan lewat (tugas, peserta).
 * - Ujian dibuat "Menunggu persetujuan" agar alur review Admin terlihat apa adanya (bukan data palsu).
 * - Hapus data contoh:  Assignment::withTrashed()->whereIn('title', DemoAssignmentSeeder::titles())->forceDelete();
 */
class DemoAssignmentSeeder extends Seeder
{
    /** @return array<int,string> */
    public static function titles(): array
    {
        return array_column(self::definitions(), 'title');
    }

    /**
     * course: judul kursus demo. questions: [tipe, teks soal, opsi|null, opsi benar|null, poin].
     *
     * @return array<int, array<string, mixed>>
     */
    private static function definitions(): array
    {
        return [
            [
                'course' => 'Dasar Pemrograman Web',
                'title' => 'Tugas 1: Struktur HTML dan CSS',
                'kind' => Assignment::KIND_TASK,
                'description' => 'Kerjakan semua soal berikut. Tulis jawaban essay dengan kalimat Anda sendiri.',
                'due_in_days' => 7,
                'questions' => [
                    ['multiple_choice', 'Tag HTML manakah yang dipakai untuk membuat paragraf?', ['<p>', '<div>', '<span>'], ['<p>'], 40],
                    ['essay', 'Jelaskan perbedaan CSS class dan id beserta contoh penggunaannya.', null, null, 60],
                ],
            ],
            [
                'course' => 'Dasar Pemrograman Web',
                'title' => 'Kuis 1: Dasar JavaScript',
                'kind' => Assignment::KIND_QUIZ,
                'description' => 'Kuis singkat untuk memeriksa pemahaman variabel dan fungsi.',
                'due_in_days' => 4,
                'questions' => [
                    ['multiple_choice', 'Kata kunci manakah yang membuat variabel yang tidak dapat diubah nilainya?', ['var', 'let', 'const'], ['const'], 50],
                    ['multiple_choice', 'Fungsi manakah yang mencetak pesan ke konsol browser?', ['console.log()', 'alert()', 'document.write()'], ['console.log()'], 50],
                ],
            ],
            [
                'course' => 'Dasar Pemrograman Web',
                'title' => 'Ujian Akhir: Dasar Pemrograman Web',
                'kind' => Assignment::KIND_EXAM,
                'description' => 'Ujian akhir semester. Menunggu persetujuan Admin sebelum tampil ke peserta.',
                'due_in_days' => 14,
                'questions' => [
                    ['essay', 'Buatlah ringkasan alur request dari browser sampai server dan kembali lagi.', null, null, 100],
                ],
            ],
            [
                'course' => 'Excel untuk Karyawan',
                'title' => 'Tugas: Rekap Data Penjualan',
                'kind' => Assignment::KIND_TASK,
                'description' => 'Gunakan rumus SUM dan IF untuk merekap data penjualan bulanan.',
                'due_in_days' => 6,
                'questions' => [
                    ['multiple_choice', 'Fungsi manakah yang menjumlahkan rentang sel?', ['SUM', 'AVERAGE', 'COUNT'], ['SUM'], 50],
                    ['essay', 'Tuliskan langkah membuat tabel pivot dari data penjualan.', null, null, 50],
                ],
            ],
            [
                'course' => 'Webinar Karier di Era AI',
                'title' => 'Kuis: Keterampilan Era AI',
                'kind' => Assignment::KIND_QUIZ,
                'description' => 'Kuis singkat setelah webinar.',
                'due_in_days' => 3,
                'questions' => [
                    ['multiple_choice', 'Keterampilan manakah yang paling dibutuhkan di era AI?', ['Literasi data', 'Menghafal rumus', 'Mengetik cepat'], ['Literasi data'], 100],
                ],
            ],
        ];
    }

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoAssignmentSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('slug', \App\Models\Role::ADMIN))->oldest('id')->first();
        $created = 0;

        foreach (self::definitions() as $def) {
            $course = Course::query()->where('title', $def['course'])->first();
            if ($course === null) {
                continue;
            }

            $assignment = Assignment::query()
                ->where('course_id', $course->id)
                ->where('title', $def['title'])
                ->first() ?? new Assignment;

            $isNew = ! $assignment->exists;
            $assignment->fill([
                'course_id' => $course->id,
                'title' => $def['title'],
                'description' => $def['description'],
                'kind' => $def['kind'],
                'starts_at' => now()->subDays(2),
                'due_at' => now()->addDays($def['due_in_days']),
                'allow_late' => true,
                'late_penalty' => 10,
                'xp_points' => $course->allowsXp() ? 20 : 0,
                // Ujian menunggu review Admin; tugas dan kuis langsung tersedia.
                'status' => $def['kind'] === Assignment::KIND_EXAM ? Assignment::STATUS_PENDING : Assignment::STATUS_APPROVED,
                'is_active' => $def['kind'] !== Assignment::KIND_EXAM,
            ]);
            $assignment->created_by = $course->mentor_id ?? $admin?->id;
            $assignment->save();
            $created += $isNew ? 1 : 0;

            $this->seedQuestions($assignment, $def['questions']);
            $this->seedSubmissions($assignment);
        }

        $this->command?->info(count(self::definitions()).' tugas demo siap ('.$created.' baru).');
    }

    /** @param array<int, array{0:string,1:string,2:array<int,string>|null,3:array<int,string>|null,4:int}> $questions */
    private function seedQuestions(Assignment $assignment, array $questions): void
    {
        if ($assignment->questions()->exists()) {
            $assignment->max_score = $assignment->questions()->sum('points');
            $assignment->save();

            return;
        }

        foreach (array_values($questions) as $index => [$type, $prompt, $options, $correct, $points]) {
            $preparedOptions = $options === null ? [] : array_map(
                fn (string $text, int $i) => ['id' => $i + 1, 'text' => $text],
                $options,
                array_keys($options),
            );
            $correctIds = $correct === null ? [] : array_values(array_map(
                fn (string $text) => array_search($text, $options ?? [], true) + 1,
                $correct,
            ));

            $assignment->questions()->create([
                'type' => $type,
                'prompt' => $prompt,
                'options' => $preparedOptions,
                'correct_option_ids' => $correctIds,
                'multi_select' => false,
                'max_words' => $type === 'essay' ? 200 : null,
                'allowed_file_types' => [],
                'points' => $points,
                'position' => $index + 1,
            ]);
        }

        $assignment->max_score = $assignment->questions()->sum('points');
        $assignment->save();
    }

    /** Pengumpulan contoh dari peserta kursus: sebagian belum dinilai, sebagian sudah dinilai. */
    private function seedSubmissions(Assignment $assignment): void
    {
        $course = $assignment->course;
        $participants = Enrollment::query()
            ->where('course_id', $course->id)
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->with('user')
            ->limit(3)
            ->get();

        foreach ($participants as $index => $enrollment) {
            $user = $enrollment->user;
            if ($user === null) {
                continue;
            }

            $submission = AssignmentSubmission::query()
                ->where('assignment_id', $assignment->id)
                ->where('user_id', $user->id)
                ->first() ?? new AssignmentSubmission;

            if ($submission->exists) {
                continue;
            }

            $submission->fill([
                'assignment_id' => $assignment->id,
                'user_id' => $user->id,
                'submitted_at' => now()->subDays(2 - $index),
                'status' => $index === 0 ? AssignmentSubmission::STATUS_GRADED : AssignmentSubmission::STATUS_SUBMITTED,
                'score' => $index === 0 ? 85 : null,
                'feedback' => $index === 0 ? 'Jawaban sudah baik, perhatikan kembali penulisan istilah.' : null,
                'graded_at' => $index === 0 ? now()->subDay() : null,
            ]);
            $submission->save();

            foreach ($assignment->questions()->get() as $question) {
                $isChoice = $question->type === 'multiple_choice';
                $selected = $isChoice ? array_slice($question->correct_option_ids ?? [], 0, 1) : [];
                $correct = $isChoice && $selected === ($question->correct_option_ids ?? []);

                $submission->answers()->create([
                    'question_id' => $question->id,
                    'answer_text' => $isChoice ? null : 'Jawaban contoh peserta untuk soal ini.',
                    'selected_option_ids' => $selected,
                    'points_awarded' => $index === 0 ? ($correct ? $question->points : 0) : null,
                ]);
            }
        }
    }
}
