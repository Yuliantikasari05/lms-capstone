<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CourseApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
    }

    /** Berganti pelaku di tengah test (guard "sanctum" menyimpan pengguna request sebelumnya). */
    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    private function asAdmin(): static
    {
        return $this->as($this->admin);
    }

    private function mentor(array $attrs = []): User
    {
        return $this->userWithRole(Role::MENTOR, $attrs);
    }

    private function grantMentor(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()->syncWithoutDetaching(
            Permission::whereIn('slug', ['courses.view', 'courses.create', 'courses.update', 'content.manage'])->pluck('id')
        );
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ daftar

    public function test_list_returns_course_cards_with_summary_counts(): void
    {
        $mentor = $this->mentor(['name' => 'Yuli Antika']);
        $course = Course::factory()->active()->mentoredBy($mentor)->create(['title' => 'Fullstack Web']);
        \App\Models\CourseModule::factory()->count(2)->create(['course_id' => $course->id]);
        \App\Models\ClassSession::factory()->count(3)->create(['course_id' => $course->id]);
        Enrollment::factory()->count(2)->create(['course_id' => $course->id]);
        Enrollment::factory()->cancelled()->create(['course_id' => $course->id]);

        $response = $this->asAdmin()->getJson('/api/v1/courses')->assertOk();

        $response->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Fullstack Web')
            ->assertJsonPath('data.0.type', 'academic')
            ->assertJsonPath('data.0.type_label', 'Akademik')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.status_label', 'Aktif')
            ->assertJsonPath('data.0.mentor.name', 'Yuli Antika')
            ->assertJsonPath('data.0.modules_count', 2)
            ->assertJsonPath('data.0.sessions_count', 3)
            ->assertJsonPath('data.0.participants_count', 2) // pendaftaran yang dibatalkan tidak dihitung
            ->assertJsonPath('data.0.abilities.update', true)
            ->assertJsonPath('data.0.abilities.assign_mentor', true)
            ->assertJsonStructure(['meta' => ['current_page', 'last_page', 'per_page', 'total'], 'links']);
    }

    public function test_list_filters_by_type_status_mentor_and_search(): void
    {
        $yuli = $this->mentor(['name' => 'Yuli Antika']);
        $budi = $this->mentor(['name' => 'Budi Santoso']);
        Course::factory()->active()->mentoredBy($yuli)->create(['title' => 'Laravel Dasar']);
        Course::factory()->training()->mentoredBy($budi)->create(['title' => 'Excel Lanjut']);
        Course::factory()->webinar()->inactive()->mentoredBy($budi)->create(['title' => 'Webinar Karier']);

        $titles = fn (string $query) => collect($this->asAdmin()->getJson('/api/v1/courses'.$query)->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['Excel Lanjut'], $titles('?type=training'));
        $this->assertSame(['Laravel Dasar'], $titles('?status=active'));
        $this->assertSame(['Excel Lanjut', 'Webinar Karier'], $titles('?mentor_id='.$budi->id));
        $this->assertSame(['Laravel Dasar'], $titles('?q=laravel'));
        $this->assertSame(['Laravel Dasar'], $titles('?q=YULI'), 'Cari juga berdasarkan nama Mentor.');
        $this->assertSame(['Webinar Karier'], $titles('?type=webinar&mentor_id='.$budi->id));
        $this->assertSame([], $titles('?q=tidak-ada'));
    }

    public function test_search_treats_wildcards_as_plain_text(): void
    {
        Course::factory()->create(['title' => 'Diskon 50% Spesial']);
        Course::factory()->create(['title' => 'Kursus Biasa']);

        $this->asAdmin()->getJson('/api/v1/courses?q='.urlencode('%'))->assertOk()->assertJsonCount(1, 'data');
        $this->asAdmin()->getJson('/api/v1/courses?q='.urlencode('_'))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_list_paginates_and_validates_filters(): void
    {
        Course::factory()->count(5)->create();

        $this->asAdmin()->getJson('/api/v1/courses?per_page=2')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3);

        $this->asAdmin()->getJson('/api/v1/courses?type=ngawur')->assertStatus(422)->assertJsonValidationErrors(['type']);
        $this->asAdmin()->getJson('/api/v1/courses?status=ngawur')->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->asAdmin()->getJson('/api/v1/courses?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
    }

    public function test_list_hides_deleted_courses_and_shows_institution_programs_as_read_only(): void
    {
        Course::factory()->create(['title' => 'Terhapus'])->delete();
        Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create(['title' => 'Program Lembaga X']);

        $response = $this->asAdmin()->getJson('/api/v1/courses')->assertOk();

        $response->assertJsonCount(1, 'data')->assertJsonPath('data.0.title', 'Program Lembaga X')
            ->assertJsonPath('data.0.type_label', 'Program Lembaga')
            ->assertJsonPath('data.0.abilities.update', false)
            ->assertJsonPath('data.0.abilities.manage_content', false)
            ->assertJsonPath('data.0.abilities.delete', false);
    }

    // ------------------------------------------------------------------ detail

    public function test_show_returns_the_course_and_404_for_missing_or_deleted(): void
    {
        $course = Course::factory()->create(['title' => 'Detail Kursus']);

        $this->asAdmin()->getJson('/api/v1/courses/'.$course->id)->assertOk()->assertJsonPath('data.title', 'Detail Kursus');
        $this->asAdmin()->getJson('/api/v1/courses/999999')->assertNotFound();

        $course->delete();
        $this->asAdmin()->getJson('/api/v1/courses/'.$course->id)->assertNotFound();
    }

    // ------------------------------------------------------------------ tambah

    public function test_admin_creates_a_draft_course_with_a_mentor(): void
    {
        $mentor = $this->mentor(['name' => 'Mentor Baru']);

        $this->asAdmin()->postJson('/api/v1/courses', [
            'type' => 'training', 'title' => 'Strategi Leadership', 'description' => 'Deskripsi', 'mentor_id' => $mentor->id,
        ])->assertCreated()
            ->assertJsonPath('message', 'Kursus berhasil dibuat.')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.type', 'training')
            ->assertJsonPath('data.mentor.id', $mentor->id)
            ->assertJsonPath('data.participants_count', 0);

        $course = Course::firstOrFail();
        $this->assertSame($this->admin->id, $course->created_by);
        $this->assertSame($mentor->id, $course->mentor_id);

        $log = $this->lastLog('course.created');
        $this->assertSame($course->id, $log->target_id);
        $this->assertSame('course', $log->target_type);
        $this->assertSame('Strategi Leadership', $log->target_label);
        $this->assertSame($this->admin->id, $log->actor_id);
    }

    public function test_a_course_can_be_created_without_a_mentor_as_a_draft(): void
    {
        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'Tanpa Mentor'])
            ->assertCreated()->assertJsonPath('data.mentor', null);
    }

    public function test_creating_an_active_course_requires_a_mentor(): void
    {
        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X', 'status' => 'active'])
            ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);

        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X', 'status' => 'active', 'mentor_id' => $this->mentor()->id])
            ->assertCreated()->assertJsonPath('data.status', 'active');
    }

    public function test_create_validates_input(): void
    {
        $this->asAdmin()->postJson('/api/v1/courses', [])->assertStatus(422)->assertJsonValidationErrors(['type', 'title']);

        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'institution', 'title' => 'Program'])
            ->assertStatus(422)->assertJsonValidationErrors(['type']);

        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => str_repeat('a', 151)])
            ->assertStatus(422)->assertJsonValidationErrors(['title']);

        $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X', 'status' => 'inactive'])
            ->assertStatus(422)->assertJsonValidationErrors(['status']);

        $this->assertSame(0, Course::count());
    }

    public function test_mentor_must_be_an_active_existing_mentor(): void
    {
        $siswa = $this->userWithRole(Role::SISWA);
        $inactive = $this->mentor(['status' => 'inactive']);
        $deleted = $this->mentor();
        $deleted->delete();

        foreach ([$siswa->id, $inactive->id, $deleted->id, 999999, $this->admin->id] as $invalid) {
            $this->asAdmin()->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X', 'mentor_id' => $invalid])
                ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);
        }
    }

    // ------------------------------------------------------------------ ubah

    public function test_update_changes_fields_and_logs_only_what_changed(): void
    {
        $course = Course::factory()->mentoredBy($this->mentor())->create(['title' => 'Lama', 'description' => 'Deskripsi lama']);

        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, [
            'title' => 'Baru', 'description' => 'Deskripsi lama', 'status' => 'active',
        ])->assertOk()
            ->assertJsonPath('message', 'Kursus berhasil diperbarui.')
            ->assertJsonPath('data.title', 'Baru')
            ->assertJsonPath('data.status', 'active');

        $log = $this->lastLog('course.updated');
        $this->assertSame(['title' => 'Lama', 'status' => 'draft'], $log->changes['before']);
        $this->assertSame(['title' => 'Baru', 'status' => 'active'], $log->changes['after']);
    }

    public function test_update_without_changes_writes_no_log(): void
    {
        $course = Course::factory()->create(['title' => 'Sama']);

        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, ['title' => 'Sama'])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'course.updated')->count());
    }

    public function test_type_and_mentor_cannot_be_changed_through_update(): void
    {
        $course = Course::factory()->create();

        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, ['type' => 'training'])
            ->assertStatus(422)->assertJsonValidationErrors(['type']);
        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, ['mentor_id' => $this->mentor()->id])
            ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);

        $this->assertSame('academic', $course->fresh()->type);
        $this->assertNull($course->fresh()->mentor_id);
    }

    public function test_activating_requires_a_mentor_and_deactivating_is_always_allowed(): void
    {
        $noMentor = Course::factory()->create();
        $this->asAdmin()->patchJson('/api/v1/courses/'.$noMentor->id, ['status' => 'active'])
            ->assertStatus(422)->assertJsonValidationErrors(['status']);

        $withMentor = Course::factory()->active()->mentoredBy($this->mentor())->create();
        $this->asAdmin()->patchJson('/api/v1/courses/'.$withMentor->id, ['status' => 'inactive'])->assertOk()->assertJsonPath('data.status', 'inactive');
    }

    public function test_update_validates_input(): void
    {
        $course = Course::factory()->create();

        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, ['title' => ''])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->asAdmin()->patchJson('/api/v1/courses/'.$course->id, ['status' => 'ngawur'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    // ------------------------------------------------------------------ ganti mentor

    public function test_admin_assigns_and_replaces_the_mentor_and_it_is_logged(): void
    {
        $old = $this->mentor(['name' => 'Mentor Lama']);
        $new = $this->mentor(['name' => 'Mentor Baru']);
        $course = Course::factory()->active()->mentoredBy($old)->create();

        $this->asAdmin()->putJson('/api/v1/courses/'.$course->id.'/mentor', ['mentor_id' => $new->id])
            ->assertOk()
            ->assertJsonPath('message', 'Mentor kursus berhasil diperbarui.')
            ->assertJsonPath('data.mentor.name', 'Mentor Baru');

        $log = $this->lastLog('course.mentor_assigned');
        $this->assertSame(['mentor_id' => $old->id, 'mentor' => 'Mentor Lama'], $log->changes['before']);
        $this->assertSame(['mentor_id' => $new->id, 'mentor' => 'Mentor Baru'], $log->changes['after']);

        $this->assertCount(0, Course::visibleTo($old)->get(), 'Mentor lama kehilangan akses.');
        $this->assertCount(1, Course::visibleTo($new)->get());
    }

    public function test_assigning_the_same_mentor_writes_no_log(): void
    {
        $mentor = $this->mentor();
        $course = Course::factory()->mentoredBy($mentor)->create();

        $this->asAdmin()->putJson('/api/v1/courses/'.$course->id.'/mentor', ['mentor_id' => $mentor->id])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'course.mentor_assigned')->count());
    }

    public function test_mentor_can_be_removed_only_while_the_course_is_not_active(): void
    {
        $draft = Course::factory()->mentoredBy($this->mentor())->create();
        $active = Course::factory()->active()->mentoredBy($this->mentor())->create();

        $this->asAdmin()->putJson('/api/v1/courses/'.$draft->id.'/mentor', ['mentor_id' => null])->assertOk()->assertJsonPath('data.mentor', null);
        $this->asAdmin()->putJson('/api/v1/courses/'.$active->id.'/mentor', ['mentor_id' => null])
            ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);

        $this->assertNotNull($active->fresh()->mentor_id);
    }

    public function test_assign_mentor_validates_input(): void
    {
        $course = Course::factory()->create();

        $this->asAdmin()->putJson('/api/v1/courses/'.$course->id.'/mentor', [])->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);
        $this->asAdmin()->putJson('/api/v1/courses/'.$course->id.'/mentor', ['mentor_id' => $this->userWithRole(Role::SISWA)->id])
            ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);
    }

    // ------------------------------------------------------------------ hapus

    public function test_delete_is_soft_and_logged(): void
    {
        $course = Course::factory()->create(['title' => 'Hapus Saya']);

        $this->asAdmin()->deleteJson('/api/v1/courses/'.$course->id)->assertOk()->assertJsonPath('message', 'Kursus berhasil dihapus.');

        $this->assertSoftDeleted($course);
        $this->assertSame('Hapus Saya', $this->lastLog('course.deleted')->target_label);
    }

    public function test_a_course_with_active_participants_cannot_be_deleted(): void
    {
        $course = Course::factory()->active()->mentoredBy($this->mentor())->create();
        Enrollment::factory()->create(['course_id' => $course->id]);

        $this->asAdmin()->deleteJson('/api/v1/courses/'.$course->id)->assertStatus(422)->assertJsonValidationErrors(['course']);

        $this->assertNotSoftDeleted($course);
        $this->assertSame(0, AuditLog::where('action', 'course.deleted')->count());
    }

    public function test_a_course_with_only_cancelled_enrollments_can_be_deleted(): void
    {
        $course = Course::factory()->create();
        Enrollment::factory()->cancelled()->create(['course_id' => $course->id]);

        $this->asAdmin()->deleteJson('/api/v1/courses/'.$course->id)->assertOk();

        $this->assertSoftDeleted($course);
    }

    // ------------------------------------------------------------------ Program Lembaga: hanya dibaca Admin

    public function test_admin_cannot_modify_an_institution_program(): void
    {
        $program = Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create();

        $this->asAdmin()->getJson('/api/v1/courses/'.$program->id)->assertOk();

        $this->asAdmin()->patchJson('/api/v1/courses/'.$program->id, ['title' => 'Diubah'])
            ->assertForbidden()->assertJsonPath('message', 'Program Lembaga hanya dapat diubah oleh lembaganya.');
        $this->asAdmin()->deleteJson('/api/v1/courses/'.$program->id)->assertForbidden();
        $this->asAdmin()->putJson('/api/v1/courses/'.$program->id.'/mentor', ['mentor_id' => $this->mentor()->id])->assertForbidden();

        $this->assertNotSame('Diubah', $program->fresh()->title);
    }

    // ------------------------------------------------------------------ otorisasi role lain

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_cannot_use_course_endpoints(string $role): void
    {
        $actor = $this->userWithRole($role);
        $course = Course::factory()->active()->mentoredBy($this->mentor())->create();

        $this->as($actor)->getJson('/api/v1/courses')->assertForbidden();
        $this->as($actor)->getJson('/api/v1/courses/'.$course->id)->assertForbidden();
        $this->as($actor)->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X'])->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/courses/'.$course->id, ['title' => 'X'])->assertForbidden();
        $this->as($actor)->putJson('/api/v1/courses/'.$course->id.'/mentor', ['mentor_id' => null])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/courses/'.$course->id)->assertForbidden();

        $this->assertSame(1, Course::count());
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/courses')->assertUnauthorized();
        $this->postJson('/api/v1/courses', [])->assertUnauthorized();
        $this->deleteJson('/api/v1/courses/1')->assertUnauthorized();
    }

    public function test_a_user_with_a_temporary_password_is_blocked_from_course_endpoints(): void
    {
        $admin2 = $this->userWithRole(Role::ADMIN, ['must_change_password' => true]);

        $this->as($admin2)->getJson('/api/v1/courses')->assertStatus(403)->assertJsonPath('code', 'password_change_required');
    }

    // ------------------------------------------------------------------ Mentor di masa depan (izin diberikan)

    public function test_a_future_mentor_with_permissions_sees_and_changes_only_own_courses(): void
    {
        $this->grantMentor();
        $mentor = $this->mentor();
        $own = Course::factory()->mentoredBy($mentor)->create(['title' => 'Milik Saya']);
        $foreign = Course::factory()->mentoredBy($this->mentor())->create(['title' => 'Milik Orang']);

        $list = $this->as($mentor)->getJson('/api/v1/courses')->assertOk();
        $this->assertSame(['Milik Saya'], collect($list->json('data'))->pluck('title')->all());
        $list->assertJsonPath('data.0.abilities.update', true)->assertJsonPath('data.0.abilities.delete', false)->assertJsonPath('data.0.abilities.assign_mentor', false);

        $this->as($mentor)->patchJson('/api/v1/courses/'.$own->id, ['title' => 'Judul Baru'])->assertOk();
        $this->as($mentor)->getJson('/api/v1/courses/'.$foreign->id)->assertForbidden();
        $this->as($mentor)->patchJson('/api/v1/courses/'.$foreign->id, ['title' => 'Curang'])
            ->assertForbidden()->assertJsonPath('message', 'Anda hanya dapat mengelola kursus yang Anda ampu.');
        $this->as($mentor)->deleteJson('/api/v1/courses/'.$own->id)->assertForbidden();
        $this->as($mentor)->putJson('/api/v1/courses/'.$own->id.'/mentor', ['mentor_id' => null])->assertForbidden();

        $this->assertSame('Milik Orang', $foreign->fresh()->title);
    }

    public function test_a_future_mentor_creating_a_course_becomes_its_mentor(): void
    {
        $this->grantMentor();
        $mentor = $this->mentor();

        $this->as($mentor)->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'Kursus Mentor', 'status' => 'active'])
            ->assertCreated()->assertJsonPath('data.mentor.id', $mentor->id)->assertJsonPath('data.status', 'active');

        $course = Course::firstOrFail();
        $this->assertSame($mentor->id, $course->mentor_id);
        $this->assertSame($mentor->id, $course->created_by);

        // Tidak boleh menunjuk Mentor lain.
        $this->as($mentor)->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'X', 'mentor_id' => $this->mentor()->id])
            ->assertStatus(422)->assertJsonValidationErrors(['mentor_id']);
    }

    // ------------------------------------------------------------------ penjaga di manajemen pengguna

    public function test_a_mentor_with_draft_or_active_courses_cannot_be_deleted(): void
    {
        $mentor = $this->mentor();
        Course::factory()->active()->mentoredBy($mentor)->create();
        Course::factory()->mentoredBy($mentor)->create();

        $this->asAdmin()->deleteJson('/api/v1/users/'.$mentor->id)->assertStatus(422)->assertJsonValidationErrors(['user']);

        $this->assertNotSoftDeleted($mentor);
    }

    public function test_a_mentor_can_be_deleted_once_the_courses_are_inactive_or_reassigned(): void
    {
        $mentor = $this->mentor();
        $course = Course::factory()->inactive()->mentoredBy($mentor)->create();

        $this->asAdmin()->deleteJson('/api/v1/users/'.$mentor->id)->assertOk();

        $this->assertSoftDeleted($mentor);
        $this->assertSame($mentor->id, $course->fresh()->mentor_id, 'Riwayat tetap menunjuk Mentor lama.');
    }

    public function test_a_mentoring_user_cannot_be_moved_to_another_role(): void
    {
        $mentor = $this->mentor();
        Course::factory()->active()->mentoredBy($mentor)->create();

        $this->asAdmin()->patchJson('/api/v1/users/'.$mentor->id, ['role' => 'siswa'])->assertStatus(422)->assertJsonValidationErrors(['user']);

        $this->assertSame(['mentor'], $mentor->roles()->pluck('slug')->all());

        // Mengubah hal lain (nama) tetap boleh, dan tetap Mentor tetap aman.
        $this->asAdmin()->patchJson('/api/v1/users/'.$mentor->id, ['name' => 'Nama Baru', 'role' => 'mentor'])->assertOk();
    }
}
