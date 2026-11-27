<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentQuestion;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Notifikasi per peran: penerima ditentukan izin + kepemilikan data, bukan daftar role tetap.
 *
 * - Mentor hanya diberi tahu pengumpulan pada kursus yang diampu dan hanya bila masih berhak menilai.
 * - Admin hanya diberi tahu ujian yang menunggu review bila memegang izin `assignments.review`.
 */
class NotificationDeliveryTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $mentor;

    private User $student;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();

        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji']);
        $this->mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Mentor Uji']);
        $this->student = $this->userWithRole(Role::SISWA, ['name' => 'Siswa Uji']);

        $this->course = Course::factory()->academic()->active()->mentoredBy($this->mentor)->create(['title' => 'Kursus Uji']);
        Enrollment::factory()->create([
            'course_id' => $this->course->id,
            'user_id' => $this->student->id,
            'status' => Enrollment::STATUS_ACTIVE,
        ]);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs(User::findOrFail($user->id), 'web');
    }

    private function assignment(string $kind = Assignment::KIND_TASK, string $status = Assignment::STATUS_APPROVED): Assignment
    {
        $assignment = new Assignment([
            'title' => 'Tugas Uji',
            'kind' => $kind,
            'status' => $status,
            'is_active' => true,
            'xp_points' => 0,
        ]);
        $assignment->course_id = $this->course->id;
        $assignment->created_by = $this->mentor->id;
        $assignment->save();

        $assignment->questions()->create([
            'type' => AssignmentQuestion::TYPE_ESSAY,
            'prompt' => 'Jelaskan.',
            'points' => 10,
            'position' => 1,
        ]);

        return $assignment;
    }

    private function submit(User $student, Assignment $assignment)
    {
        return $this->as($student)->postJson("/api/v1/siswa/assignments/{$assignment->id}/submissions", [
            'answers' => [['question_id' => $assignment->questions()->value('id'), 'answer_text' => 'Jawaban saya.']],
        ]);
    }

    private function unreadTitles(User $user): array
    {
        return $user->fresh()->notifications()->get()
            ->map(fn ($notification) => $notification->data['title'] ?? '')
            ->all();
    }

    public function test_the_course_mentor_is_notified_when_a_student_submits(): void
    {
        $assignment = $this->assignment();

        $this->submit($this->student, $assignment)->assertCreated();

        $notification = $this->mentor->fresh()->notifications()->sole();
        $this->assertSame('submission', $notification->data['category']);
        $this->assertSame('Tugas menunggu penilaian: Tugas Uji', $notification->data['title']);
        $this->assertSame('/mentor/assignments', $notification->data['href']);
        $this->assertSame('Siswa Uji', $notification->data['actor_name']);
        $this->assertNull($notification->read_at);

        $this->assertSame(0, $this->admin->fresh()->notifications()->count(), 'Admin tidak menerima antrean penilaian Mentor.');
    }

    public function test_no_mentor_notification_when_the_grading_permission_is_off(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()
            ->detach(Permission::where('slug', 'assignments.grade')->value('id'));

        $this->submit($this->student, $this->assignment())->assertCreated();

        $this->assertSame(0, $this->mentor->fresh()->notifications()->count());
    }

    public function test_another_mentor_is_not_notified_for_a_course_they_do_not_mentor(): void
    {
        $other = $this->userWithRole(Role::MENTOR);

        $this->submit($this->student, $this->assignment())->assertCreated();

        $this->assertSame(0, $other->fresh()->notifications()->count());
        $this->assertCount(1, $this->unreadTitles($this->mentor));
    }

    public function test_only_reviewers_are_notified_when_a_mentor_submits_an_exam(): void
    {
        $payload = [
            'title' => 'Ujian Uji',
            'kind' => Assignment::KIND_EXAM,
            'questions' => [['type' => 'essay', 'prompt' => 'Jelaskan.', 'points' => 20]],
        ];

        $this->as($this->mentor)->postJson("/api/v1/courses/{$this->course->id}/assignments", $payload)->assertCreated();

        $notification = $this->admin->fresh()->notifications()->sole();
        $this->assertSame('assessment', $notification->data['category']);
        $this->assertSame('Ujian menunggu review: Ujian Uji', $notification->data['title']);
        $this->assertSame('/admin/courses', $notification->data['href']);
        $this->assertSame(0, $this->mentor->fresh()->notifications()->count(), 'Mentor tidak menerima notifikasi pengajuannya sendiri.');
    }

    public function test_the_mentor_learns_the_review_decision(): void
    {
        $assignment = $this->assignment(Assignment::KIND_EXAM, Assignment::STATUS_PENDING);

        $this->as($this->admin)->postJson("/api/v1/assignments/{$assignment->id}/review", [
            'decision' => 'approve',
        ])->assertOk();

        $notification = $this->mentor->fresh()->notifications()->sole();
        $this->assertSame('Ujian disetujui: Tugas Uji', $notification->data['title']);
        $this->assertSame('Admin Uji', $notification->data['actor_name']);
        $this->assertSame('/mentor/assignments', $notification->data['href']);
    }

    public function test_enrolling_a_participant_notifies_the_mentor_and_the_participant(): void
    {
        $newcomer = $this->userWithRole(Role::SISWA, ['name' => 'Peserta Baru']);

        $this->as($this->admin)->postJson("/api/v1/courses/{$this->course->id}/enrollments", [
            'user_ids' => [$newcomer->id],
        ])->assertCreated();

        $mentorNotification = $this->mentor->fresh()->notifications()->sole();
        $this->assertSame('roster', $mentorNotification->data['category']);
        $this->assertSame('Peserta baru di Kursus Uji', $mentorNotification->data['title']);
        $this->assertSame("/mentor/courses/{$this->course->id}", $mentorNotification->data['href']);

        $studentNotification = $newcomer->fresh()->notifications()->sole();
        $this->assertSame('system', $studentNotification->data['category']);
        $this->assertSame('Kamu terdaftar di Kursus Uji', $studentNotification->data['title']);
    }

    public function test_a_course_created_by_a_mentor_notifies_admins_with_the_course_permission(): void
    {
        $otherMentor = $this->userWithRole(Role::MENTOR);

        $this->as($this->mentor)->postJson('/api/v1/courses', [
            'type' => Course::TYPE_ACADEMIC,
            'title' => 'Kursus Baru Mentor',
        ])->assertCreated();

        $notification = $this->admin->fresh()->notifications()->sole();
        $this->assertSame('Kursus baru dari Mentor: Kursus Baru Mentor', $notification->data['title']);
        $this->assertSame('/admin/courses', $notification->data['href']);
        $this->assertSame(0, $otherMentor->fresh()->notifications()->count(), 'Mentor lain tidak menerima notifikasi kursus rekan.');

        // Izin `courses.view` dimatikan: pembuatan kursus berikutnya tidak lagi menghasilkan notifikasi Admin.
        Role::where('slug', Role::ADMIN)->firstOrFail()->permissions()
            ->detach(Permission::where('slug', 'courses.view')->value('id'));

        $this->as($this->mentor)->postJson('/api/v1/courses', [
            'type' => Course::TYPE_ACADEMIC,
            'title' => 'Kursus Kedua Mentor',
        ])->assertCreated();

        $this->assertSame(1, $this->admin->fresh()->notifications()->count());
    }
}
