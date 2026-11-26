<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\ClassSession;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Level;
use App\Models\Material;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use App\Support\Rbac\Catalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * BUKTI bahwa sakelar di Pengaturan > Role & Akses benar-benar mengendalikan fiturnya.
 *
 * Untuk setiap izin yang ditegakkan backend dan setiap role yang boleh menerimanya:
 *   1. Admin MENYALAKAN izin lewat API Pengaturan yang asli, lalu endpoint fiturnya dipanggil sebagai pengguna role itu: harus terbuka.
 *   2. Admin MEMATIKAN izin lewat API yang sama (izin lain tetap menyala), lalu endpoint yang sama harus 403.
 * Ditambah dua penyapu seluruh rute API:
 *   - role tanpa satu pun izin harus ditolak (403) di SEMUA rute kecuali rute swa-layan yang didaftarkan eksplisit;
 *   - Admin dengan seluruh izin tidak boleh ditolak di rute mana pun (tidak ada izin yang terlupa).
 * Rute baru tanpa penjagaan izin akan membuat penyapu pertama gagal sehingga tidak bisa lolos tanpa disadari.
 */
class RbacEnforcementTest extends TestCase
{
    use RefreshDatabase;

    /** Rute swa-layan: hanya butuh login (atau tanpa login), tidak diatur matriks. */
    private const SELF_SERVICE = [
        'GET api/v1/health',
        'POST api/v1/auth/login',
        'POST api/v1/auth/logout',
        'POST api/v1/auth/password',
        'GET api/v1/auth/me',
    ];

    /** Status yang berarti "lolos otorisasi" (respons sukses atau galat validasi). */
    private const ALLOWED = [200, 201, 202, 204, 422];

    private User $admin;

