<?php

namespace Tests\Feature;

use App\Models\ClassSession;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Material;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoCourseSeeder;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoCourseSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        config(['lms.demo_password' => 'KataSandiDemo123']);
    }

    private function seedAll(): void
    {
        $this->seed(DemoUserSeeder::class);
        $this->seed(DemoCourseSeeder::class);
    }

    private function demoCourses()
    {
        return Course::query()->whereIn('title', DemoCourseSeeder::titles());
    }

    public function test_creates_varied_courses_with_modules_sessions_and_participants(): void
    {
        $this->seedAll();

        $courses = $this->demoCourses()->get();
        $this->assertCount(count(DemoCourseSeeder::titles()), $courses);
        $this->assertEqualsCanonicalizing(['academic', 'training', 'webinar', 'institution'], $courses->pluck('type')->unique()->values()->all());
        $this->assertEqualsCanonicalizing(['draft', 'active', 'inactive'], $courses->pluck('status')->unique()->values()->all());

        $this->assertGreaterThan(0, CourseModule::count());
        $this->assertGreaterThan(0, Material::count());
        $this->assertGreaterThan(0, ClassSession::count());
        $this->assertGreaterThan(5, Enrollment::count());
    }

    public function test_every_demo_course_obeys_the_business_rules(): void
    {
        $this->seedAll();

        foreach ($this->demoCourses()->get() as $course) {
            // Kursus aktif non-lembaga wajib punya Mentor; Program Lembaga tidak memakai Mentor.
            if ($course->requiresMentor() && $course->status === Course::STATUS_ACTIVE) {
                $this->assertNotNull($course->mentor_id, "{$course->title} aktif tetapi tanpa Mentor.");
            }
            if ($course->isInstitutionProgram()) {
                $this->assertNull($course->mentor_id);
                $this->assertNotNull($course->created_by);
            } else {
                $this->assertTrue($course->mentor->hasRole(Role::MENTOR), "{$course->title}: pengampu harus berrole Mentor.");
            }

            // XP hanya untuk jenis yang mengizinkan.
            $xp = Material::query()->whereIn('course_module_id', $course->modules()->pluck('id'))->sum('xp_points');
            if (! $course->allowsXp()) {
                $this->assertSame(0, (int) $xp, "{$course->title} tidak boleh punya XP.");
            }

            // Peserta sesuai role jenis kursus dan akunnya aktif.
            foreach ($course->enrollments()->with('user.roles')->get() as $enrollment) {
                $this->assertTrue($enrollment->user->hasRole($course->participantRole()), "{$course->title}: role peserta tidak sesuai.");
            }

            // Sesi: selesai setelah mulai, dan tanggal ke depan.
            foreach ($course->sessions as $session) {
                $this->assertTrue($session->ends_at->greaterThan($session->starts_at));
                $this->assertTrue($session->starts_at->isFuture());
            }
        }
    }

    public function test_is_idempotent(): void
    {
        $this->seedAll();
        $counts = fn () => [Course::count(), CourseModule::count(), Material::count(), ClassSession::count(), Enrollment::count()];
        $before = $counts();

        $this->seed(DemoCourseSeeder::class);
        $this->seed(DemoCourseSeeder::class);

        $this->assertSame($before, $counts(), 'Seeding ulang tidak boleh menggandakan data.');
    }

    public function test_reseeding_repairs_changes_and_reactivates_cancelled_enrollments(): void
    {
        $this->seedAll();
        $course = Course::where('title', 'Dasar Pemrograman Web')->firstOrFail();
        $course->update(['status' => 'inactive']);
        Enrollment::where('course_id', $course->id)->first()->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        $this->seed(DemoCourseSeeder::class);

        $this->assertSame('active', $course->fresh()->status);
        $this->assertSame(0, Enrollment::where('course_id', $course->id)->where('status', 'cancelled')->count());
    }

    public function test_refuses_without_demo_users(): void
    {
        $this->artisan('db:seed', ['--class' => DemoCourseSeeder::class])
            ->expectsOutputToContain('Akun demo belum ada')
            ->assertSuccessful();

        $this->assertSame(0, Course::count());
    }

    public function test_refuses_to_run_outside_local_environment(): void
    {
        $this->seed(DemoUserSeeder::class);
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--class' => DemoCourseSeeder::class, '--force' => true])
            ->expectsOutputToContain('hanya boleh dijalankan di lingkungan local')
            ->assertSuccessful();

        $this->assertSame(0, Course::count());
    }

    public function test_default_db_seed_does_not_create_demo_courses(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Course::count());
    }

    public function test_the_admin_api_lists_the_demo_courses_and_marks_the_institution_program_read_only(): void
    {
        $this->seedAll();
        $admin = $this->userWithRole(Role::ADMIN);

        $response = $this->actingAs($admin, 'web')->getJson('/api/v1/courses?per_page=50')->assertOk();
        $this->assertSame(count(DemoCourseSeeder::titles()), $response->json('meta.total'));

        $program = collect($response->json('data'))->firstWhere('type', 'institution');
        $this->assertFalse($program['abilities']['update']);

        $web = collect($response->json('data'))->firstWhere('title', 'Dasar Pemrograman Web');
        $this->assertSame(6, $web['participants_count']);
        $this->assertSame(2, $web['modules_count']);
        $this->assertSame(2, $web['sessions_count']);
        $this->assertTrue($web['abilities']['update']);
    }
}
