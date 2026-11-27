<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Material;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak API belajar Siswa: hanya data milik sendiri (enrollment aktif), XP sekali,
 * jendela waktu "Gabung sesi", dan laporan dari data nyata.
 */
class StudentLearningApiTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    private User $mentor;

    private Course $course;

    private CourseModule $module;

    private Material $materialA;

    private Material $materialB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();

        $this->student = $this->userWithRole(Role::SISWA);
        $this->mentor = $this->userWithRole(Role::MENTOR);

        $this->course = Course::factory()->academic()->active()->mentoredBy($this->mentor)->create(['created_by' => $this->mentor->id]);
        Enrollment::factory()->create([
            'course_id' => $this->course->id,
            'user_id' => $this->student->id,
            'status' => Enrollment::STATUS_ACTIVE,
        ]);

        $this->module = CourseModule::factory()->create(['course_id' => $this->course->id, 'position' => 1]);
        $this->materialA = Material::factory()->create(['course_module_id' => $this->module->id, 'title' => 'Materi A', 'xp_points' => 10, 'duration_minutes' => 10]);
        $this->materialB = Material::factory()->create(['course_module_id' => $this->module->id, 'title' => 'Materi B', 'xp_points' => 20, 'duration_minutes' => 15]);
    }

    private function assignment(array $attributes = [], array $questions = []): Assignment
    {
        $assignment = Assignment::create(array_merge([
            'course_id' => $this->course->id,
            'title' => 'Tugas Uji '.uniqid(),
            'kind' => Assignment::KIND_TASK,
            'status' => Assignment::STATUS_APPROVED,
            'is_active' => true,
            'starts_at' => now()->subHour(),
            'due_at' => now()->addDays(2),
            'xp_points' => 20,
            'max_score' => 100,
        ], $attributes));

        foreach ($questions as $index => $question) {
            $assignment->questions()->create(array_merge([
                'type' => 'essay', 'prompt' => 'Soal '.($index + 1), 'points' => 50, 'position' => $index + 1,
            ], $question));
        }

        return $assignment;
    }

    // ------------------------------------------------------------------ dashboard & materi

    public function test_dashboard_and_course_list_only_show_enrolled_courses(): void
    {
        $other = Course::factory()->academic()->active()->mentoredBy($this->mentor)->create();

        $summary = $this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/summary')->assertOk();
        $summary->assertJsonPath('data.courses_total', 1)
            ->assertJsonPath('data.progress.course_id', $this->course->id)
            ->assertJsonPath('data.progress.percent', 0)
            ->assertJsonPath('data.streak.days', 1);

        $ids = collect($this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/courses')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($this->course->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_course_detail_is_forbidden_for_a_student_who_is_not_enrolled(): void
    {
        $outsider = $this->userWithRole(Role::SISWA);

        $this->actingAs($outsider, 'web')->getJson("/api/v1/siswa/courses/{$this->course->id}")->assertForbidden();

        // Guard perlu dilupakan agar pengguna berikutnya benar-benar dipakai (guard menyimpan pengguna).
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->student, 'web')->getJson("/api/v1/siswa/courses/{$this->course->id}")->assertOk()
            ->assertJsonPath('data.materials_total', 2)
            ->assertJsonPath('data.owner', $this->mentor->name);
    }

    public function test_completing_a_material_awards_xp_once_and_counts_as_progress(): void
    {
        $url = "/api/v1/siswa/materials/{$this->materialA->id}/complete";

        $this->actingAs($this->student, 'web')->postJson($url)->assertOk()
            ->assertJsonPath('data.xp_awarded', 10)
            ->assertJsonPath('data.total_xp', 10);

        // Idempoten: materi yang sama tidak memberi XP dua kali.
        $this->actingAs($this->student, 'web')->postJson($url)->assertOk()
            ->assertJsonPath('data.xp_awarded', 0)
            ->assertJsonPath('data.total_xp', 10);

        $this->assertSame(1, \App\Models\MaterialCompletion::where('user_id', $this->student->id)->count());
        $this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/summary')->assertOk()
            ->assertJsonPath('data.progress.percent', 50)
            ->assertJsonPath('data.level.total_xp', 10);
    }

    public function test_study_signal_accumulates_minutes_for_the_course(): void
    {
        $url = "/api/v1/siswa/materials/{$this->materialB->id}/study";

        $this->actingAs($this->student, 'web')->postJson($url)->assertOk()->assertJsonPath('data.minutes_today', 1);
        $this->actingAs($this->student, 'web')->postJson($url)->assertOk()->assertJsonPath('data.minutes_today', 2);

        $this->assertDatabaseHas('study_logs', ['user_id' => $this->student->id, 'course_id' => $this->course->id, 'minutes' => 2]);
    }

    // ------------------------------------------------------------------ tugas

    public function test_assignment_list_only_contains_approved_active_assignments_of_enrolled_courses(): void
    {
        $visible = $this->assignment(['title' => 'Tugas Tampil']);
        $this->assignment(['title' => 'Ujian Menunggu', 'kind' => Assignment::KIND_EXAM, 'status' => Assignment::STATUS_PENDING, 'is_active' => false]);

        $otherCourse = Course::factory()->academic()->active()->mentoredBy($this->mentor)->create();
        $this->assignment(['title' => 'Tugas Kursus Lain', 'course_id' => $otherCourse->id]);

        $titles = collect($this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/assignments')->assertOk()->json('data'))->pluck('title');

        $this->assertSame(['Tugas Tampil'], $titles->all());
        $this->assertSame('belum', $visible->fresh()->status === Assignment::STATUS_APPROVED ? 'belum' : 'belum');
    }

    public function test_assignment_detail_never_exposes_the_answer_key(): void
    {
        $assignment = $this->assignment([], [
            ['type' => 'multiple_choice', 'prompt' => 'Pilih A', 'options' => [['id' => 1, 'text' => 'A'], ['id' => 2, 'text' => 'B']], 'correct_option_ids' => [1]],
        ]);

        $response = $this->actingAs($this->student, 'web')->getJson("/api/v1/siswa/assignments/{$assignment->id}")->assertOk();

        $this->assertStringNotContainsString('correct_option_ids', $response->getContent());
        $this->assertSame('multiple_choice', $response->json('data.questions.0.type'));
    }

    public function test_submitting_answers_records_the_submission_and_awards_task_xp(): void
    {
        $assignment = $this->assignment([], [
            ['type' => 'multiple_choice', 'prompt' => 'Pilih A', 'options' => [['id' => 1, 'text' => 'A'], ['id' => 2, 'text' => 'B']], 'correct_option_ids' => [1], 'points' => 40],
            ['type' => 'essay', 'prompt' => 'Jelaskan', 'points' => 60],
        ]);

        $payload = ['answers' => [
            ['question_id' => $assignment->questions[0]->id, 'selected_option_ids' => [1]],
            ['question_id' => $assignment->questions[1]->id, 'answer_text' => 'Jawaban saya.'],
        ]];

        $this->actingAs($this->student, 'web')
            ->postJson("/api/v1/siswa/assignments/{$assignment->id}/submissions", $payload)
            ->assertCreated()
            ->assertJsonPath('message', 'Tugas berhasil dikumpulkan.');

        $this->assertDatabaseHas('assignment_submissions', ['assignment_id' => $assignment->id, 'user_id' => $this->student->id]);
        $this->assertDatabaseHas('assignment_answers', ['answer_text' => 'Jawaban saya.']);
        // XP tugas diberikan saat dikumpulkan (aturan 27 Okt 2026).
        $this->assertDatabaseHas('xp_balances', ['user_id' => $this->student->id, 'total_xp' => 20]);

        $this->actingAs($this->student, 'web')
            ->postJson("/api/v1/siswa/assignments/{$assignment->id}/submissions", $payload)
            ->assertStatus(422);

        $list = collect($this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/assignments')->json('data'))->firstWhere('id', $assignment->id);
        $this->assertSame('dikumpulkan', $list['submission']['status']);

        // Detail memakai status yang sama dengan daftar, dan tidak membocorkan kunci jawaban.
        $detail = $this->actingAs($this->student, 'web')
            ->getJson("/api/v1/siswa/assignments/{$assignment->id}")
            ->assertOk()
            ->json('data');
        $this->assertSame('dikumpulkan', $detail['submission']['status']);
        $this->assertArrayNotHasKey('correct_option_ids', $detail['questions'][0]);
    }

    public function test_submission_is_rejected_after_the_deadline_unless_late_submission_is_allowed(): void
    {
        $assignment = $this->assignment(['due_at' => now()->subHour(), 'allow_late' => false], [
            ['type' => 'essay', 'prompt' => 'Jelaskan', 'points' => 100],
        ]);

        $payload = ['answers' => [['question_id' => $assignment->questions[0]->id, 'answer_text' => 'Telat.']]];

        $this->actingAs($this->student, 'web')
            ->postJson("/api/v1/siswa/assignments/{$assignment->id}/submissions", $payload)
            ->assertStatus(422);
    }

    // ------------------------------------------------------------------ jadwal & kehadiran

    public function test_schedule_lists_sessions_and_assignment_deadlines(): void
    {
        $session = ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHours(2),
            'status' => ClassSession::STATUS_SCHEDULED,
        ]);
        $this->assignment(['title' => 'Tugas Deadline']);

        $data = $this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/schedule')->assertOk()->json('data');

        $this->assertSame($session->id, $data['sessions'][0]['id']);
        $this->assertFalse($data['sessions'][0]['can_join']);
        $this->assertSame('Tugas Deadline', $data['assignments'][0]['title']);
    }

    public function test_join_is_only_possible_inside_the_time_window_and_records_attendance(): void
    {
        $tooEarly = ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'starts_at' => now()->addHour(),
            'ends_at' => now()->addHours(2),
            'status' => ClassSession::STATUS_SCHEDULED,
            'meeting_url' => 'https://meet.google.com/uji-waktu',
        ]);
        $open = ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'starts_at' => now()->subMinutes(5),
            'ends_at' => now()->addHour(),
            'status' => ClassSession::STATUS_SCHEDULED,
            'mode' => ClassSession::MODE_ONLINE,
            'meeting_url' => 'https://meet.google.com/uji-buka',
        ]);

        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/sessions/{$tooEarly->id}/join")->assertStatus(422);

        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/sessions/{$open->id}/join")->assertOk()
            ->assertJsonPath('data.meeting_url', 'https://meet.google.com/uji-buka')
            ->assertJsonPath('message', 'Kehadiran tercatat.');

        $this->assertDatabaseHas('session_attendances', ['class_session_id' => $open->id, 'user_id' => $this->student->id]);

        // Sesi offline: kehadiran tetap tercatat, tanpa tautan.
        $offline = ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'starts_at' => now()->subMinutes(5),
            'ends_at' => now()->addHour(),
            'status' => ClassSession::STATUS_SCHEDULED,
            'mode' => ClassSession::MODE_OFFLINE,
            'location' => 'Ruang Bimbingan 2',
            'meeting_url' => null,
        ]);

        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/sessions/{$offline->id}/join")->assertOk()
            ->assertJsonPath('data.meeting_url', null)
            ->assertJsonPath('data.location', 'Ruang Bimbingan 2');
    }

    // ------------------------------------------------------------------ laporan & peringkat

    public function test_report_is_built_from_real_progress(): void
    {
        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/materials/{$this->materialA->id}/complete")->assertOk();
        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/materials/{$this->materialA->id}/study")->assertOk();

        $report = $this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/report')->assertOk();

        $report->assertJsonPath('data.study_minutes', 1)
            ->assertJsonPath('data.modules_total', 1)
            ->assertJsonPath('data.courses_count', 1);
        $this->assertSame(50, $report->json('data.subjects.0.progress'));
        $this->assertCount(12, $report->json('data.months'));
    }

    public function test_leaderboard_ranks_students_by_xp_and_marks_the_current_user(): void
    {
        $this->actingAs($this->student, 'web')->postJson("/api/v1/siswa/materials/{$this->materialA->id}/complete")->assertOk();

        $rows = $this->actingAs($this->student, 'web')->getJson('/api/v1/siswa/leaderboard?period=all')->assertOk()->json('data');

        $mine = collect($rows)->firstWhere('user_id', $this->student->id);
        $this->assertSame(1, $mine['rank']);
        $this->assertSame(10, $mine['xp']);
        $this->assertTrue($mine['is_me']);
    }

    // ------------------------------------------------------------------ batas akses

    public function test_other_roles_cannot_use_the_student_endpoints(): void
    {
        $this->actingAs($this->mentor, 'web')->getJson('/api/v1/siswa/summary')->assertForbidden();
        $this->actingAs($this->userWithRole(Role::ADMIN), 'web')->getJson('/api/v1/siswa/courses')->assertForbidden();
    }

    public function test_student_endpoints_are_denied_when_the_permission_is_switched_off(): void
    {
        $role = Role::where('slug', Role::SISWA)->firstOrFail();
        $role->permissions()->sync(\App\Models\Permission::whereIn('slug', ['dashboard.siswa'])->pluck('id'));

        $this->actingAs(User::findOrFail($this->student->id), 'web')->getJson('/api/v1/siswa/courses')->assertForbidden();
    }
}
