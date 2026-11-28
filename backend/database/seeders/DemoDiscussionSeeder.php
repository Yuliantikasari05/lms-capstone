<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\CourseDiscussion;
use Illuminate\Database\Seeder;

/** Contoh forum diskusi: satu topik per kursus aktif beserta balasan Mentor dan peserta lain. */
class DemoDiscussionSeeder extends Seeder
{
    public function run(): void
    {
        $courses = Course::query()
            ->where('status', Course::STATUS_ACTIVE)
            ->with(['mentor', 'activeEnrollments.user'])
            ->get();

        $threads = 0;
        $replies = 0;

        foreach ($courses as $course) {
            $students = $course->activeEnrollments->pluck('user')->filter()->unique('id')->values();
            if ($students->isEmpty()) {
                continue;
            }

            $title = 'Tanya: materi '.$course->title;
            $discussion = $course->discussions()->where('title', $title)->first();

            if ($discussion === null) {
                $discussion = new CourseDiscussion([
                    'title' => $title,
                    'body' => 'Halo, saya ingin bertanya tentang materi pada '.$course->title
                        .'. Bagian mana yang paling penting untuk dipelajari lebih dulu?',
                ]);
                $discussion->course_id = $course->id;
                $discussion->user_id = $students->first()->id;
                $discussion->views = 14;
                $discussion->save();
                $threads++;
            }

            if ($discussion->replies()->exists()) {
                continue;
            }

            if ($course->mentor !== null) {
                $discussion->replies()->create([
                    'user_id' => $course->mentor->id,
                    'body' => 'Halo! Mulailah dari materi pertama, lalu kerjakan latihan di setiap modul. '
                        .'Jika ada bagian yang belum jelas, tuliskan di diskusi ini.',
                ]);
                $replies++;
            }

            $second = $students->get(1);
            if ($second !== null) {
                $discussion->replies()->create([
                    'user_id' => $second->id,
                    'body' => 'Terima kasih, saya juga merasa terbantu dengan penjelasan ini.',
                ]);
                $replies++;
            }
        }

        $this->command?->info("Diskusi demo: {$threads} topik, {$replies} balasan baru.");
    }
}
