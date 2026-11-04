<?php

namespace Tests\Feature;

use App\Models\ClassSession;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Material;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Fondasi data kursus: skema, relasi, aturan jenis kursus, visibilitas per role, dan Policy. */
class CourseFoundationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
    }

    /** Memberi permission ke sebuah role (mensimulasikan tahap berikutnya saat Mentor/Lembaga mendapat akses). */
    private function grant(string $role, array $permissions): void
    {
        Role::where('slug', $role)->firstOrFail()->permissions()
            ->syncWithoutDetaching(Permission::whereIn('slug', $permissions)->pluck('id'));
    }

    private const MENTOR_PERMISSIONS = ['courses.view', 'courses.create', 'courses.update', 'content.manage'];

    // ------------------------------------------------------------------ skema

    public function test_schema_has_all_course_tables_and_columns(): void
    {
        $expected = [
            'courses' => ['type', 'title', 'description', 'status', 'mentor_id', 'created_by', 'deleted_at'],
            'course_modules' => ['course_id', 'title', 'position', 'deleted_at'],
            'materials' => ['course_module_id', 'title', 'type', 'file_path', 'file_name', 'file_size', 'mime_type', 'external_url', 'duration_minutes', 'xp_points', 'position', 'deleted_at'],
            'class_sessions' => ['course_id', 'title', 'starts_at', 'ends_at', 'meeting_url', 'deleted_at'],
            'enrollments' => ['course_id', 'user_id', 'status', 'source', 'enrolled_by', 'enrolled_at', 'cancelled_at'],
        ];

        foreach ($expected as $table => $columns) {
            $this->assertTrue(Schema::hasTable($table), "Tabel {$table} harus ada.");
            $this->assertTrue(Schema::hasColumns($table, $columns), "Kolom {$table} belum lengkap.");
        }
    }

    public function test_an_enrollment_pair_is_unique(): void
    {
        $course = Course::factory()->create();
        $user = User::factory()->create();
        Enrollment::factory()->create(['course_id' => $course->id, 'user_id' => $user->id]);

        $this->expectException(QueryException::class);
        Enrollment::factory()->create(['course_id' => $course->id, 'user_id' => $user->id]);
    }

    public function test_course_soft_delete_hides_it_but_keeps_the_row(): void
    {
        $course = Course::factory()->create();

        $course->delete();

        $this->assertSoftDeleted($course);
        $this->assertNull(Course::find($course->id));
        $this->assertNotNull(Course::withTrashed()->find($course->id));
    }

    // ------------------------------------------------------------------ aturan jenis kursus

    #[DataProvider('typeRules')]
    public function test_type_rules(string $type, string $label, string $participantRole, bool $xp, bool $needsMentor): void
    {
        $course = Course::factory()->create(['type' => $type]);

        $this->assertSame($label, $course->typeLabel());
        $this->assertSame($participantRole, $course->participantRole());
        $this->assertSame($xp, $course->allowsXp());
        $this->assertSame($needsMentor, $course->requiresMentor());
    }

    public static function typeRules(): array
    {
        return [
            'akademik' => [Course::TYPE_ACADEMIC, 'Akademik', 'siswa', true, true],
            'pelatihan' => [Course::TYPE_TRAINING, 'Pelatihan', 'karyawan', false, true],
            'webinar' => [Course::TYPE_WEBINAR, 'Webinar', 'karyawan', false, true],
            'program lembaga' => [Course::TYPE_INSTITUTION, 'Program Lembaga', 'siswa', true, false],
        ];
    }

    public function test_program_lembaga_cannot_be_created_through_the_manage_form(): void
    {
        $this->assertNotContains(Course::TYPE_INSTITUTION, Course::CREATABLE_TYPES);
        $this->assertCount(3, Course::CREATABLE_TYPES);
    }

    // ------------------------------------------------------------------ relasi

    public function test_relations_are_ordered(): void
    {
        $course = Course::factory()->create();
        CourseModule::factory()->create(['course_id' => $course->id, 'title' => 'C', 'position' => 3]);
        CourseModule::factory()->create(['course_id' => $course->id, 'title' => 'A', 'position' => 1]);
        CourseModule::factory()->create(['course_id' => $course->id, 'title' => 'B', 'position' => 2]);
        ClassSession::factory()->create(['course_id' => $course->id, 'title' => 'Kedua', 'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(2)->addHour()]);
        ClassSession::factory()->create(['course_id' => $course->id, 'title' => 'Pertama', 'starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addHour()]);

        $this->assertSame(['A', 'B', 'C'], $course->modules->pluck('title')->all());
        $this->assertSame(['Pertama', 'Kedua'], $course->sessions->pluck('title')->all());
    }

    public function test_materials_belong_to_modules_in_position_order(): void
    {
        $module = CourseModule::factory()->create();
        Material::factory()->create(['course_module_id' => $module->id, 'title' => 'Dua', 'position' => 2]);
        Material::factory()->create(['course_module_id' => $module->id, 'title' => 'Satu', 'position' => 1]);

        $this->assertSame(['Satu', 'Dua'], $module->materials->pluck('title')->all());
        $this->assertTrue(Material::factory()->pdf()->make()->hasFile());
        $this->assertFalse(Material::factory()->make()->hasFile());
    }

    public function test_deleted_children_are_excluded_from_relations(): void
    {
        $course = Course::factory()->create();
        $module = CourseModule::factory()->create(['course_id' => $course->id]);
        $session = ClassSession::factory()->create(['course_id' => $course->id]);

        $module->delete();
        $session->delete();

        $this->assertCount(0, $course->fresh()->modules);
        $this->assertCount(0, $course->fresh()->sessions);
    }

    public function test_mentor_name_survives_the_mentor_account_being_deleted(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Mentor Lama']);
        $course = Course::factory()->mentoredBy($mentor)->create();

        $mentor->delete();

        $this->assertSame('Mentor Lama', $course->fresh()->mentor->name);
    }

    public function test_session_type_follows_the_course_type(): void
    {
        $this->assertSame('Kelas', ClassSession::factory()->for(Course::factory()->academic())->create()->typeLabel());
        $this->assertSame('Pelatihan', ClassSession::factory()->for(Course::factory()->training())->create()->typeLabel());
        $this->assertSame('Webinar', ClassSession::factory()->for(Course::factory()->webinar())->create()->typeLabel());
    }

    // ------------------------------------------------------------------ visibilitas per pengguna

    public function test_visibility_per_role(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $mentorA = $this->userWithRole(Role::MENTOR);
        $mentorB = $this->userWithRole(Role::MENTOR);
        $lembaga = $this->userWithRole(Role::LEMBAGA);
        $siswa = $this->userWithRole(Role::SISWA);
        $karyawan = $this->userWithRole(Role::KARYAWAN);

        $akademik = Course::factory()->active()->mentoredBy($mentorA)->create(['title' => 'Akademik A']);
        $pelatihan = Course::factory()->training()->active()->mentoredBy($mentorB)->create(['title' => 'Pelatihan B']);
        $draf = Course::factory()->mentoredBy($mentorA)->create(['title' => 'Draf A']);
        $program = Course::factory()->institution($lembaga)->active()->create(['title' => 'Program L']);
        Enrollment::factory()->create(['course_id' => $akademik->id, 'user_id' => $siswa->id]);
        Enrollment::factory()->create(['course_id' => $pelatihan->id, 'user_id' => $karyawan->id]);

        $titles = fn (User $user) => Course::visibleTo($user)->orderBy('title')->pluck('title')->all();

        $this->assertSame(['Akademik A', 'Draf A', 'Pelatihan B', 'Program L'], $titles($admin), 'Admin melihat semuanya.');
        $this->assertSame(['Akademik A', 'Draf A'], $titles($mentorA), 'Mentor hanya yang diampunya.');
        $this->assertSame(['Pelatihan B'], $titles($mentorB));
        $this->assertSame(['Program L'], $titles($lembaga), 'Lembaga hanya programnya.');
        $this->assertSame(['Akademik A'], $titles($siswa), 'Siswa hanya yang diikuti.');
        $this->assertSame(['Pelatihan B'], $titles($karyawan));
    }

    public function test_participants_only_see_active_courses_with_an_active_enrollment(): void
    {
        $siswa = $this->userWithRole(Role::SISWA);
        $mentor = $this->userWithRole(Role::MENTOR);

        $draf = Course::factory()->mentoredBy($mentor)->create();
        $nonaktif = Course::factory()->inactive()->mentoredBy($mentor)->create();
        $batal = Course::factory()->active()->mentoredBy($mentor)->create();
        $tidakIkut = Course::factory()->active()->mentoredBy($mentor)->create();
        $ikut = Course::factory()->active()->mentoredBy($mentor)->create(['title' => 'Satu-satunya']);
        foreach ([$draf, $nonaktif, $ikut] as $course) {
            Enrollment::factory()->create(['course_id' => $course->id, 'user_id' => $siswa->id]);
        }
        Enrollment::factory()->cancelled()->create(['course_id' => $batal->id, 'user_id' => $siswa->id]);

        $this->assertSame(['Satu-satunya'], Course::visibleTo($siswa)->pluck('title')->all());
    }

    public function test_a_mentor_does_not_keep_access_after_being_replaced(): void
    {
        $old = $this->userWithRole(Role::MENTOR);
        $new = $this->userWithRole(Role::MENTOR);
        $course = Course::factory()->active()->mentoredBy($old)->create(['created_by' => $old->id]);

        $course->mentor_id = $new->id;
        $course->save();

        $this->assertCount(0, Course::visibleTo($old)->get(), 'Pembuat awal kehilangan akses setelah diganti.');
        $this->assertCount(1, Course::visibleTo($new)->get());
    }

    public function test_a_mentor_does_not_see_institution_programs(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create(['mentor_id' => $mentor->id]);

        $this->assertCount(0, Course::visibleTo($mentor)->get(), 'Mentor tidak mengajar di Program Lembaga.');
    }

    public function test_a_user_without_a_course_role_sees_nothing(): void
    {
        Course::factory()->active()->count(2)->create();
        $nobody = User::factory()->create(); // tanpa role

        $this->assertCount(0, Course::visibleTo($nobody)->get());
    }

    // ------------------------------------------------------------------ permission

    public function test_course_permissions_belong_to_admin_only_for_now(): void
    {
        $slugs = ['courses.view', 'courses.create', 'courses.update', 'courses.delete', 'courses.assign_mentor', 'content.manage', 'enrollments.manage'];

        $admin = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug');
        foreach ($slugs as $slug) {
            $this->assertTrue($admin->contains($slug), "Admin harus punya {$slug}.");
        }

        // Diubah saat halaman Mentor/Lembaga dikerjakan (keputusan 8: aturan kepemilikan sudah siap, izinnya belum diberikan).
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $role) {
            $permissions = Role::where('slug', $role)->firstOrFail()->permissions->pluck('slug');
            foreach ($slugs as $slug) {
                $this->assertFalse($permissions->contains($slug), "{$role} belum boleh punya {$slug}.");
            }
        }
    }

    // ------------------------------------------------------------------ Policy

    public function test_admin_can_manage_every_non_institution_course(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $course = Course::factory()->mentoredBy($this->userWithRole(Role::MENTOR))->create();

        foreach (['viewAny' => Course::class, 'view' => $course, 'viewContent' => $course, 'create' => Course::class,
            'update' => $course, 'delete' => $course, 'assignMentor' => $course, 'manageContent' => $course, 'manageEnrollments' => $course] as $ability => $arg) {
            $this->assertTrue(Gate::forUser($admin)->allows($ability, $arg), "Admin harus boleh {$ability}.");
        }
    }

    public function test_admin_can_view_but_not_change_an_institution_program(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $program = Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create();

        $this->assertTrue(Gate::forUser($admin)->allows('view', $program));
        $this->assertTrue(Gate::forUser($admin)->allows('viewContent', $program));

        foreach (['update', 'delete', 'assignMentor', 'manageContent', 'manageEnrollments'] as $ability) {
            $response = Gate::forUser($admin)->inspect($ability, $program);
            $this->assertFalse($response->allowed(), "Admin tidak boleh {$ability} pada Program Lembaga.");
            $this->assertSame('Program Lembaga hanya dapat diubah oleh lembaganya.', $response->message());
        }
    }

    public function test_a_mentor_only_manages_own_courses_once_permissions_are_granted(): void
    {
        $this->grant(Role::MENTOR, self::MENTOR_PERMISSIONS);
        $mentor = $this->userWithRole(Role::MENTOR);
        $other = $this->userWithRole(Role::MENTOR);
        $own = Course::factory()->mentoredBy($mentor)->create();
        $foreign = Course::factory()->mentoredBy($other)->create();

        $this->assertTrue(Gate::forUser($mentor)->allows('create', Course::class));
        foreach (['view', 'viewContent', 'update', 'manageContent'] as $ability) {
            $this->assertTrue(Gate::forUser($mentor)->allows($ability, $own), "Mentor boleh {$ability} kursusnya.");
            $this->assertFalse(Gate::forUser($mentor)->allows($ability, $foreign), "Mentor tidak boleh {$ability} kursus orang lain.");
        }

        $this->assertSame('Anda hanya dapat mengelola kursus yang Anda ampu.', Gate::forUser($mentor)->inspect('update', $foreign)->message());

        // Tidak diberikan ke Mentor: hapus, ganti Mentor, dan pendaftaran peserta (khusus Admin).
        foreach (['delete', 'assignMentor', 'manageEnrollments'] as $ability) {
            $this->assertFalse(Gate::forUser($mentor)->allows($ability, $own), "Mentor tidak boleh {$ability}.");
        }
    }

    public function test_a_mentor_cannot_do_anything_without_the_permissions(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        $own = Course::factory()->mentoredBy($mentor)->create();

        foreach (['viewAny' => Course::class, 'view' => $own, 'create' => Course::class, 'update' => $own, 'manageContent' => $own] as $ability => $arg) {
            $this->assertFalse(Gate::forUser($mentor)->allows($ability, $arg), "Tanpa permission, {$ability} harus ditolak.");
        }
    }

    public function test_a_mentor_cannot_change_a_course_where_they_are_not_the_mentor_even_if_they_created_it(): void
    {
        $this->grant(Role::MENTOR, self::MENTOR_PERMISSIONS);
        $creator = $this->userWithRole(Role::MENTOR);
        $successor = $this->userWithRole(Role::MENTOR);
        $course = Course::factory()->mentoredBy($successor)->create(['created_by' => $creator->id]);

        $this->assertFalse(Gate::forUser($creator)->allows('update', $course));
    }

    public function test_an_institution_owns_only_its_own_programs(): void
    {
        $this->grant(Role::LEMBAGA, ['courses.view', 'courses.update', 'content.manage']);
        $lembaga = $this->userWithRole(Role::LEMBAGA);
        $other = $this->userWithRole(Role::LEMBAGA);
        $own = Course::factory()->institution($lembaga)->create();
        $foreign = Course::factory()->institution($other)->create();
        $academic = Course::factory()->create();

        $this->assertTrue(Gate::forUser($lembaga)->allows('update', $own));
        $this->assertTrue(Gate::forUser($lembaga)->allows('manageContent', $own));
        $this->assertFalse(Gate::forUser($lembaga)->allows('update', $foreign));
        $this->assertFalse(Gate::forUser($lembaga)->allows('update', $academic));
    }

    #[DataProvider('participantRoles')]
    public function test_participants_have_no_management_rights(string $role): void
    {
        $user = $this->userWithRole($role);
        $course = Course::factory()->active()->create();
        Enrollment::factory()->create(['course_id' => $course->id, 'user_id' => $user->id]);

        foreach (['viewAny' => Course::class, 'view' => $course, 'create' => Course::class, 'update' => $course, 'delete' => $course,
            'assignMentor' => $course, 'manageContent' => $course, 'manageEnrollments' => $course] as $ability => $arg) {
            $this->assertFalse(Gate::forUser($user)->allows($ability, $arg), "{$role} tidak boleh {$ability}.");
        }
    }

    public static function participantRoles(): array
    {
        return [['siswa'], ['karyawan']];
    }
}
