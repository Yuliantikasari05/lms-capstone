<?php

namespace Tests\Feature;

use App\Http\Resources\ClassSessionResource;
use App\Models\AuditLog;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SessionApiTest extends TestCase
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
        $this->mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Yuli Antika']);
        $this->course = Course::factory()->active()->mentoredBy($this->mentor)->create(['title' => 'Kursus Uji']);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    private function asAdmin(): static
    {
        return $this->as($this->admin);
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'title' => 'Pertemuan 1',
            'starts_at' => '2026-12-01T09:00:00+07:00',
            'ends_at' => '2026-12-01T11:00:00+07:00',
            'meeting_url' => 'https://meet.google.com/abc-defg-hij?pwd=RAHASIA123',
        ], $override);
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ daftar dan detail

    public function test_index_lists_sessions_by_start_time_with_instructor_and_type(): void
    {
        ClassSession::factory()->create(['course_id' => $this->course->id, 'title' => 'Kedua', 'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(2)->addHour()]);
        ClassSession::factory()->create(['course_id' => $this->course->id, 'title' => 'Pertama', 'starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addHour()]);
        ClassSession::factory()->create(['course_id' => $this->course->id, 'title' => 'Dihapus'])->delete();

        $response = $this->asAdmin()->getJson('/api/v1/courses/'.$this->course->id.'/sessions')->assertOk();

        $this->assertSame(['Pertama', 'Kedua'], collect($response->json('data'))->pluck('title')->all());
        $response->assertJsonPath('data.0.type', 'class')
            ->assertJsonPath('data.0.type_label', 'Kelas')
            ->assertJsonPath('data.0.instructor.name', 'Yuli Antika')
            ->assertJsonPath('data.0.status', 'upcoming')
            ->assertJsonPath('data.0.course_id', $this->course->id);
    }

    public function test_session_type_and_status_follow_the_course_and_the_clock(): void
    {
        $webinar = Course::factory()->webinar()->active()->mentoredBy($this->mentor)->create();
        $training = Course::factory()->training()->active()->mentoredBy($this->mentor)->create();
        $past = ClassSession::factory()->create(['course_id' => $webinar->id, 'starts_at' => now()->subDays(2), 'ends_at' => now()->subDays(2)->addHour()]);
        $live = ClassSession::factory()->create(['course_id' => $training->id, 'starts_at' => now()->subMinutes(10), 'ends_at' => now()->addMinutes(50)]);

        $this->asAdmin()->getJson('/api/v1/sessions/'.$past->id)->assertOk()
            ->assertJsonPath('data.type', 'webinar')->assertJsonPath('data.type_label', 'Webinar')->assertJsonPath('data.status', 'finished');
        $this->asAdmin()->getJson('/api/v1/sessions/'.$live->id)->assertOk()
            ->assertJsonPath('data.type', 'training')->assertJsonPath('data.type_label', 'Pelatihan')->assertJsonPath('data.status', 'ongoing');
    }

    public function test_a_course_without_a_mentor_has_a_null_instructor(): void
    {
        $course = Course::factory()->create();
        $session = ClassSession::factory()->create(['course_id' => $course->id]);

        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id)->assertOk()->assertJsonPath('data.instructor', null);
    }

    public function test_show_returns_404_for_missing_or_deleted_sessions(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);

        $this->asAdmin()->getJson('/api/v1/sessions/999999')->assertNotFound();

        $session->delete();
        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id)->assertNotFound();
    }

    // ------------------------------------------------------------------ tambah

    public function test_creating_a_session_stores_the_schedule_and_logs_it(): void
    {
        $this->asAdmin()->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload())
            ->assertCreated()
            ->assertJsonPath('message', 'Sesi berhasil dibuat.')
            ->assertJsonPath('data.title', 'Pertemuan 1')
            ->assertJsonPath('data.meeting_url', 'https://meet.google.com/abc-defg-hij?pwd=RAHASIA123');

        $session = ClassSession::firstOrFail();
        $this->assertSame($this->course->id, $session->course_id);
        $this->assertSame('2026-12-01 09:00:00', $session->starts_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-12-01 11:00:00', $session->ends_at->format('Y-m-d H:i:s'));

        $log = $this->lastLog('session.created');
        $this->assertSame('Pertemuan 1', $log->target_label);
        $this->assertSame('class_session', $log->target_type);
        $this->assertSame($this->course->id, $log->changes['course_id']);
    }

    public function test_times_with_other_offsets_are_converted_to_the_app_timezone(): void
    {
        // Browser mengirim UTC ("Z"): 02:00 UTC = 09:00 WIB (Asia/Jakarta, UTC+7).
        $this->asAdmin()->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload([
            'starts_at' => '2026-12-01T02:00:00Z', 'ends_at' => '2026-12-01T04:00:00.000Z',
        ]))->assertCreated()
            ->assertJsonPath('data.starts_at', '2026-12-01T09:00:00+07:00')
            ->assertJsonPath('data.ends_at', '2026-12-01T11:00:00+07:00');

        $this->assertSame('2026-12-01 09:00:00', ClassSession::firstOrFail()->starts_at->format('Y-m-d H:i:s'));
    }

    public function test_session_validation(): void
    {
        $url = '/api/v1/courses/'.$this->course->id.'/sessions';

        $this->asAdmin()->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['title', 'starts_at', 'ends_at', 'meeting_url']);
        $this->asAdmin()->postJson($url, $this->payload(['title' => str_repeat('a', 151)]))->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->asAdmin()->postJson($url, $this->payload(['starts_at' => 'bukan tanggal']))->assertStatus(422)->assertJsonValidationErrors(['starts_at']);

        foreach (['javascript:alert(1)', 'ftp://a.test/x', 'bukan url', 'data:text/html,<script>'] as $bad) {
            $this->asAdmin()->postJson($url, $this->payload(['meeting_url' => $bad]))->assertStatus(422)->assertJsonValidationErrors(['meeting_url']);
        }

        $this->assertSame(0, ClassSession::count());
    }

    public function test_the_end_must_be_after_the_start(): void
    {
        $url = '/api/v1/courses/'.$this->course->id.'/sessions';

        $this->asAdmin()->postJson($url, $this->payload(['ends_at' => '2026-12-01T09:00:00+07:00']))->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
        $this->asAdmin()->postJson($url, $this->payload(['ends_at' => '2026-12-01T08:00:00+07:00']))->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
        // Dibandingkan sebagai waktu absolut, bukan teks: 02:00Z = 09:00+07:00 (sama), 01:00Z lebih awal.
        $this->asAdmin()->postJson($url, $this->payload(['starts_at' => '2026-12-01T09:00:00+07:00', 'ends_at' => '2026-12-01T01:00:00Z']))->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
        $this->asAdmin()->postJson($url, $this->payload(['starts_at' => '2026-12-01T09:00:00+07:00', 'ends_at' => '2026-12-01T03:00:00Z']))->assertCreated();
    }

    // ------------------------------------------------------------------ ubah

    public function test_update_logs_changes_but_never_the_meeting_url(): void
    {
        $session = ClassSession::factory()->create([
            'course_id' => $this->course->id, 'title' => 'Lama', 'meeting_url' => 'https://zoom.us/j/111?pwd=LAMA',
            'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 11:00:00',
        ]);

        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['title' => 'Baru', 'meeting_url' => 'https://zoom.us/j/222?pwd=BARU'])
            ->assertOk()->assertJsonPath('message', 'Sesi berhasil diperbarui.')->assertJsonPath('data.title', 'Baru');

        $log = $this->lastLog('session.updated');
        $this->assertSame(['title' => 'Lama'], $log->changes['before']);
        $this->assertSame(['title' => 'Baru'], $log->changes['after']);
        $this->assertTrue($log->changes['meeting_url_changed']);
        $dump = json_encode(AuditLog::all()->toArray());
        foreach (['LAMA', 'BARU', 'zoom.us'] as $secret) {
            $this->assertStringNotContainsString($secret, $dump, 'Link meeting tidak boleh masuk audit log.');
        }
    }

    public function test_partial_update_and_no_op(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id, 'title' => 'Sama', 'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 11:00:00']);

        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['ends_at' => '2026-12-01T13:00:00+07:00'])->assertOk()->assertJsonPath('data.ends_at', '2026-12-01T13:00:00+07:00');
        $count = AuditLog::count();
        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['title' => 'Sama'])->assertOk();
        $this->assertSame($count, AuditLog::count(), 'Tanpa perubahan tidak ada catatan.');
    }

    public function test_update_cannot_make_the_end_earlier_than_the_start(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id, 'starts_at' => '2026-12-01 09:00:00', 'ends_at' => '2026-12-01 11:00:00']);

        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['ends_at' => '2026-12-01T08:00:00+07:00'])->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['starts_at' => '2026-12-01T12:00:00+07:00'])->assertStatus(422)->assertJsonValidationErrors(['ends_at']);
    }

    public function test_update_validates_input(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);

        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['title' => ''])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['meeting_url' => 'javascript:alert(1)'])->assertStatus(422)->assertJsonValidationErrors(['meeting_url']);
    }

    // ------------------------------------------------------------------ hapus

    public function test_delete_is_soft_and_logged(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id, 'title' => 'Hapus Saya']);

        $this->asAdmin()->deleteJson('/api/v1/sessions/'.$session->id)->assertOk()->assertJsonPath('message', 'Sesi berhasil dihapus.');

        $this->assertSoftDeleted($session);
        $this->assertSame('Hapus Saya', $this->lastLog('session.deleted')->target_label);
    }

    // ------------------------------------------------------------------ link meeting

    public function test_meeting_link_is_served_by_its_own_endpoint_and_not_cached(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id, 'meeting_url' => 'https://meet.google.com/xyz']);

        $response = $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id.'/meeting-link')->assertOk();

        $response->assertJsonPath('data.meeting_url', 'https://meet.google.com/xyz');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_meeting_link_is_hidden_from_the_resource_for_anyone_who_cannot_manage(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id, 'meeting_url' => 'https://meet.google.com/rahasia'])->load('course.mentor');

        $render = function (User $user) use ($session) {
            $request = Request::create('/');
            $request->setUserResolver(fn () => $user);

            return (new ClassSessionResource($session))->resolve($request);
        };

        $this->assertSame('https://meet.google.com/rahasia', $render($this->admin)['meeting_url']);

        foreach ([Role::SISWA, Role::KARYAWAN, Role::LEMBAGA, Role::MENTOR] as $role) {
            $this->assertArrayNotHasKey('meeting_url', $render($this->userWithRole($role)), "{$role} tidak boleh melihat link meeting.");
        }
    }

    public function test_deleted_sessions_have_no_meeting_link(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);
        $session->delete();

        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id.'/meeting-link')->assertNotFound();
    }

    // ------------------------------------------------------------------ otorisasi dan kasus khusus

    public function test_sessions_of_an_institution_program_are_read_only_for_admin(): void
    {
        $program = Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create();
        $session = ClassSession::factory()->create(['course_id' => $program->id]);

        $this->asAdmin()->getJson('/api/v1/courses/'.$program->id.'/sessions')->assertOk()->assertJsonCount(1, 'data');
        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id)->assertOk();
        $this->asAdmin()->postJson('/api/v1/courses/'.$program->id.'/sessions', $this->payload())->assertForbidden();
        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['title' => 'X'])->assertForbidden();
        $this->asAdmin()->deleteJson('/api/v1/sessions/'.$session->id)->assertForbidden();
        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id.'/meeting-link')->assertForbidden();
    }

    public function test_a_deleted_course_has_no_manageable_sessions(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);
        $this->course->delete();

        $this->asAdmin()->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload())->assertNotFound();
        $this->asAdmin()->patchJson('/api/v1/sessions/'.$session->id, ['title' => 'X'])->assertNotFound();
        $this->asAdmin()->deleteJson('/api/v1/sessions/'.$session->id)->assertNotFound();
        $this->asAdmin()->getJson('/api/v1/sessions/'.$session->id.'/meeting-link')->assertNotFound();
    }

    #[DataProvider('nonAdminRoles')]
    public function test_other_roles_cannot_use_session_endpoints(string $role): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);
        $actor = $this->userWithRole($role);

        $this->as($actor)->getJson('/api/v1/courses/'.$this->course->id.'/sessions')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload())->assertForbidden();
        $this->as($actor)->getJson('/api/v1/sessions/'.$session->id)->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/sessions/'.$session->id, ['title' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/sessions/'.$session->id)->assertForbidden();
        $this->as($actor)->getJson('/api/v1/sessions/'.$session->id.'/meeting-link')->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/courses/1/sessions')->assertUnauthorized();
        $this->getJson('/api/v1/sessions/1/meeting-link')->assertUnauthorized();
        $this->postJson('/api/v1/courses/1/sessions', [])->assertUnauthorized();
    }

    public function test_a_future_mentor_manages_sessions_only_of_own_courses(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()->syncWithoutDetaching(
            Permission::whereIn('slug', ['courses.view', 'courses.update', 'content.manage'])->pluck('id')
        );
        $own = ClassSession::factory()->create(['course_id' => $this->course->id]);
        $foreignCourse = Course::factory()->active()->mentoredBy($this->userWithRole(Role::MENTOR))->create();
        $foreign = ClassSession::factory()->create(['course_id' => $foreignCourse->id]);

        $this->as($this->mentor)->getJson('/api/v1/courses/'.$this->course->id.'/sessions')->assertOk();
        $this->as($this->mentor)->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload())->assertCreated();
        $this->as($this->mentor)->getJson('/api/v1/sessions/'.$own->id.'/meeting-link')->assertOk();

        $this->as($this->mentor)->getJson('/api/v1/courses/'.$foreignCourse->id.'/sessions')->assertForbidden();
        $this->as($this->mentor)->patchJson('/api/v1/sessions/'.$foreign->id, ['title' => 'Curang'])->assertForbidden();
        $this->as($this->mentor)->getJson('/api/v1/sessions/'.$foreign->id.'/meeting-link')->assertForbidden();
    }
}
