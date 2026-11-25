<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Tugas, kuis, ujian: pembuatan soal, review Admin untuk ujian, dan penilaian pengumpulan. */
class AssignmentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mentor;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
        $this->mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Rina Kusumawati']);
        $this->course = Course::factory()->active()->mentoredBy($this->mentor)->create(['title' => 'Dasar Pemrograman Web']);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    /** @return array<string, mixed> */
    private function payload(array $override = []): array
    {
        return array_merge([
            'title' => 'Tugas 1: Ejaan',
            'description' => 'Kerjakan semua soal.',
            'kind' => 'task',
            'starts_at' => '2026-12-01T08:00:00+07:00',
            'due_at' => '2026-12-08T23:59:00+07:00',
            'max_score' => 100,
            'questions' => [
                [
                    'type' => 'multiple_choice',
                    'prompt' => 'Manakah penulisan kata depan yang tepat?',
                    'options' => [
                        ['id' => 1, 'text' => 'di atas meja'],
                        ['id' => 2, 'text' => 'diatas meja'],
                    ],
                    'correct_option_ids' => [1],
                    'points' => 40,
                ],
                [
                    'type' => 'essay',
                    'prompt' => 'Perbaiki kalimat berikut.',
                    'max_words' => 50,
                    'points' => 60,
                ],
            ],
        ], $override);
    }

    public function test_a_mentor_creates_a_task_that_is_immediately_available(): void
    {
        $this->as($this->mentor)
            ->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload())
            ->assertCreated()
            ->assertJsonPath('message', 'Tugas berhasil dibuat.')
            ->assertJsonPath('data.kind', 'task')
            ->assertJsonPath('data.kind_label', 'Tugas')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.format', 'Mix')
            ->assertJsonPath('data.questions.0.type', 'multiple_choice')
            ->assertJsonPath('data.questions.0.type_label', 'Pilihan ganda')
            ->assertJsonPath('data.questions.0.options.0.id', 1)
            ->assertJsonPath('data.questions.1.type', 'essay');

        $assignment = Assignment::firstOrFail();
        $this->assertSame($this->course->id, $assignment->course_id);
        $this->assertSame($this->mentor->id, $assignment->created_by);
        $this->assertSame('approved', $assignment->status);
        $this->assertSame(2, $assignment->questions()->count());
    }

    public function test_an_exam_waits_for_admin_review_before_it_can_be_activated(): void
    {
        $this->as($this->mentor)
            ->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload(['kind' => 'exam', 'title' => 'Ujian Akhir']))
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.status_label', 'Menunggu persetujuan');

        $assignment = Assignment::firstOrFail();

        $this->as($this->mentor)
            ->patchJson('/api/v1/assignments/'.$assignment->id.'/activation', ['is_active' => true])
            ->assertStatus(422);

        // Mentor tidak berhak menyetujui ujiannya sendiri.
        $this->as($this->mentor)
            ->postJson('/api/v1/assignments/'.$assignment->id.'/review', ['decision' => 'approve'])
            ->assertForbidden();

        $this->as($this->admin)
            ->postJson('/api/v1/assignments/'.$assignment->id.'/review', ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.is_active', true);

        $this->assertNotNull($assignment->fresh()->reviewed_at);
    }

    public function test_validation_requires_a_title_and_at_least_one_question(): void
    {
        $this->as($this->mentor)
            ->postJson('/api/v1/courses/'.$this->course->id.'/assignments', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'kind', 'questions']);

        $this->as($this->mentor)
            ->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload([
                'questions' => [['type' => 'multiple_choice', 'prompt' => 'Satu opsi saja?', 'options' => [['id' => 1, 'text' => 'A']], 'points' => 10]],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['questions.0.options']);

        $this->as($this->mentor)
            ->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload(['due_at' => '2026-11-01T08:00:00+07:00']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['due_at']);
    }

    public function test_the_list_only_contains_assignments_of_the_mentors_own_courses(): void
    {
        $otherMentor = $this->userWithRole(Role::MENTOR, ['email' => 'lain@example.test']);
        $otherCourse = Course::factory()->active()->mentoredBy($otherMentor)->create();

        Assignment::create(['course_id' => $this->course->id, 'title' => 'Milik Saya', 'kind' => Assignment::KIND_TASK, 'status' => Assignment::STATUS_APPROVED]);
        Assignment::create(['course_id' => $otherCourse->id, 'title' => 'Milik Lain', 'kind' => Assignment::KIND_TASK, 'status' => Assignment::STATUS_APPROVED]);

        $response = $this->as($this->mentor)->getJson('/api/v1/assignments')->assertOk();

        $this->assertSame(['Milik Saya'], collect($response->json('data'))->pluck('title')->all());
        $this->as($this->admin)->getJson('/api/v1/assignments')->assertOk()->assertJsonCount(2, 'data');
        $this->as($this->mentor)->getJson('/api/v1/assignments?course_id='.$otherCourse->id)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_a_mentor_cannot_touch_another_mentors_assignment(): void
    {
        $otherMentor = $this->userWithRole(Role::MENTOR, ['email' => 'lain@example.test']);
        $otherCourse = Course::factory()->active()->mentoredBy($otherMentor)->create();
        $foreign = Assignment::create(['course_id' => $otherCourse->id, 'title' => 'Punya Lain', 'kind' => Assignment::KIND_TASK, 'status' => Assignment::STATUS_APPROVED]);

        $this->as($this->mentor)->patchJson('/api/v1/assignments/'.$foreign->id, ['title' => 'Curang'])->assertForbidden();
        $this->as($this->mentor)->patchJson('/api/v1/assignments/'.$foreign->id.'/activation', ['is_active' => false])->assertForbidden();
        $this->as($this->mentor)->deleteJson('/api/v1/assignments/'.$foreign->id)->assertForbidden();
        $this->as($this->mentor)->getJson('/api/v1/assignments/'.$foreign->id.'/submissions')->assertForbidden();
        $this->as($this->mentor)->postJson('/api/v1/courses/'.$otherCourse->id.'/assignments', $this->payload())->assertForbidden();
    }

    public function test_activation_and_soft_delete_are_logged(): void
    {
        $this->as($this->mentor)->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload())->assertCreated();
        $assignment = Assignment::firstOrFail();

        $this->as($this->mentor)->patchJson('/api/v1/assignments/'.$assignment->id.'/activation', ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);

        $this->as($this->mentor)->deleteJson('/api/v1/assignments/'.$assignment->id)
            ->assertOk()->assertJsonPath('message', 'Tugas berhasil dihapus.');

        $this->assertSoftDeleted($assignment);
    }

    public function test_a_mentor_lists_and_grades_submissions_of_own_course(): void
    {
        $this->as($this->mentor)->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload())->assertCreated();
        $assignment = Assignment::firstOrFail();
        $student = $this->userWithRole(Role::SISWA, ['name' => 'Adi Saputra']);

        $submission = AssignmentSubmission::create([
            'assignment_id' => $assignment->id,
            'user_id' => $student->id,
            'submitted_at' => now(),
            'status' => AssignmentSubmission::STATUS_SUBMITTED,
        ]);
        $submission->answers()->create([
            'question_id' => $assignment->questions()->first()->id,
            'selected_option_ids' => [1],
        ]);

        $this->as($this->mentor)
            ->getJson('/api/v1/assignments/'.$assignment->id.'/submissions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.user.name', 'Adi Saputra')
            ->assertJsonPath('data.0.status_label', 'Belum dinilai')
            ->assertJsonPath('data.0.assignment.course_title', 'Dasar Pemrograman Web');

        $this->as($this->mentor)
            ->patchJson('/api/v1/submissions/'.$submission->id, ['score' => 85, 'feedback' => 'Kerja bagus.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'graded')
            ->assertJsonPath('data.status_label', 'Sudah dinilai')
            ->assertJsonPath('data.score', 85)
            ->assertJsonPath('data.feedback', 'Kerja bagus.');

        $this->assertSame($this->mentor->id, $submission->fresh()->graded_by);
    }

    public function test_other_roles_cannot_use_the_assignment_endpoints(): void
    {
        $assignment = Assignment::create(['course_id' => $this->course->id, 'title' => 'Tugas', 'kind' => Assignment::KIND_TASK, 'status' => Assignment::STATUS_APPROVED]);

        foreach ([Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $role) {
            $actor = $this->userWithRole($role);
            $this->as($actor)->getJson('/api/v1/assignments')->assertForbidden();
            $this->as($actor)->postJson('/api/v1/courses/'.$this->course->id.'/assignments', $this->payload())->assertForbidden();
            $this->as($actor)->patchJson('/api/v1/assignments/'.$assignment->id, ['title' => 'X'])->assertForbidden();
        }

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/assignments')->assertUnauthorized();
    }
}
