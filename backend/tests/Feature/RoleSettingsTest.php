<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\Rbac\Catalog;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Pengaturan > Role dan Akses: daftar role, matriks per role, perubahan izin, role khusus, dan pengamannya.
 * Bukti bahwa sakelar mengendalikan fitur ada di RbacEnforcementTest; di sini perilaku API Pengaturan itu sendiri.
 */
class RoleSettingsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN);
    }

    private function asAdmin(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs(User::findOrFail($this->admin->id), 'web');
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        // fresh(): di produksi tiap request memuat ulang pengguna; objek lama menyimpan izin yang sudah di-cache.
        return $this->actingAs(User::findOrFail($user->id), 'web');
    }

    private function role(string $slug): Role
    {
        return Role::where('slug', $slug)->firstOrFail();
    }

    private function permissionsOf(string $slug): array
    {
        return $this->role($slug)->permissions()->pluck('slug')->sort()->values()->all();
    }

    private function url(string $slug, string $suffix = ''): string
    {
        return '/api/v1/settings/roles/'.$this->role($slug)->id.$suffix;
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ baca

    public function test_the_role_list_shows_counts_and_the_summary_cards(): void
    {
        $this->userWithRole(Role::MENTOR);
        $this->userWithRole(Role::MENTOR);
        $this->userWithRole(Role::LEMBAGA);

        $response = $this->asAdmin()->getJson('/api/v1/settings/roles')->assertOk();

        $response->assertJsonCount(5, 'data')
            ->assertJsonPath('summary.total_roles', 5)
            ->assertJsonPath('summary.total_users', 4)
            ->assertJsonPath('summary.custom_roles', 0);

        $byRole = collect($response->json('data'))->keyBy('slug');
        $this->assertSame(1, $byRole['admin']['users_count']);
        $this->assertSame(2, $byRole['mentor']['users_count']);
        $this->assertTrue($byRole['mentor']['is_system']);
        $this->assertFalse($byRole['mentor']['can_delete']);
        $this->assertFalse($byRole['mentor']['can_rename']);
        $this->assertSame(count(RolePermissionSeeder::MATRIX['lembaga']), $byRole['lembaga']['permissions_count']);
        $this->assertSame(count(Catalog::assignable('mentor')), $byRole['mentor']['assignable_count']);
    }

    public function test_the_role_detail_contains_the_permissions_and_the_full_matrix(): void
    {
        $response = $this->asAdmin()->getJson($this->url(Role::MENTOR))->assertOk()
            ->assertJsonPath('data.slug', 'mentor')
            ->assertJsonPath('data.permissions', ['assignments.grade', 'assignments.manage', 'assignments.view', 'content.manage', 'courses.create', 'courses.update', 'courses.view', 'dashboard.mentor'])
            ->assertJsonPath('data.required_permissions', ['dashboard.mentor'])
            ->assertJsonPath('columns', ['create', 'read', 'update', 'delete']);

        $modules = collect($response->json('matrix'))->keyBy('key');
        $this->assertTrue($modules->has('dashboard'));
        $this->assertTrue($modules->has('curriculum'));
        $this->assertFalse($modules->has('users'), 'Mentor tidak punya modul Manajemen Pengguna.');

        $courses = collect($modules['curriculum']['activities'])->firstWhere('key', 'courses');
        $this->assertSame('Kursus yang Saya Ampu', $courses['label']);
        $this->assertSame('own', $courses['scope']);
        $this->assertSame(['create', 'read', 'update', 'delete'], array_column($courses['cells'], 'action'));
        $this->assertSame(['on', 'on', 'on', 'na'], array_column($courses['cells'], 'state')); // C R U untuk Mentor, D khusus Admin

        $this->asAdmin()->getJson('/api/v1/settings/roles/999999')->assertNotFound();
    }

    public function test_the_matrix_reflects_what_is_granted(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view', 'content.manage']])->assertOk();

        $matrix = collect($this->asAdmin()->getJson($this->url(Role::MENTOR))->json('matrix'))->keyBy('key');
        $states = fn (string $module, string $activity) => collect(collect($matrix[$module]['activities'])->firstWhere('key', $activity)['cells'])->pluck('state', 'action')->all();

        $this->assertSame(['create' => 'off', 'read' => 'on', 'update' => 'off', 'delete' => 'na'], $states('curriculum', 'courses'));
        // Modul, materi, dan sesi: C/U/D = content.manage (menyala), R = courses.view (menyala).
        $this->assertSame(['create' => 'on', 'read' => 'on', 'update' => 'on', 'delete' => 'on'], $states('curriculum', 'sessions'));
        $this->assertSame(['create' => 'na', 'read' => 'locked', 'update' => 'na', 'delete' => 'na'], $states('dashboard', 'dashboard_mentor'));
    }

    public function test_planned_features_are_listed_but_unavailable(): void
    {
        $matrix = collect($this->asAdmin()->getJson($this->url(Role::SISWA))->json('matrix'))->flatMap(fn ($m) => $m['activities'])->keyBy('key');
        $employeeMatrix = collect($this->asAdmin()->getJson($this->url(Role::KARYAWAN))->json('matrix'))->flatMap(fn ($m) => $m['activities'])->keyBy('key');

        // Karyawan belum punya API fitur belajar: barisnya tetap tampil tetapi tidak dapat dinyalakan.
        $this->assertSame('planned', $employeeMatrix['karyawan_classes']['status']);
        $cell = collect($employeeMatrix['karyawan_classes']['cells'])->firstWhere('action', 'read');
        $this->assertSame('unavailable', $cell['state']);
        $this->assertNull($cell['slug']);
        $this->assertFalse($cell['editable']);
        $this->assertSame('Fitur belum dibangun.', $cell['reason']);

        // Papan peringkat Siswa sudah dibangun, jadi selnya aktif dan punya izin penegakan.
        $this->assertSame('active', $matrix['leaderboard_student']['status']);
        $this->assertSame('leaderboard.view', collect($matrix['leaderboard_student']['cells'])->firstWhere('action', 'read')['slug']);
    }

    public function test_the_permission_catalog_lists_activities_per_module_with_recipient_roles(): void
    {
        $response = $this->asAdmin()->getJson('/api/v1/settings/permissions')->assertOk()->assertJsonPath('columns', ['create', 'read', 'update', 'delete']);
        $modules = collect($response->json('data'))->keyBy('key');

        foreach (['dashboard', 'users', 'curriculum', 'coupons', 'gamification', 'institutions', 'settings'] as $module) {
            $this->assertTrue($modules->has($module), "Modul {$module} harus ada.");
        }

        $activity = collect($modules['institutions']['activities'])->firstWhere('key', 'institution_payouts');
        $payout = collect($activity['cells'])->firstWhere('action', 'create');
        $this->assertSame('institutions.payout', $payout['slug']);
        $this->assertSame(['admin', 'custom'], $payout['roles']);
        $this->assertTrue($payout['sensitive']);
    }

    // ------------------------------------------------------------------ ubah izin

    public function test_permissions_of_a_system_role_can_be_changed_and_take_effect_immediately(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        $this->as($mentor)->getJson('/api/v1/courses')->assertOk(); // izin kursus adalah bawaan Mentor

        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor']])->assertOk()
            ->assertJsonPath('message', 'Role berhasil diperbarui.')
            ->assertJsonPath('data.permissions', ['dashboard.mentor'])
            ->assertJsonPath('data.permissions_count', 1);

        $this->as($mentor)->getJson('/api/v1/courses')->assertForbidden();

        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view']])->assertOk();

        $this->as($mentor)->getJson('/api/v1/courses')->assertOk();
    }

    public function test_the_new_permissions_reach_the_frontend_through_auth_me(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view', 'content.manage']])->assertOk();

        $permissions = $this->as($mentor)->getJson('/api/v1/auth/me')->assertOk()->json('data.permissions');

        $this->assertEqualsCanonicalizing(['content.manage', 'courses.view', 'dashboard.mentor'], $permissions);
    }

    public function test_the_institution_role_can_be_given_access_to_its_own_programs(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::LEMBAGA), ['permissions' => ['dashboard.lembaga', 'courses.view', 'courses.update', 'content.manage']])->assertOk();

        $this->assertSame(['content.manage', 'courses.update', 'courses.view', 'dashboard.lembaga'], $this->permissionsOf(Role::LEMBAGA));
    }

    public function test_the_change_is_audited_with_added_and_removed_permissions(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view']])->assertOk();
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'content.manage']])->assertOk();

        $log = $this->lastLog('role.updated');
        $this->assertSame('Mentor', $log->changes['role']);
        $this->assertSame($this->role(Role::MENTOR)->id, $log->target_id);
        $this->assertSame(['content.manage'], $log->changes['permissions_added']);
        $this->assertSame(['courses.view'], $log->changes['permissions_removed']);
    }

    public function test_a_change_that_changes_nothing_writes_no_log(): void
    {
        // Mengirim izin yang sekarang memang dipegang role tidak boleh menulis log.
        $this->asAdmin()->patchJson($this->url(Role::SISWA), ['permissions' => $this->permissionsOf(Role::SISWA)])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'role.updated')->count());
    }

    public function test_admin_permissions_can_be_reduced_but_the_core_ones_stay(): void
    {
        $all = Catalog::assignable(Catalog::ADMIN);
        $without = array_values(array_diff($all, ['users.delete', 'coupons.delete']));

        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => $without])->assertOk()
            ->assertJsonPath('data.permissions_count', count($without));

        $target = $this->userWithRole(Role::SISWA);
        $this->asAdmin()->deleteJson('/api/v1/users/'.$target->id)->assertForbidden(); // izin dicabut, fiturnya tertutup
        $this->asAdmin()->getJson('/api/v1/users')->assertOk();                         // izin lain tetap

        foreach (['dashboard.admin', 'roles.view', 'roles.manage'] as $core) {
            $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => array_values(array_diff($all, [$core]))])
                ->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        }

        // Tidak ada yang terkunci: Admin masih dapat memulihkan lewat Pengaturan.
        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => $all])->assertOk();
        $this->asAdmin()->deleteJson('/api/v1/users/'.$target->id)->assertOk();
    }

    public function test_every_system_role_keeps_its_own_dashboard_permission(): void
    {
        foreach ([Role::ADMIN, Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $slug) {
            $before = $this->permissionsOf($slug);

            $this->asAdmin()->patchJson($this->url($slug), ['permissions' => []])->assertStatus(422)->assertJsonValidationErrors(['permissions']);

            $this->assertSame($before, $this->permissionsOf($slug));
        }
    }

    public function test_permissions_that_do_not_apply_to_the_role_are_rejected_with_the_reason(): void
    {
        $response = $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'coupons.view', 'courses.delete']])->assertStatus(422);

        $message = implode(' ', $response->json('errors.permissions'));
        $this->assertStringContainsString('tidak berlaku untuk role Mentor', $message);
        $this->assertStringContainsString('coupons.view', $message);
        $this->assertStringContainsString('courses.delete', $message);
        $this->assertSame(collect(RolePermissionSeeder::MATRIX['mentor'])->sort()->values()->all(), $this->permissionsOf(Role::MENTOR));
    }

    public function test_the_student_and_employee_roles_only_accept_their_dashboard_for_now(): void
    {
        foreach ([Role::SISWA, Role::KARYAWAN] as $slug) {
            $this->asAdmin()->patchJson($this->url($slug), ['permissions' => ["dashboard.{$slug}", 'courses.view']])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
            $this->assertSame(collect(RolePermissionSeeder::MATRIX[$slug])->sort()->values()->all(), $this->permissionsOf($slug));
        }
    }

    public function test_another_roles_dashboard_cannot_be_granted(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'dashboard.admin']])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        $this->asAdmin()->patchJson($this->url(Role::LEMBAGA), ['permissions' => ['dashboard.lembaga', 'dashboard.mentor']])->assertStatus(422);
    }

    public function test_unknown_permissions_are_rejected(): void
    {
        $response = $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'tidak.ada']])->assertStatus(422);

        $this->assertStringContainsString('tidak dikenal', implode(' ', $response->json('errors.permissions')));
    }

    public function test_input_shape_is_validated(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => 'courses.view'])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'dashboard.mentor']])->assertStatus(422)->assertJsonValidationErrors(['permissions.0']);

        $this->assertSame(collect(RolePermissionSeeder::MATRIX['mentor'])->sort()->values()->all(), $this->permissionsOf(Role::MENTOR));
    }

    public function test_a_system_role_cannot_be_renamed_or_deleted_but_may_get_a_description(): void
    {
        $mentor = $this->role(Role::MENTOR);

        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['name' => 'Pengajar'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->deleteJson($this->url(Role::MENTOR))->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->asAdmin()->deleteJson($this->url(Role::ADMIN))->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['name' => 'Mentor', 'description' => 'Pengajar kursus'])->assertOk()->assertJsonPath('data.description', 'Pengajar kursus');

        $this->assertSame('Mentor', $mentor->fresh()->name);
    }

    // ------------------------------------------------------------------ atur ulang

    public function test_a_system_role_can_be_reset_to_its_defaults(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view']])->assertOk();

        $this->asAdmin()->postJson($this->url(Role::MENTOR, '/reset'))->assertOk()
            ->assertJsonPath('message', 'Izin role dikembalikan ke pengaturan awal.')
            ->assertJsonPath('data.permissions', ['assignments.grade', 'assignments.manage', 'assignments.view', 'content.manage', 'courses.create', 'courses.update', 'courses.view', 'dashboard.mentor']);

        $log = $this->lastLog('role.reset');
        $this->assertSame(
            ['assignments.grade', 'assignments.manage', 'assignments.view', 'content.manage', 'courses.create', 'courses.update'],
            $log->changes['permissions_added'],
        );
    }

    public function test_the_admin_role_can_be_reset_to_the_full_default(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => ['dashboard.admin', 'roles.view', 'roles.manage']])->assertOk();

        $this->asAdmin()->postJson($this->url(Role::ADMIN, '/reset'))->assertOk();

        $this->assertSame(collect(RolePermissionSeeder::MATRIX['admin'])->sort()->values()->all(), $this->permissionsOf(Role::ADMIN));
    }

    public function test_a_custom_role_cannot_be_reset(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Kupon'])->json('data.id');

        $this->asAdmin()->postJson("/api/v1/settings/roles/{$id}/reset")->assertStatus(422)->assertJsonValidationErrors(['role']);
    }

    // ------------------------------------------------------------------ role khusus

    public function test_a_custom_role_can_be_created_with_permissions(): void
    {
        $response = $this->asAdmin()->postJson('/api/v1/settings/roles', [
            'name' => 'Staf Kupon', 'description' => 'Mengelola kupon saja.', 'permissions' => ['coupons.view', 'coupons.create'],
        ])->assertCreated();

        $response->assertJsonPath('message', 'Role berhasil dibuat.')
            ->assertJsonPath('data.slug', 'staf-kupon')
            ->assertJsonPath('data.is_system', false)
            ->assertJsonPath('data.can_delete', true)
            ->assertJsonPath('data.users_count', 0)
            ->assertJsonPath('data.permissions', ['coupons.create', 'coupons.view']);

        $this->assertSame(['coupons.create', 'coupons.view'], $this->permissionsOf('staf-kupon'));
        $this->assertSame(['coupons.create', 'coupons.view'], $this->lastLog('role.created')->changes['after']['permissions']);
        $this->asAdmin()->getJson('/api/v1/settings/roles')->assertJsonPath('summary.custom_roles', 1)->assertJsonPath('summary.total_roles', 6);
    }

    public function test_the_matrix_of_a_custom_role_only_offers_delegable_features(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Uji'])->json('data.id');

        $modules = collect($this->asAdmin()->getJson("/api/v1/settings/roles/{$id}")->json('matrix'))->pluck('key')->all();

        $this->assertSame(['coupons', 'gamification', 'institutions'], $modules);
    }

    public function test_a_custom_role_cannot_receive_account_or_role_management_permissions(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Uji'])->json('data.id');

        foreach (['users.create', 'users.update', 'users.reset_password', 'users.delete', 'roles.manage', 'roles.view', 'audit.view', 'dashboard.admin', 'courses.view'] as $slug) {
            $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Peran '.$slug, 'permissions' => [$slug]])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
            $this->asAdmin()->patchJson("/api/v1/settings/roles/{$id}", ['permissions' => [$slug]])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        }

        $this->assertSame(0, DB::table('permission_role')->where('role_id', $id)->count());
    }

    public function test_a_user_with_a_custom_role_gets_exactly_those_permissions(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Kupon', 'permissions' => ['coupons.view']])->json('data.id');
        $staff = User::factory()->create();
        $staff->roles()->attach($id);

        $this->as($staff)->getJson('/api/v1/coupons')->assertOk();
        $this->as($staff)->postJson('/api/v1/coupons', [])->assertForbidden();
        $this->as($staff)->getJson('/api/v1/users')->assertForbidden();
        $this->as($staff)->getJson('/api/v1/settings/roles')->assertForbidden();
    }

    public function test_a_custom_role_without_permissions_is_allowed(): void
    {
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Tamu'])->assertCreated()->assertJsonPath('data.permissions', []);
    }

    public function test_role_names_must_be_unique_and_slugs_never_collide(): void
    {
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'admin'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'LEMBAGA BIMBINGAN'])->assertStatus(422)->assertJsonValidationErrors(['name']);

        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Kupon'])->assertCreated()->assertJsonPath('data.slug', 'staf-kupon');
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf-Kupon!'])->assertCreated()->assertJsonPath('data.slug', 'staf-kupon-2');
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Mentor!'])->assertCreated()->assertJsonPath('data.slug', 'mentor-2');
        $this->assertSame('mentor', $this->role('mentor')->slug);
    }

    public function test_create_validates_the_name(): void
    {
        $this->asAdmin()->postJson('/api/v1/settings/roles', [])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'ab'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => str_repeat('A', 101)])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Sah', 'description' => str_repeat('x', 256)])->assertStatus(422)->assertJsonValidationErrors(['description']);
    }

    public function test_a_custom_role_can_be_renamed_and_edited(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf A', 'permissions' => ['coupons.view']])->json('data.id');

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$id, ['name' => 'Staf B', 'permissions' => ['coupons.view', 'coupons.update']])->assertOk()
            ->assertJsonPath('data.name', 'Staf B')
            ->assertJsonPath('data.slug', 'staf-a') // slug tetap agar tidak memutus referensi
            ->assertJsonPath('data.permissions', ['coupons.update', 'coupons.view']);

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$id, ['name' => 'Mentor'])->assertStatus(422)->assertJsonValidationErrors(['name']);
    }

    public function test_a_custom_role_can_be_deleted_only_when_nobody_uses_it(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Sementara', 'permissions' => ['coupons.view']])->json('data.id');
        $staff = User::factory()->create();
        $staff->roles()->attach($id);

        $this->asAdmin()->deleteJson('/api/v1/settings/roles/'.$id)->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->assertSame(1, Role::where('id', $id)->count());

        $staff->roles()->detach();
        $this->asAdmin()->deleteJson('/api/v1/settings/roles/'.$id)->assertOk()->assertJsonPath('message', 'Role berhasil dihapus.');

        $this->assertSame(0, Role::where('id', $id)->count());
        $this->assertSame('Staf Sementara', $this->lastLog('role.deleted')->changes['before']['name']);
        $this->assertSame(0, DB::table('permission_role')->where('role_id', $id)->count());
    }

    public function test_a_custom_role_can_be_assigned_through_the_user_api(): void
    {
        $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Kupon', 'permissions' => ['coupons.view']])->assertCreated();

        $this->asAdmin()->postJson('/api/v1/users', ['name' => 'Rina', 'email' => 'rina@x.test', 'role' => 'staf-kupon'])->assertCreated()
            ->assertJsonPath('data.primary_role', 'staf-kupon');
        $this->asAdmin()->getJson('/api/v1/settings/roles')->assertJsonPath('data.5.users_count', 1);
    }

    // ------------------------------------------------------------------ otorisasi

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_rejected_everywhere(string $role): void
    {
        $actor = $this->userWithRole($role);
        $mentorUrl = $this->url(Role::MENTOR);

        $this->as($actor)->getJson('/api/v1/settings/roles')->assertForbidden();
        $this->as($actor)->getJson($mentorUrl)->assertForbidden();
        $this->as($actor)->getJson('/api/v1/settings/permissions')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/settings/roles', ['name' => 'Baru'])->assertForbidden();
        $this->as($actor)->patchJson($mentorUrl, ['permissions' => ['dashboard.mentor', 'courses.view']])->assertForbidden();
        $this->as($actor)->postJson($mentorUrl.'/reset')->assertForbidden();
        $this->as($actor)->deleteJson($mentorUrl)->assertForbidden();

        $this->assertSame(collect(RolePermissionSeeder::MATRIX['mentor'])->sort()->values()->all(), $this->permissionsOf(Role::MENTOR));
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_view_permission_alone_cannot_change_anything(): void
    {
        // Pemegang roles.view saja boleh melihat matriks, tetapi tidak mengubahnya.
        $this->role(Role::MENTOR)->permissions()->syncWithoutDetaching(Permission::where('slug', 'roles.view')->pluck('id'));
        $reader = $this->userWithRole(Role::MENTOR);

        $this->as($reader)->getJson('/api/v1/settings/roles')->assertOk();
        $this->as($reader)->getJson('/api/v1/settings/permissions')->assertOk();
        $this->as($reader)->getJson($this->url(Role::SISWA))->assertOk();
        $this->as($reader)->postJson('/api/v1/settings/roles', ['name' => 'Baru'])->assertForbidden();
        $this->as($reader)->patchJson($this->url(Role::SISWA), ['permissions' => ['dashboard.siswa']])->assertForbidden();
        $this->as($reader)->postJson($this->url(Role::SISWA, '/reset'))->assertForbidden();
        $this->as($reader)->deleteJson($this->url(Role::SISWA))->assertForbidden();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/settings/roles')->assertUnauthorized();
        $this->getJson('/api/v1/settings/permissions')->assertUnauthorized();
        $this->postJson('/api/v1/settings/roles', [])->assertUnauthorized();
    }

    public function test_the_existing_role_list_endpoint_is_unchanged(): void
    {
        $this->asAdmin()->getJson('/api/v1/roles')->assertOk()->assertJsonCount(5, 'data')->assertJsonStructure(['data' => [['id', 'slug', 'name']]]);
    }

    // ------------------------------------------------------------------ seeder dan perintah pemulihan

    public function test_running_the_seeder_again_does_not_overwrite_the_settings_made_by_the_admin(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view']])->assertOk();
        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => array_values(array_diff(Catalog::assignable(Catalog::ADMIN), ['users.delete']))])->assertOk();

        $this->seed(RolePermissionSeeder::class);

        $this->assertSame(['courses.view', 'dashboard.mentor'], $this->permissionsOf(Role::MENTOR));
        $this->assertNotContains('users.delete', $this->permissionsOf(Role::ADMIN));
    }

    public function test_the_seeder_gives_new_permissions_to_existing_roles_once(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => array_values(array_diff(Catalog::assignable(Catalog::ADMIN), ['institutions.payout']))])->assertOk();

        // Simulasi rilis baru: izin ini belum ada di database, lalu seeder dijalankan.
        $this->role(Role::ADMIN)->permissions()->detach(Permission::where('slug', 'institutions.payout')->value('id'));
        Permission::where('slug', 'institutions.payout')->delete();

        $this->seed(RolePermissionSeeder::class);

        $this->assertContains('institutions.payout', $this->permissionsOf(Role::ADMIN)); // izin baru diberikan sesuai bawaan

        $this->asAdmin()->patchJson($this->url(Role::ADMIN), ['permissions' => array_values(array_diff(Catalog::assignable(Catalog::ADMIN), ['institutions.payout']))])->assertOk();
        $this->seed(RolePermissionSeeder::class);

        $this->assertNotContains('institutions.payout', $this->permissionsOf(Role::ADMIN)); // sengaja dimatikan: tidak dinyalakan lagi
    }

    public function test_the_reset_command_restores_system_roles(): void
    {
        $this->asAdmin()->patchJson($this->url(Role::MENTOR), ['permissions' => ['dashboard.mentor', 'courses.view']])->assertOk();

        $this->artisan('lms:reset-role-permissions', ['--role' => 'mentor', '--force' => true])->assertSuccessful();

        $this->assertSame(['assignments.grade', 'assignments.manage', 'assignments.view', 'content.manage', 'courses.create', 'courses.update', 'courses.view', 'dashboard.mentor'], $this->permissionsOf(Role::MENTOR));
    }

    public function test_the_reset_command_validates_its_arguments(): void
    {
        $this->artisan('lms:reset-role-permissions')->assertFailed();
        $this->artisan('lms:reset-role-permissions', ['--role' => 'ngawur', '--force' => true])->assertFailed();
    }

    public function test_the_prune_command_removes_permissions_a_role_may_not_hold(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Staf Lama', 'permissions' => ['coupons.view']])->json('data.id');
        // Data lama (mis. dari versi sebelumnya): hak kelola akun pada role khusus dan izin kursus pada Siswa.
        DB::table('permission_role')->insert([
            ['role_id' => $id, 'permission_id' => Permission::where('slug', 'users.create')->value('id')],
            ['role_id' => $this->role(Role::SISWA)->id, 'permission_id' => Permission::where('slug', 'courses.view')->value('id')],
        ]);

        $this->artisan('lms:reset-role-permissions', ['--prune' => true, '--force' => true])->assertSuccessful();

        $this->assertSame(['coupons.view'], Role::findOrFail($id)->permissions()->pluck('slug')->all());
        $this->assertSame(collect(RolePermissionSeeder::MATRIX['siswa'])->sort()->values()->all(), $this->permissionsOf(Role::SISWA));
        $this->assertSame(collect(RolePermissionSeeder::MATRIX['admin'])->sort()->values()->all(), $this->permissionsOf(Role::ADMIN)); // role yang sah tidak tersentuh
    }
}