    /** Penghitung agar nilai unik fixture (kode, slug, batas XP) tidak bentrok saat fixture dibuat ulang. */
    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN);
    }

    // ------------------------------------------------------------------ probe: izin => panggilan endpoint

    /**
     * Setiap izin memiliki minimal satu panggilan yang HANYA dijaga izin itu (ditambah batas kepemilikan data).
     *
     * @return array<string, array<int, callable(object): array{0:string,1:string,2?:array<string,mixed>}>>
     */
    public static function probes(): array
    {
        $base = '/api/v1';

        return [
            'users.view' => [fn ($f) => ['GET', "$base/users"], fn ($f) => ['GET', "$base/users/{$f->student->id}"]],
            'users.create' => [fn ($f) => ['POST', "$base/users", ['name' => 'Baru', 'email' => 'baru-'.uniqid().'@x.test', 'role' => 'siswa']]],
            'users.update' => [fn ($f) => ['PATCH', "$base/users/{$f->student->id}", ['name' => 'Diubah']]],
            'users.delete' => [fn ($f) => ['DELETE', "$base/users/{$f->student->id}"]],
            'users.export' => [fn ($f) => ['GET', "$base/users/export"]],
            'users.reset_password' => [fn ($f) => ['POST', "$base/users/{$f->student->id}/reset-password"]],
            'audit.view' => [fn ($f) => ['GET', "$base/audit-logs"]],

            'courses.view' => [fn ($f) => ['GET', "$base/courses"], fn ($f) => ['GET', "$base/courses/{$f->course->id}"], fn ($f) => ['GET', "$base/courses/{$f->course->id}/modules"], fn ($f) => ['GET', "$base/courses/{$f->course->id}/sessions"]],
            'courses.create' => [fn ($f) => ['POST', "$base/courses", ['type' => 'academic', 'title' => 'Kursus Uji RBAC']]],
            'courses.update' => [fn ($f) => ['PATCH', "$base/courses/{$f->course->id}", ['title' => 'Judul Baru']]],
            'courses.delete' => [fn ($f) => ['DELETE', "$base/courses/{$f->course->id}"]],
            'courses.assign_mentor' => [fn ($f) => ['PUT', "$base/courses/{$f->course->id}/mentor", ['mentor_id' => null]]],
            'content.manage' => [
                fn ($f) => ['POST', "$base/courses/{$f->course->id}/modules", ['title' => 'Modul Uji']],
                fn ($f) => ['PATCH', "$base/modules/{$f->module->id}", ['title' => 'Modul Diubah']],
                fn ($f) => ['DELETE', "$base/materials/{$f->material->id}"],
                fn ($f) => ['GET', "$base/sessions/{$f->session->id}/meeting-link"],
                fn ($f) => ['DELETE', "$base/sessions/{$f->session->id}"],
            ],
            'enrollments.manage' => [fn ($f) => ['GET', "$base/courses/{$f->course->id}/enrollments"], fn ($f) => ['DELETE', "$base/enrollments/{$f->enrollment->id}"]],

            'assignments.view' => [fn ($f) => ['GET', "$base/assignments"], fn ($f) => ['GET', "$base/assignments/{$f->assignment->id}"]],
            'assignments.manage' => [
                fn ($f) => ['POST', "$base/courses/{$f->course->id}/assignments", ['title' => 'Tugas Uji', 'kind' => 'task', 'questions' => [['type' => 'essay', 'prompt' => 'Jelaskan.', 'points' => 100]]]],
                fn ($f) => ['PATCH', "$base/assignments/{$f->assignment->id}", ['title' => 'Tugas Diubah']],
                fn ($f) => ['PATCH', "$base/assignments/{$f->assignment->id}/activation", ['is_active' => false]],
                fn ($f) => ['DELETE', "$base/assignments/{$f->assignment->id}"],
            ],
            'assignments.grade' => [
                fn ($f) => ['GET', "$base/assignments/{$f->assignment->id}/submissions"],
                fn ($f) => ['GET', "$base/submissions/{$f->submission->id}"],
                fn ($f) => ['PATCH', "$base/submissions/{$f->submission->id}", ['score' => 80]],
            ],
            'assignments.review' => [fn ($f) => ['POST', "$base/assignments/{$f->assignment->id}/review", ['decision' => 'approve']]],

            'coupons.view' => [fn ($f) => ['GET', "$base/coupons"], fn ($f) => ['GET', "$base/coupons/{$f->coupon->id}"]],
            'coupons.create' => [fn ($f) => ['POST', "$base/coupons", ['code' => 'RBAC'.random_int(100, 999), 'discount_type' => 'percentage', 'discount_value' => 10]]],
            'coupons.update' => [fn ($f) => ['PATCH', "$base/coupons/{$f->coupon->id}", ['name' => 'Diubah']]],
            'coupons.delete' => [fn ($f) => ['DELETE', "$base/coupons/{$f->coupon->id}"]],

            'gamification.view' => [fn ($f) => ['GET', "$base/gamification/leaderboard"], fn ($f) => ['GET', "$base/gamification/summary"], fn ($f) => ['GET', "$base/gamification/levels"], fn ($f) => ['GET', "$base/gamification/users/{$f->student->id}/xp"]],
            'gamification.manage' => [
                fn ($f) => ['POST', "$base/gamification/levels", ['name' => 'Level Uji', 'min_xp' => 100]],
                fn ($f) => ['PATCH', "$base/gamification/levels/{$f->level->id}", ['name' => 'Level Diubah']],
                fn ($f) => ['POST', "$base/gamification/users/{$f->student->id}/xp-adjustments", ['amount' => 5, 'reason' => 'Uji RBAC']],
            ],

            'institutions.view' => [fn ($f) => ['GET', "$base/institutions"], fn ($f) => ['GET', "$base/institutions/{$f->institution->id}"], fn ($f) => ['GET', "$base/institutions/{$f->institution->id}/dashboard"], fn ($f) => ['GET', "$base/institutions/{$f->institution->id}/payouts"]],
            'institutions.create' => [fn ($f) => ['POST', "$base/institutions", ['name' => 'Bimbel '.uniqid(), 'email' => 'lembaga-'.uniqid().'@x.test', 'revenue_share_percent' => 80]]],
            'institutions.update' => [fn ($f) => ['PATCH', "$base/institutions/{$f->institution->id}", ['description' => 'Diubah']]],
            'institutions.delete' => [fn ($f) => ['DELETE', "$base/institutions/{$f->emptyInstitution->id}"], fn ($f) => ['POST', "$base/institutions/{$f->emptyInstitution->id}/restore"]],
            'institutions.payout' => [fn ($f) => ['POST', "$base/institutions/{$f->institution->id}/payouts", ['amount' => 1000]], fn ($f) => ['PATCH', "$base/institutions/{$f->institution->id}/payouts/{$f->payout->id}", ['status' => 'completed']]],

            'roles.view' => [fn ($f) => ['GET', "$base/roles"], fn ($f) => ['GET', "$base/settings/roles"], fn ($f) => ['GET', "$base/settings/roles/{$f->customRole->id}"], fn ($f) => ['GET', "$base/settings/permissions"]],
            'roles.manage' => [
                fn ($f) => ['POST', "$base/settings/roles", ['name' => 'Peran Uji '.uniqid()]],
                fn ($f) => ['PATCH', "$base/settings/roles/{$f->customRole->id}", ['description' => 'Diubah']],
                fn ($f) => ['POST', "$base/settings/roles/{$f->customRole->id}/reset"],
                fn ($f) => ['DELETE', "$base/settings/roles/{$f->customRole->id}"],
            ],
            'dashboard.admin' => [fn ($f) => ['GET', "$base/admin/summary"]],
        ];
    }


    // ------------------------------------------------------------------ probe per SEL matriks: aktivitas.aksi => panggilan endpoint

    /**
     * Setiap sel aktif di matriks dipetakan ke fitur yang dikendalikannya. Dipakai untuk membuktikan bahwa
     * sakelar "Sesi dan Live > Hapus" memang mengendalikan penghapusan sesi (bukan hanya bahwa izinnya dipakai di suatu tempat).
     *
     * @return array<string, array<int, callable(object): array{0:string,1:string,2?:array<string,mixed>}>>
     */
    public static function cellProbes(): array
    {
        $b = '/api/v1';
        $admin = [fn ($f) => ['GET', "$b/admin/summary"]];

        return [
            'dashboard_admin.read' => $admin,
            'platform_statistics.read' => $admin,

            'users.create' => [fn ($f) => ['POST', "$b/users", ['name' => 'Baru', 'email' => 'baru-'.uniqid().'@x.test', 'role' => 'siswa']]],
            'users.read' => [fn ($f) => ['GET', "$b/users"], fn ($f) => ['GET', "$b/users/{$f->student->id}"]],
            'users.update' => [fn ($f) => ['PATCH', "$b/users/{$f->student->id}", ['name' => 'Diubah']]],
            'users.delete' => [fn ($f) => ['DELETE', "$b/users/{$f->student->id}"]],
            'users_export.read' => [fn ($f) => ['GET', "$b/users/export"]],
            'users_reset_password.update' => [fn ($f) => ['POST', "$b/users/{$f->student->id}/reset-password"]],
            'audit_log.read' => [fn ($f) => ['GET', "$b/audit-logs"]],

            'courses.create' => [fn ($f) => ['POST', "$b/courses", ['type' => 'academic', 'title' => 'Kursus Uji']]],
            'courses.read' => [fn ($f) => ['GET', "$b/courses"], fn ($f) => ['GET', "$b/courses/{$f->course->id}"]],
            'courses.update' => [fn ($f) => ['PATCH', "$b/courses/{$f->course->id}", ['title' => 'Judul Baru']]],
            'courses.delete' => [fn ($f) => ['DELETE', "$b/courses/{$f->course->id}"]],

            'modules_materials.create' => [fn ($f) => ['POST', "$b/courses/{$f->course->id}/modules", ['title' => 'Modul Baru']], fn ($f) => ['POST', "$b/modules/{$f->module->id}/materials", ['title' => 'Materi Baru', 'type' => 'link', 'url' => 'https://contoh.test/x']]],
            'modules_materials.read' => [fn ($f) => ['GET', "$b/courses/{$f->course->id}/modules"]],
            'modules_materials.update' => [fn ($f) => ['PATCH', "$b/modules/{$f->module->id}", ['title' => 'Diubah']], fn ($f) => ['PATCH', "$b/materials/{$f->material->id}", ['title' => 'Diubah']]],
            'modules_materials.delete' => [fn ($f) => ['DELETE', "$b/materials/{$f->material->id}"], fn ($f) => ['DELETE', "$b/modules/{$f->module->id}"]],

            'sessions.create' => [fn ($f) => ['POST', "$b/courses/{$f->course->id}/sessions", ['title' => 'Sesi Baru']]],
            'sessions.read' => [fn ($f) => ['GET', "$b/courses/{$f->course->id}/sessions"], fn ($f) => ['GET', "$b/sessions/{$f->session->id}"]],
            'sessions.update' => [fn ($f) => ['PATCH', "$b/sessions/{$f->session->id}", ['title' => 'Diubah']]],
            'sessions.delete' => [fn ($f) => ['DELETE', "$b/sessions/{$f->session->id}"]],

            'assign_mentor.update' => [fn ($f) => ['PUT', "$b/courses/{$f->course->id}/mentor", ['mentor_id' => null]]],

            'exam_review.read' => [fn ($f) => ['POST', "$b/assignments/{$f->assignment->id}/review", ['decision' => 'approve']]],
            'exam_review.update' => [fn ($f) => ['POST', "$b/assignments/{$f->assignment->id}/review", ['decision' => 'reject', 'note' => 'Perbaiki soal.']]],
            'assignments.create' => [fn ($f) => ['POST', "$b/courses/{$f->course->id}/assignments", ['title' => 'Tugas Baru', 'kind' => 'task', 'questions' => [['type' => 'essay', 'prompt' => 'Jelaskan.', 'points' => 100]]]]],
            'assignments.read' => [fn ($f) => ['GET', "$b/assignments"], fn ($f) => ['GET', "$b/assignments/{$f->assignment->id}"]],
            'assignments.update' => [fn ($f) => ['PATCH', "$b/assignments/{$f->assignment->id}", ['title' => 'Diubah']], fn ($f) => ['PATCH', "$b/assignments/{$f->assignment->id}/activation", ['is_active' => false]]],
            'assignments.delete' => [fn ($f) => ['DELETE', "$b/assignments/{$f->assignment->id}"]],
            'grading.read' => [fn ($f) => ['GET', "$b/assignments/{$f->assignment->id}/submissions"]],
            'grading.update' => [fn ($f) => ['PATCH', "$b/submissions/{$f->submission->id}", ['score' => 90]]],
            'participants.create' => [fn ($f) => ['POST', "$b/courses/{$f->course->id}/enrollments", ['user_ids' => [$f->student->id]]]],
            'participants.read' => [fn ($f) => ['GET', "$b/courses/{$f->course->id}/enrollments"], fn ($f) => ['GET', "$b/courses/{$f->course->id}/enrollment-candidates"]],
            'participants.delete' => [fn ($f) => ['DELETE', "$b/enrollments/{$f->enrollment->id}"]],

            'coupons.create' => [fn ($f) => ['POST', "$b/coupons", ['code' => 'CELL'.random_int(100, 999), 'discount_type' => 'percentage', 'discount_value' => 10]]],
            'coupons.read' => [fn ($f) => ['GET', "$b/coupons"], fn ($f) => ['GET', "$b/coupons/{$f->coupon->id}"]],
            'coupons.update' => [fn ($f) => ['PATCH', "$b/coupons/{$f->coupon->id}", ['name' => 'Diubah']]],
            'coupons.delete' => [fn ($f) => ['DELETE', "$b/coupons/{$f->coupon->id}"]],

            'leaderboard.read' => [fn ($f) => ['GET', "$b/gamification/leaderboard"], fn ($f) => ['GET', "$b/gamification/summary"], fn ($f) => ['GET', "$b/gamification/users/{$f->student->id}/xp"]],
            'xp.update' => [fn ($f) => ['POST', "$b/gamification/users/{$f->student->id}/xp-adjustments", ['amount' => 5, 'reason' => 'Uji RBAC']]],
            'xp.delete' => [fn ($f) => ['POST', "$b/gamification/users/{$f->student->id}/xp-reset", ['reason' => 'Uji RBAC']]],
            'levels.create' => [fn ($f) => ['POST', "$b/gamification/levels", ['name' => 'Level Baru', 'min_xp' => 777]]],
            'levels.read' => [fn ($f) => ['GET', "$b/gamification/levels"], fn ($f) => ['GET', "$b/gamification/levels/{$f->level->id}"]],
            'levels.update' => [fn ($f) => ['PATCH', "$b/gamification/levels/{$f->level->id}", ['name' => 'Diubah']]],
            'levels.delete' => [fn ($f) => ['DELETE', "$b/gamification/levels/{$f->level->id}"]],

            'institutions.create' => [fn ($f) => ['POST', "$b/institutions", ['name' => 'Bimbel '.uniqid(), 'email' => 'lembaga-'.uniqid().'@x.test', 'revenue_share_percent' => 80]]],
            'institutions.read' => [fn ($f) => ['GET', "$b/institutions"], fn ($f) => ['GET', "$b/institutions/{$f->institution->id}"], fn ($f) => ['GET', "$b/institutions/{$f->institution->id}/dashboard"], fn ($f) => ['GET', "$b/institutions/{$f->institution->id}/payouts"]],
            'institutions.update' => [fn ($f) => ['PATCH', "$b/institutions/{$f->institution->id}", ['description' => 'Diubah']]],
            'institutions.delete' => [fn ($f) => ['DELETE', "$b/institutions/{$f->emptyInstitution->id}"]],
            'institution_payouts.create' => [fn ($f) => ['POST', "$b/institutions/{$f->institution->id}/payouts", ['amount' => 1000]]],
            'institution_payouts.update' => [fn ($f) => ['PATCH', "$b/institutions/{$f->institution->id}/payouts/{$f->payout->id}", ['status' => 'completed']]],

            'roles.create' => [fn ($f) => ['POST', "$b/settings/roles", ['name' => 'Peran Uji '.uniqid()]]],
            'roles.read' => [fn ($f) => ['GET', "$b/settings/roles"], fn ($f) => ['GET', "$b/settings/roles/{$f->customRole->id}"], fn ($f) => ['GET', "$b/settings/permissions"]],
            'roles.update' => [fn ($f) => ['PATCH', "$b/settings/roles/{$f->customRole->id}", ['description' => 'Diubah']], fn ($f) => ['POST', "$b/settings/roles/{$f->customRole->id}/reset"]],
            'roles.delete' => [fn ($f) => ['DELETE', "$b/settings/roles/{$f->customRole->id}"]],
        ];
    }

    /** @return array<string, array{0:string,1:string,2:string,3:string}> setiap sel aktif x role penerimanya: [aktivitas.aksi, slug, role] */
    public static function cellRolePairs(): array
    {
        $pairs = [];
        foreach (Catalog::activities() as $activity) {
            if ($activity['status'] !== Catalog::STATUS_ACTIVE) {
                continue;
            }
            foreach ($activity['cells'] as $action => $cell) {
                if (in_array($cell['slug'], Catalog::CLIENT_ONLY, true)) {
                    continue;
                }
                foreach ($cell['roles'] as $roleKey) {
                    $key = "{$activity['key']}.{$action}";
                    $pairs["$key -> $roleKey"] = [$key, $cell['slug'], $roleKey];
                }
            }
        }

        return $pairs;
    }

    /** Izin yang tidak punya endpoint API: dikirim ke frontend lewat /auth/me. */
    private function clientOnly(): array
    {
        return Catalog::CLIENT_ONLY;
    }

    // ------------------------------------------------------------------ data provider

    /** @return array<string, array{0:string,1:string}> setiap pasangan (izin, role penerima) */
    public static function permissionRolePairs(): array
    {
        $pairs = [];
        foreach (Catalog::enforcedSlugs() as $slug) {
            if (in_array($slug, Catalog::CLIENT_ONLY, true)) {
                continue;
            }
            foreach ([...Catalog::SYSTEM_ROLES, Catalog::CUSTOM] as $roleKey) {
                if (in_array($slug, Catalog::assignable($roleKey), true)) {
                    $pairs["$slug -> $roleKey"] = [$slug, $roleKey];
                }
            }
        }

        return $pairs;
    }

    // ------------------------------------------------------------------ pembantu

    private function asUser(User $user): static
    {
        $this->app['auth']->forgetGuards();

        // fresh(): di produksi tiap request memuat ulang pengguna; objek lama menyimpan izin yang sudah di-cache.
        return $this->actingAs(User::findOrFail($user->id), 'web');
    }

    /** Pengguna dengan role yang diuji. Role khusus dibuat lewat API Pengaturan, seperti yang dilakukan Admin. */
    private function userFor(string $roleKey): array
    {
        if ($roleKey === Catalog::CUSTOM) {
            $roleId = $this->asUser($this->admin)->postJson('/api/v1/settings/roles', ['name' => 'Staf Uji'])->assertCreated()->json('data.id');
            $role = Role::findOrFail($roleId);
            $user = User::factory()->create();
            $user->roles()->attach($role);

            return [$user, $role];
        }

        $role = Role::where('slug', $roleKey)->firstOrFail();

        return [$this->userWithRole($roleKey), $role];
    }

    /** Fixture data. Data milik Mentor/Lembaga dibuat atas nama pengguna yang diuji (batas kepemilikan tetap berlaku). */
    private function fixtures(User $actor, string $roleKey): object
    {
        $student = $this->userWithRole(Role::SISWA);
        $mentor = $roleKey === Catalog::MENTOR ? $actor : $this->userWithRole(Role::MENTOR);

        $course = match ($roleKey) {
            Catalog::LEMBAGA => Course::factory()->institution($actor)->active()->create(),
            default => Course::factory()->academic()->active()->mentoredBy($mentor)->create(['created_by' => $mentor->id]),
        };

        $n = ++$this->seq;
        $institution = Institution::factory()->withBank()->create();
        Transaction::factory()->amount(1_000_000)->create(['institution_id' => $institution->id]);
        $module = CourseModule::factory()->create(['course_id' => $course->id]);

        return (object) [
            'student' => $student,
            'course' => $course,
            'module' => $module,
            'material' => Material::factory()->create(['course_module_id' => $module->id]),
            'session' => ClassSession::factory()->create(['course_id' => $course->id]),
            'assignment' => Assignment::create([
                'course_id' => $course->id, 'title' => 'Tugas Fixture '.$n, 'kind' => Assignment::KIND_TASK, 'status' => Assignment::STATUS_APPROVED,
            ]),
            'submission' => AssignmentSubmission::create([
                'assignment_id' => Assignment::where('course_id', $course->id)->latest('id')->firstOrFail()->id,
                'user_id' => $student->id, 'submitted_at' => now(), 'status' => AssignmentSubmission::STATUS_SUBMITTED,
            ]),
            'enrollment' => Enrollment::factory()->create(['course_id' => $course->id, 'user_id' => $student->id]),
            'coupon' => Coupon::factory()->create(),
            'level' => Level::create(['name' => 'Level Fixture '.$n, 'min_xp' => $n * 1000]),
            'institution' => $institution,
            'emptyInstitution' => Institution::factory()->create(),
            'payout' => InstitutionPayout::create(['code' => 'PO-RBAC-'.$n, 'amount' => 1000, 'institution_id' => $institution->id]),
            'customRole' => Role::create(['slug' => 'peran-fixture-'.$n, 'name' => 'Peran Fixture '.$n]),
        ];
    }

    /** Admin memasang daftar izin pada role LEWAT API Pengaturan (bukan lewat database). */
    private function setRolePermissions(Role $role, array $permissions): void
    {
        $this->asUser($this->admin)
            ->patchJson("/api/v1/settings/roles/{$role->id}", ['permissions' => array_values(array_unique($permissions))])
            ->assertOk();
    }

    /** @param  array<int, callable> $probes */
    private function statuses(User $actor, object $fixtures, array $probes): array
    {
        $out = [];
        foreach ($probes as $i => $probe) {
            [$method, $uri, $payload] = array_pad($probe($fixtures), 3, []);
            $out["$method $uri"] = $this->asUser($actor)->json($method, $uri, $payload)->getStatusCode();
        }

        return $out;
    }

    // ------------------------------------------------------------------ 1. satu sakelar = satu fitur (menyala dan mati)

    #[DataProvider('permissionRolePairs')]
    public function test_turning_a_permission_on_enables_its_feature_and_turning_it_off_disables_it(string $slug, string $roleKey): void
    {
        $this->assertArrayHasKey($slug, self::probes(), "Izin {$slug} belum punya probe penegakan.");

        [$actor, $role] = $this->userFor($roleKey);
        $fixtures = $this->fixtures($actor, $roleKey);
        $probes = self::probes()[$slug];
        $required = Catalog::required($roleKey);

        // MENYALA: hanya izin ini (dan izin wajib role) -> semua panggilannya lolos otorisasi.
        $this->setRolePermissions($role, [...$required, $slug]);
        foreach ($this->statuses($actor, $fixtures, $probes) as $call => $status) {
            $this->assertContains($status, self::ALLOWED, "[{$roleKey}] {$slug} NYALA tetapi {$call} => {$status}");
        }

        // MATI: semua izin lain menyala kecuali ini -> panggilan yang sama harus 403.
        if (! in_array($slug, $required, true)) {
            $others = array_values(array_diff(Catalog::assignable($roleKey), [$slug]));
            $this->setRolePermissions($role, $others);

            // Fixture dibuat ulang: panggilan sebelumnya (mis. DELETE) bisa sudah mengubah datanya.
            $fixtures = $this->fixtures($actor, $roleKey);
            foreach ($this->statuses($actor, $fixtures, $probes) as $call => $status) {
                $this->assertSame(403, $status, "[{$roleKey}] {$slug} MATI tetapi {$call} => {$status}");
            }
        }
    }


    // ------------------------------------------------------------------ 1b. satu SEL matriks = satu fitur

    #[DataProvider('cellRolePairs')]
    public function test_each_matrix_cell_controls_exactly_the_feature_it_is_labelled_with(string $cell, string $slug, string $roleKey): void
    {
        $this->assertArrayHasKey($cell, self::cellProbes(), "Sel {$cell} belum punya probe.");

        [$actor, $role] = $this->userFor($roleKey);
        $probes = self::cellProbes()[$cell];
        $required = Catalog::required($roleKey);

        $this->setRolePermissions($role, [...$required, $slug]);
        foreach ($this->statuses($actor, $this->fixtures($actor, $roleKey), $probes) as $call => $status) {
            $this->assertContains($status, self::ALLOWED, "[{$roleKey}] sel {$cell} NYALA ({$slug}) tetapi {$call} => {$status}");
        }

        if (! in_array($slug, $required, true)) {
            $this->setRolePermissions($role, array_values(array_diff(Catalog::assignable($roleKey), [$slug])));
            foreach ($this->statuses($actor, $this->fixtures($actor, $roleKey), $probes) as $call => $status) {
                $this->assertSame(403, $status, "[{$roleKey}] sel {$cell} MATI ({$slug}) tetapi {$call} => {$status}");
            }
        }
    }

    public function test_every_active_matrix_cell_has_a_probe_and_no_probe_is_orphaned(): void
    {
        $cells = [];
        foreach (Catalog::activities() as $activity) {
            if ($activity['status'] !== Catalog::STATUS_ACTIVE) {
                continue;
            }
            foreach ($activity['cells'] as $action => $cell) {
                if (! in_array($cell['slug'], Catalog::CLIENT_ONLY, true)) {
                    $cells[] = "{$activity['key']}.{$action}";
                }
            }
        }

        $this->assertSame([], array_values(array_diff($cells, array_keys(self::cellProbes()))), 'Sel aktif tanpa probe penegakan.');
        $this->assertSame([], array_values(array_diff(array_keys(self::cellProbes()), $cells)), 'Probe untuk sel yang tidak ada di katalog.');
    }

    // ------------------------------------------------------------------ 2. semua mati = tidak ada akses; semua nyala = akses penuh

    #[DataProvider('roleKeys')]
    public function test_a_role_with_only_its_required_permissions_cannot_use_any_feature(string $roleKey): void
    {
        [$actor, $role] = $this->userFor($roleKey);
        $fixtures = $this->fixtures($actor, $roleKey);
        $this->setRolePermissions($role, Catalog::required($roleKey));

        foreach (self::probes() as $slug => $probes) {
            if (in_array($slug, Catalog::required($roleKey), true)) {
                continue; // izin wajib role ini memang menyala
            }
            foreach ($this->statuses($actor, $fixtures, $probes) as $call => $status) {
                $this->assertSame(403, $status, "[{$roleKey}] semua izin mati tetapi {$call} ({$slug}) => {$status}");
            }
        }
    }

    #[DataProvider('roleKeys')]
    public function test_a_role_with_every_applicable_permission_can_use_every_feature_it_may_have(string $roleKey): void
    {
        [$actor, $role] = $this->userFor($roleKey);
        $fixtures = $this->fixtures($actor, $roleKey);
        $this->setRolePermissions($role, Catalog::assignable($roleKey));

        $assignable = Catalog::assignable($roleKey);
        foreach (self::probes() as $slug => $probes) {
            if (! in_array($slug, $assignable, true)) {
                // Fitur di luar jangkauan role: tetap 403 walau semua izin yang berlaku dinyalakan.
                foreach ($this->statuses($actor, $fixtures, $probes) as $call => $status) {
                    $this->assertSame(403, $status, "[{$roleKey}] {$call} ({$slug}) seharusnya tertutup => {$status}");
                }

                continue;
            }

            foreach ($this->statuses($actor, $this->fixtures($actor, $roleKey), $probes) as $call => $status) {
                $this->assertContains($status, self::ALLOWED, "[{$roleKey}] {$slug} nyala tetapi {$call} => {$status}");
            }
        }
    }

    public static function roleKeys(): array
    {
        return array_combine([...Catalog::SYSTEM_ROLES, Catalog::CUSTOM], array_map(fn ($k) => [$k], [...Catalog::SYSTEM_ROLES, Catalog::CUSTOM]));
    }

    // ------------------------------------------------------------------ 3. penyapu seluruh rute

    /**
     * @return array<int, array{0:string,1:string,2:array<string,string>}> [method, uri template, nama parameter]
     */
    private function apiRoutes(): array
    {
        $routes = [];
        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/v1')) {
                continue;
            }
            $method = collect($route->methods())->first(fn ($m) => ! in_array($m, ['HEAD', 'OPTIONS'], true));
            if (in_array("$method {$route->uri()}", self::SELF_SERVICE, true)) {
                continue;
            }
            $routes[] = [$method, '/'.$route->uri(), $route->parameterNames()];
        }

        return $routes;
    }

    private function resolve(string $uri, array $names, object $f): string
    {
        $map = [
            'course' => $f->course->id, 'module' => $f->module->id, 'material' => $f->material->id, 'session' => $f->session->id,
            'enrollment' => $f->enrollment->id, 'coupon' => $f->coupon->id, 'user' => $f->student->id, 'institution' => $f->institution->id,
            'payout' => $f->payout->id, 'role' => $f->customRole->id, 'level' => $f->level->id,
            'assignment' => $f->assignment->id, 'submission' => $f->submission->id,
        ];

        foreach ($names as $name) {
            $this->assertArrayHasKey($name, $map, "Parameter rute {{$name}} belum ada di peta fixture penyapu.");
            $uri = str_replace('{'.$name.'}', (string) $map[$name], $uri);
        }

        return $uri;
    }

    public function test_the_sweep_covers_every_api_route(): void
    {
        $routes = $this->apiRoutes();

        $this->assertGreaterThanOrEqual(60, count($routes), 'Penyapu seharusnya mencakup seluruh rute API.');
        $this->assertSame(count(array_unique(array_map(fn ($r) => "$r[0] $r[1]", $routes))), count($routes));
    }

    public function test_a_role_with_no_permission_at_all_is_denied_on_every_non_self_service_route(): void
    {
        [$actor, $role] = $this->userFor(Catalog::CUSTOM);
        $this->setRolePermissions($role, []);
        $fixtures = $this->fixtures($actor, Catalog::CUSTOM);
        $open = [];

        foreach ($this->apiRoutes() as [$method, $uri, $names]) {
            $status = $this->asUser($actor)->json($method, $this->resolve($uri, $names, $fixtures))->getStatusCode();

            if ($status !== 403) {
                $open[] = "$method $uri => $status";
            }
        }

        $this->assertSame([], $open, "Rute tanpa penjagaan izin (tambahkan permission/policy, atau daftarkan sebagai swa-layan bila memang untuk semua pengguna login):\n".implode("\n", $open));
    }

    public function test_an_admin_with_every_permission_is_never_denied_on_any_route(): void
    {
        $adminRole = Role::where('slug', Role::ADMIN)->firstOrFail();
        $this->setRolePermissions($adminRole, Catalog::assignable(Catalog::ADMIN));
        $probeAdmin = $this->userWithRole(Role::ADMIN);
        $fixtures = $this->fixtures($probeAdmin, Catalog::ADMIN);
        $denied = [];

        // Urutan: baca dahulu, ubah/hapus belakangan, agar fixture tetap ada saat dibaca.
        $routes = $this->apiRoutes();
        usort($routes, fn ($a, $b) => (int) ($a[0] !== 'GET') <=> (int) ($b[0] !== 'GET'));

        foreach ($routes as [$method, $uri, $names]) {
            $status = $this->asUser($probeAdmin)->json($method, $this->resolve($uri, $names, $fixtures))->getStatusCode();

            if (in_array($status, [401, 403], true)) {
                $denied[] = "$method $uri => $status";
            }
        }

        $this->assertSame([], $denied, "Admin dengan semua izin ditolak di:\n".implode("\n", $denied));
    }

    // ------------------------------------------------------------------ 4. kelengkapan peta penegakan

    public function test_every_enforced_permission_has_a_probe_or_is_client_only(): void
    {
        foreach (Catalog::enforcedSlugs() as $slug) {
            $this->assertTrue(
                array_key_exists($slug, self::probes()) || in_array($slug, $this->clientOnly(), true),
                "Izin {$slug} aktif di matriks tetapi belum diuji penegakannya. Tambahkan probe di RbacEnforcementTest::probes()."
            );
        }

        foreach (array_keys(self::probes()) as $slug) {
            $this->assertContains($slug, Catalog::enforcedSlugs(), "Probe untuk {$slug} tetapi izinnya tidak ada di katalog.");
        }
    }

    public function test_client_only_permissions_reach_the_frontend_through_auth_me(): void
    {
        foreach ($this->clientOnly() as $slug) {
            $roleSlug = substr($slug, strlen('dashboard.'));
            $user = $this->userWithRole($roleSlug);
            $this->app['auth']->forgetGuards();

            $permissions = $this->actingAs($user, 'web')->getJson('/api/v1/auth/me')->assertOk()->json('data.permissions');
            $this->assertContains($slug, $permissions);
            $this->assertEqualsCanonicalizing(Role::where('slug', $roleSlug)->firstOrFail()->permissions->pluck('slug')->all(), $permissions);
        }
    }
}
