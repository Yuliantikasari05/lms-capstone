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

class EnrollmentApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Course $academic;

    private Course $training;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
        $mentor = $this->userWithRole(Role::MENTOR);
        $this->academic = Course::factory()->active()->mentoredBy($mentor)->create(['title' => 'Akademik Uji']);
        $this->training = Course::factory()->training()->active()->mentoredBy($mentor)->create(['title' => 'Pelatihan Uji']);
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

    private function siswa(array $attrs = []): User
    {
        return $this->userWithRole(Role::SISWA, $attrs);
    }

    private function karyawan(array $attrs = []): User
    {
        return $this->userWithRole(Role::KARYAWAN, $attrs);
    }

    private function enroll(Course $course, array $ids): \Illuminate\Testing\TestResponse
    {
        return $this->asAdmin()->postJson('/api/v1/courses/'.$course->id.'/enrollments', ['user_ids' => $ids]);
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ mendaftarkan

    public function test_admin_enrolls_students_into_an_academic_course(): void
    {
        $a = $this->siswa(['name' => 'Adi']);
        $b = $this->siswa(['name' => 'Bunga']);

        $response = $this->enroll($this->academic, [$a->id, $b->id])->assertCreated();

        $response->assertJsonPath('message', '2 peserta berhasil didaftarkan.')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.source', 'admin')
            ->assertJsonPath('data.0.enrolled_by', 'Admin Uji')
            ->assertJsonPath('data.0.user.name', 'Adi');

        $this->assertSame(2, Enrollment::where('course_id', $this->academic->id)->count());
        $this->assertSame(2, $this->academic->activeEnrollments()->count());
    }

    public function test_single_enrollment_message_and_audit_log(): void
    {
        $siswa = $this->siswa(['name' => 'Adi Saputra']);

        $this->enroll($this->academic, [$siswa->id])->assertCreated()->assertJsonPath('message', 'Peserta berhasil didaftarkan.');

        $log = $this->lastLog('enrollment.created');
        $this->assertSame('Adi Saputra → Akademik Uji', $log->target_label);
        $this->assertSame('enrollment', $log->target_type);
        $this->assertSame($this->academic->id, $log->changes['course_id']);
        $this->assertSame($siswa->id, $log->changes['user_id']);
        $this->assertSame($this->admin->id, $log->actor_id);
    }

    public function test_training_and_webinar_accept_only_employees_and_academic_only_students(): void
    {
        $webinar = Course::factory()->webinar()->active()->create();
        $siswa = $this->siswa(['name' => 'Siswa Satu']);
        $karyawan = $this->karyawan(['name' => 'Karyawan Satu']);

        $this->enroll($this->training, [$karyawan->id])->assertCreated();
        $this->enroll($webinar, [$karyawan->id])->assertCreated();
        $this->enroll($this->academic, [$siswa->id])->assertCreated();

        $this->enroll($this->training, [$siswa->id])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);
        $this->enroll($webinar, [$siswa->id])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);
        $this->enroll($this->academic, [$karyawan->id])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);

        // Kunci error memang harfiah "user_ids.0" (bukan jalur bersarang), jadi dibaca lewat array.
        $message = $this->enroll($this->academic, [$karyawan->id])->json('errors')['user_ids.0'][0];
        $this->assertSame('Karyawan Satu bukan Siswa. Kursus Akademik hanya untuk Siswa.', $message);
    }

    public function test_other_roles_and_unusable_accounts_cannot_be_enrolled(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        $lembaga = $this->userWithRole(Role::LEMBAGA);
        $inactive = $this->siswa(['status' => 'inactive']);
        $suspended = $this->siswa(['status' => 'suspended']);
        $deleted = $this->siswa();
        $deleted->delete();

        foreach ([$this->admin->id, $mentor->id, $lembaga->id, $inactive->id, $suspended->id, $deleted->id, 999999] as $bad) {
            $this->enroll($this->academic, [$bad])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);
        }

        $this->assertSame(0, Enrollment::count());
    }

    public function test_an_account_cannot_be_enrolled_twice(): void
    {
        $siswa = $this->siswa(['name' => 'Adi']);
        $this->enroll($this->academic, [$siswa->id])->assertCreated();

        $this->enroll($this->academic, [$siswa->id])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);

        $this->assertSame(1, Enrollment::count());
    }

    public function test_bulk_enrollment_is_all_or_nothing_and_errors_name_the_position(): void
    {
        $good = $this->siswa();
        $bad = $this->karyawan();
        $good2 = $this->siswa();

        $response = $this->enroll($this->academic, [$good->id, $bad->id, $good2->id])->assertStatus(422);

        $response->assertJsonValidationErrors(['user_ids.1']);
        $this->assertArrayNotHasKey('user_ids.0', $response->json('errors'));
        $this->assertSame(0, Enrollment::count(), 'Satu id yang salah membatalkan semuanya.');
        $this->assertSame(0, AuditLog::where('action', 'enrollment.created')->count());
    }

    public function test_enrollment_input_validation(): void
    {
        $siswa = $this->siswa();
        $url = '/api/v1/courses/'.$this->academic->id.'/enrollments';

        $this->asAdmin()->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['user_ids']);
        $this->asAdmin()->postJson($url, ['user_ids' => []])->assertStatus(422)->assertJsonValidationErrors(['user_ids']);
        $this->asAdmin()->postJson($url, ['user_ids' => 'bukan array'])->assertStatus(422)->assertJsonValidationErrors(['user_ids']);
        $this->asAdmin()->postJson($url, ['user_ids' => ['abc']])->assertStatus(422)->assertJsonValidationErrors(['user_ids.0']);
        $this->asAdmin()->postJson($url, ['user_ids' => [$siswa->id, $siswa->id]])->assertStatus(422);
        $this->asAdmin()->postJson($url, ['user_ids' => range(1, 101)])->assertStatus(422)->assertJsonValidationErrors(['user_ids']);

        $this->assertSame(0, Enrollment::count());
    }

    public function test_a_cancelled_enrollment_is_reactivated_instead_of_duplicated(): void
    {
        $siswa = $this->siswa();
        $old = Enrollment::factory()->cancelled()->create(['course_id' => $this->academic->id, 'user_id' => $siswa->id, 'enrolled_at' => now()->subMonths(2)]);

        $this->enroll($this->academic, [$siswa->id])->assertCreated()->assertJsonPath('data.0.id', $old->id)->assertJsonPath('data.0.status', 'active');

        $this->assertSame(1, Enrollment::count(), 'Tetap satu baris per pasangan kursus-pengguna.');
        $fresh = $old->fresh();
        $this->assertSame('active', $fresh->status);
        $this->assertNull($fresh->cancelled_at);
        $this->assertTrue($fresh->enrolled_at->isToday());
        $this->assertTrue($this->lastLog('enrollment.created')->changes['reactivated']);
    }

    // ------------------------------------------------------------------ daftar peserta

    public function test_index_lists_active_participants_with_filters(): void
    {
        $adi = $this->siswa(['name' => 'Adi Saputra', 'email' => 'adi@example.test']);
        $bunga = $this->siswa(['name' => 'Bunga Lestari', 'email' => 'bunga@example.test']);
        $batal = $this->siswa(['name' => 'Citra Batal']);
        Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $adi->id, 'enrolled_at' => now()->subDay()]);
        Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $bunga->id, 'enrolled_at' => now()]);
        Enrollment::factory()->cancelled()->create(['course_id' => $this->academic->id, 'user_id' => $batal->id]);
        Enrollment::factory()->create(['course_id' => $this->training->id, 'user_id' => $this->karyawan()->id]); // kursus lain

        $names = fn (string $q = '') => collect($this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments'.$q)->assertOk()->json('data'))->pluck('user.name')->all();

        $this->assertSame(['Bunga Lestari', 'Adi Saputra'], $names(), 'Aktif saja, terbaru di atas.');
        $this->assertSame(['Citra Batal'], $names('?status=cancelled'));
        $this->assertCount(3, $names('?status=all'));
        $this->assertSame(['Adi Saputra'], $names('?q=ADI'));
        $this->assertSame(['Bunga Lestari'], $names('?q=bunga@'));
        $this->assertSame([], $names('?q=tidak-ada'));

        $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments?status=ngawur')->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_index_paginates_and_shows_deleted_accounts_as_history(): void
    {
        foreach (range(1, 3) as $i) {
            Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $this->siswa(['name' => "Siswa {$i}"])->id]);
        }
        $gone = $this->siswa(['name' => 'Sudah Dihapus']);
        Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $gone->id, 'enrolled_at' => now()->addMinute()]);
        $gone->delete();

        $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments?per_page=2')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 4)->assertJsonPath('meta.last_page', 2);

        $first = $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments')->json('data.0');
        $this->assertSame('Sudah Dihapus', $first['user']['name']);
        $this->assertTrue($first['user']['deleted']);
    }

    // ------------------------------------------------------------------ kandidat

    public function test_candidates_are_active_users_of_the_right_role_who_are_not_enrolled_yet(): void
    {
        $free = $this->siswa(['name' => 'Bebas']);
        $taken = $this->siswa(['name' => 'Sudah Ikut']);
        $cancelled = $this->siswa(['name' => 'Pernah Batal']);
        $this->siswa(['name' => 'Nonaktif', 'status' => 'inactive']);
        $this->siswa(['name' => 'Terhapus'])->delete();
        $this->karyawan(['name' => 'Karyawan Bukan Siswa']);
        $this->userWithRole(Role::MENTOR, ['name' => 'Mentor Bukan Siswa']);
        Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $taken->id]);
        Enrollment::factory()->cancelled()->create(['course_id' => $this->academic->id, 'user_id' => $cancelled->id]);

        $response = $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates')->assertOk();

        $this->assertSame(['Bebas', 'Pernah Batal'], collect($response->json('data'))->pluck('name')->all());
        $response->assertJsonStructure(['data' => [['id', 'name', 'email']], 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);

        $trainingNames = collect($this->asAdmin()->getJson('/api/v1/courses/'.$this->training->id.'/enrollment-candidates')->json('data'))->pluck('name')->all();
        $this->assertSame(['Karyawan Bukan Siswa'], $trainingNames, 'Pelatihan menawarkan Karyawan.');

        $this->assertSame(['Bebas'], collect($this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates?q=beb')->json('data'))->pluck('name')->all());
        $this->assertSame($free->id, $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates?q=beb')->json('data.0.id'));
    }

    public function test_every_candidate_can_actually_be_enrolled(): void
    {
        foreach (range(1, 5) as $i) {
            $this->siswa();
        }
        $ids = collect($this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates')->json('data'))->pluck('id')->all();

        $this->assertCount(5, $ids);
        $this->enroll($this->academic, $ids)->assertCreated();
        $this->assertCount(0, $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates')->json('data'));
    }

    // ------------------------------------------------------------------ membatalkan

    public function test_cancelling_keeps_the_row_as_history_and_is_logged(): void
    {
        $siswa = $this->siswa(['name' => 'Adi']);
        $enrollment = Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $siswa->id]);

        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertOk()->assertJsonPath('message', 'Pendaftaran peserta dibatalkan.');

        $fresh = $enrollment->fresh();
        $this->assertSame('cancelled', $fresh->status);
        $this->assertNotNull($fresh->cancelled_at);
        $this->assertSame('Adi → Akademik Uji', $this->lastLog('enrollment.cancelled')->target_label);
        $this->assertSame(0, $this->academic->activeEnrollments()->count());
    }

    public function test_cancelling_twice_is_rejected(): void
    {
        $enrollment = Enrollment::factory()->cancelled()->create(['course_id' => $this->academic->id, 'user_id' => $this->siswa()->id]);

        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertStatus(422)->assertJsonValidationErrors(['enrollment']);
        $this->asAdmin()->deleteJson('/api/v1/enrollments/999999')->assertNotFound();
    }

    public function test_cancelling_lets_the_course_be_deleted_again(): void
    {
        $enrollment = Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $this->siswa()->id]);

        $this->asAdmin()->deleteJson('/api/v1/courses/'.$this->academic->id)->assertStatus(422);
        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertOk();
        $this->asAdmin()->deleteJson('/api/v1/courses/'.$this->academic->id)->assertOk();
    }

    public function test_participant_count_on_course_cards_follows_enrollments(): void
    {
        $siswa = $this->siswa();
        $this->enroll($this->academic, [$siswa->id, $this->siswa()->id])->assertCreated();

        $count = fn () => collect($this->asAdmin()->getJson('/api/v1/courses?q=Akademik')->json('data'))->firstWhere('id', $this->academic->id)['participants_count'];

        $this->assertSame(2, $count());

        $id = Enrollment::where('user_id', $siswa->id)->value('id');
        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$id)->assertOk();
        $this->assertSame(1, $count());
    }

    // ------------------------------------------------------------------ otorisasi

    public function test_admin_cannot_manage_enrollments_of_an_institution_program(): void
    {
        $program = Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create();
        $enrollment = Enrollment::factory()->create(['course_id' => $program->id, 'user_id' => $this->siswa()->id]);

        $this->enroll($program, [$this->siswa()->id])->assertForbidden();
        $this->asAdmin()->getJson('/api/v1/courses/'.$program->id.'/enrollments')->assertForbidden();
        $this->asAdmin()->getJson('/api/v1/courses/'.$program->id.'/enrollment-candidates')->assertForbidden();
        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertForbidden();
    }

    public function test_a_deleted_course_has_no_manageable_enrollments(): void
    {
        $enrollment = Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $this->siswa()->id]);
        $enrollment->course->delete(); // soft delete langsung (tanpa aturan peserta aktif)

        $this->enroll($this->academic, [$this->siswa()->id])->assertNotFound();
        $this->asAdmin()->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertNotFound();
        $this->asAdmin()->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments')->assertNotFound();
    }

    #[DataProvider('nonAdminRoles')]
    public function test_other_roles_cannot_manage_enrollments(string $role): void
    {
        $siswa = $this->siswa();
        $enrollment = Enrollment::factory()->create(['course_id' => $this->academic->id, 'user_id' => $this->siswa()->id]);
        $actor = $this->userWithRole($role);

        $this->as($actor)->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments')->assertForbidden();
        $this->as($actor)->getJson('/api/v1/courses/'.$this->academic->id.'/enrollment-candidates')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/courses/'.$this->academic->id.'/enrollments', ['user_ids' => [$siswa->id]])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/enrollments/'.$enrollment->id)->assertForbidden();

        $this->assertSame(1, Enrollment::count());
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_even_a_mentor_with_content_permissions_cannot_manage_enrollments(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()->syncWithoutDetaching(
            Permission::whereIn('slug', ['courses.view', 'courses.update', 'content.manage'])->pluck('id')
        );
        $mentor = $this->academic->mentor;

        $this->as($mentor)->getJson('/api/v1/courses/'.$this->academic->id.'/enrollments')->assertForbidden();
        $this->as($mentor)->postJson('/api/v1/courses/'.$this->academic->id.'/enrollments', ['user_ids' => [$this->siswa()->id]])->assertForbidden();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/courses/1/enrollments')->assertUnauthorized();
        $this->postJson('/api/v1/courses/1/enrollments', [])->assertUnauthorized();
        $this->deleteJson('/api/v1/enrollments/1')->assertUnauthorized();
    }
}
