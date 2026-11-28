<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseDiscussion;
use App\Models\CourseDiscussionReply;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use App\Notifications\LearningNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class DiscussionApiTest extends TestCase
{
    use RefreshDatabase;

    private User $mentor;

    private Course $course;

    private User $student;

    private User $outsider;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();

        $this->mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Yuli Antika']);
        $this->course = Course::factory()->active()->mentoredBy($this->mentor)->create(['title' => 'Kimia Dasar']);

        $this->student = $this->userWithRole(Role::SISWA, ['name' => 'Putri Malika']);
        Enrollment::factory()->create([
            'course_id' => $this->course->id,
            'user_id' => $this->student->id,
            'status' => Enrollment::STATUS_ACTIVE,
        ]);

        $this->outsider = $this->userWithRole(Role::SISWA, ['name' => 'Siswa Lain']);
    }

    /** Berganti pelaku di tengah test (guard "sanctum" menyimpan pengguna request sebelumnya). */
    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    public function test_peserta_bisa_melihat_dan_membuat_diskusi(): void
    {
        $this->as($this->student)
            ->postJson("/api/v1/courses/{$this->course->id}/discussions", [
                'title' => 'Error saat praktikum',
                'body' => 'Saya tidak bisa membuka file praktikum.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Error saat praktikum')
            ->assertJsonPath('data.author.name', 'Putri Malika')
            ->assertJsonPath('data.is_own', true)
            ->assertJsonPath('data.replies_count', 0);

        $this->as($this->student)
            ->getJson("/api/v1/courses/{$this->course->id}/discussions")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_siswa_yang_tidak_terdaftar_tidak_bisa_mengakses_forum(): void
    {
        $this->as($this->outsider)
            ->getJson("/api/v1/courses/{$this->course->id}/discussions")
            ->assertForbidden();

        $this->as($this->outsider)
            ->postJson("/api/v1/courses/{$this->course->id}/discussions", [
                'title' => 'Menyusup',
                'body' => 'Seharusnya ditolak.',
            ])
            ->assertForbidden();
    }

    public function test_mentor_dan_admin_bisa_melihat_forum_kursusnya(): void
    {
        $admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji']);

        $this->as($this->mentor)->getJson("/api/v1/courses/{$this->course->id}/discussions")->assertOk();
        $this->as($admin)->getJson("/api/v1/courses/{$this->course->id}/discussions")->assertOk();
    }

    public function test_penulis_boleh_mengubah_tetapi_peserta_lain_tidak(): void
    {
        $discussion = $this->discussion();

        $this->as($this->student)
            ->patchJson("/api/v1/discussions/{$discussion->id}", [
                'title' => 'Judul diperbarui',
                'body' => 'Isi diperbarui.',
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Judul diperbarui');

        $this->as($this->outsider)
            ->patchJson("/api/v1/discussions/{$discussion->id}", [
                'title' => 'Tidak boleh',
                'body' => 'Tidak boleh.',
            ])
            ->assertForbidden();
    }

    public function test_mentor_dapat_menghapus_diskusi_peserta(): void
    {
        $discussion = $this->discussion();

        $this->as($this->mentor)
            ->deleteJson("/api/v1/discussions/{$discussion->id}")
            ->assertOk();

        $this->assertDatabaseMissing('course_discussions', ['id' => $discussion->id]);
    }

    public function test_peserta_bisa_membalas_dan_penulis_balasan_bisa_mengubah(): void
    {
        $discussion = $this->discussion();

        $replyId = $this->as($this->student)
            ->postJson("/api/v1/discussions/{$discussion->id}/replies", ['body' => 'Saya juga mengalami hal yang sama.'])
            ->assertCreated()
            ->assertJsonPath('data.is_own', true)
            ->json('data.id');

        $this->as($this->student)
            ->patchJson("/api/v1/discussion-replies/{$replyId}", ['body' => 'Sudah teratasi, terima kasih.'])
            ->assertOk()
            ->assertJsonPath('data.body', 'Sudah teratasi, terima kasih.');

        $this->as($this->outsider)
            ->patchJson("/api/v1/discussion-replies/{$replyId}", ['body' => 'Tidak boleh.'])
            ->assertForbidden();
    }

    public function test_mentor_dapat_menghapus_balasan_peserta(): void
    {
        $discussion = $this->discussion();
        $reply = new CourseDiscussionReply(['body' => 'Balasan peserta.']);
        $reply->course_discussion_id = $discussion->id;
        $reply->user_id = $this->student->id;
        $reply->save();

        $this->as($this->mentor)
            ->deleteJson("/api/v1/discussion-replies/{$reply->id}")
            ->assertOk();

        $this->assertDatabaseMissing('course_discussion_replies', ['id' => $reply->id]);
    }

    public function test_detail_diskusi_menambah_penghitung_dilihat(): void
    {
        $discussion = $this->discussion();
        $reply = new CourseDiscussionReply(['body' => 'Balasan peserta.']);
        $reply->course_discussion_id = $discussion->id;
        $reply->user_id = $this->student->id;
        $reply->save();

        $this->as($this->student)
            ->getJson("/api/v1/discussions/{$discussion->id}")
            ->assertOk()
            ->assertJsonPath('data.views', 1)
            ->assertJsonPath('data.replies_count', 1);
    }

    public function test_admin_tetap_dapat_memoderasi_forum_program_lembaga(): void
    {
        $lembaga = $this->userWithRole(Role::LEMBAGA);
        $course = Course::factory()->institution($lembaga)->create(['title' => 'Program Lembaga']);

        $discussion = new CourseDiscussion(['title' => 'Tanya program', 'body' => 'Bagaimana cara ikut?']);
        $discussion->course_id = $course->id;
        $discussion->user_id = $this->student->id;
        $discussion->save();

        $reply = new CourseDiscussionReply(['body' => 'Balasan peserta.']);
        $reply->course_discussion_id = $discussion->id;
        $reply->user_id = $this->student->id;
        $reply->save();

        $admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji']);

        $this->as($admin)
            ->deleteJson("/api/v1/discussion-replies/{$reply->id}")
            ->assertOk();

        $this->as($admin)
            ->deleteJson("/api/v1/discussions/{$discussion->id}")
            ->assertOk();

        $this->assertDatabaseMissing('course_discussion_replies', ['id' => $reply->id]);
        $this->assertDatabaseMissing('course_discussions', ['id' => $discussion->id]);
    }

    public function test_balasan_baru_memberi_notifikasi_kepada_penulis_diskusi(): void
    {
        Notification::fake();
        $discussion = $this->discussion();

        $this->as($this->mentor)
            ->postJson("/api/v1/discussions/{$discussion->id}/replies", ['body' => 'Coba buka modul pertama lebih dulu.'])
            ->assertCreated();

        Notification::assertSentTo(
            $this->student,
            LearningNotification::class,
            fn (LearningNotification $notification) => $notification->category === LearningNotification::CATEGORY_DISCUSSION
                && $notification->href === '/siswa/materials/'.$discussion->course_id
                && str_contains($notification->title, $discussion->title),
        );
    }

    public function test_balasan_pada_diskusi_sendiri_tidak_mengirim_notifikasi(): void
    {
        Notification::fake();
        $discussion = $this->discussion();

        $this->as($this->student)
            ->postJson("/api/v1/discussions/{$discussion->id}/replies", ['body' => 'Catatan tambahan dari saya.'])
            ->assertCreated();

        Notification::assertNothingSent();
    }

    public function test_judul_dan_isi_wajib_diisi(): void
    {
        $this->as($this->student)
            ->postJson("/api/v1/courses/{$this->course->id}/discussions", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'body']);
    }

    private function discussion(): CourseDiscussion
    {
        $discussion = new CourseDiscussion([
            'title' => 'Tanya: materi pertama',
            'body' => 'Bagian mana yang harus dipelajari lebih dulu?',
        ]);
        $discussion->course_id = $this->course->id;
        $discussion->user_id = $this->student->id;
        $discussion->save();

        return $discussion;
    }
}
