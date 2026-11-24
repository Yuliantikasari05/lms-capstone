<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Pengaturan > Role dan Akses: daftar role, matriks izin, role khusus, dan pengamannya. */
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

        return $this->actingAs($this->admin, 'web');
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    private function role(string $slug): Role
    {
        return Role::where('slug', $slug)->firstOrFail();
    }

    private function permissionsOf(string $slug): array
    {
        return $this->role($slug)->permissions()->pluck('slug')->sort()->values()->all();
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
        $this->assertTrue($byRole['admin']['is_locked']);
        $this->assertFalse($byRole['mentor']['is_locked']);
        $this->assertSame(count(\Database\Seeders\RolePermissionSeeder::MATRIX['lembaga']), $byRole['lembaga']['permissions_count']);
    }

    public function test_the_role_detail_lists_its_permission_slugs_and_required_ones(): void
    {
        $this->asAdmin()->getJson('/api/v1/settings/roles/'.$this->role(Role::LEMBAGA)->id)->assertOk()
            ->assertJsonPath('data.slug', 'lembaga')
            ->assertJsonPath('data.name', 'Lembaga Bimbingan')
            ->assertJsonPath('data.permissions', ['dashboard.lembaga'])
            ->assertJsonPath('data.required_permissions', ['dashboard.lembaga']);

        $this->asAdmin()->getJson('/api/v1/settings/roles/999999')->assertNotFound();
    }

    public function test_the_permission_catalog_is_grouped_by_module_with_actions(): void
    {
        $groups = collect($this->asAdmin()->getJson('/api/v1/settings/permissions')->assertOk()->json('data'))->keyBy('module');

        foreach (['Dashboard', 'Manajemen Pengguna', 'Kurikulum dan Kursus', 'Kupon', 'Gamifikasi dan XP', 'Lembaga Bimbingan', 'Pengaturan'] as $module) {
            $this->assertTrue($groups->has($module), "Modul {$module} harus ada.");
        }

        $institutions = collect($groups['Lembaga Bimbingan']['permissions'])->keyBy('slug');
        $this->assertSame('read', $institutions['institutions.view']['action']);
        $this->assertSame('create', $institutions['institutions.create']['action']);
        $this->assertSame('update', $institutions['institutions.update']['action']);
        $this->assertSame('delete', $institutions['institutions.delete']['action']);
        $this->assertSame('other', $institutions['institutions.payout']['action']);
        $this->assertFalse($institutions['institutions.view']['admin_only']);

        $settings = collect($groups['Pengaturan']['permissions'])->keyBy('slug');
        $this->assertTrue($settings['roles.manage']['admin_only']);

        // Setiap permission di database muncul tepat satu kali di katalog.
        $all = $groups->flatMap(fn ($g) => array_column($g['permissions'], 'slug'))->sort()->values()->all();
        $this->assertSame(Permission::orderBy('slug')->pluck('slug')->all(), $all);
    }

    // ------------------------------------------------------------------ ubah izin

    public function test_permissions_of_a_system_role_can_be_changed_and_take_effect_immediately(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);
        $this->as($mentor)->getJson('/api/v1/coupons')->assertForbidden();

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::MENTOR)->id, ['permissions' => ['dashboard.mentor', 'coupons.view']])->assertOk()
            ->assertJsonPath('message', 'Role berhasil diperbarui.')
            ->assertJsonPath('data.permissions', ['coupons.view', 'dashboard.mentor'])
            ->assertJsonPath('data.permissions_count', 2);

        // fresh(): di produksi tiap request memuat ulang pengguna; objek lama menyimpan izin yang sudah di-cache.
        $this->as($mentor->fresh())->getJson('/api/v1/coupons')->assertOk();
    }

    public function test_removing_permissions_takes_effect_immediately_too(): void
    {
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::MENTOR)->id, ['permissions' => ['dashboard.mentor', 'coupons.view']])->assertOk();
        $mentor = $this->userWithRole(Role::MENTOR);
        $this->as($mentor->fresh())->getJson('/api/v1/coupons')->assertOk();

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::MENTOR)->id, ['permissions' => ['dashboard.mentor']])->assertOk();

        $this->as($mentor->fresh())->getJson('/api/v1/coupons')->assertForbidden();
    }

    public function test_the_institution_role_can_be_given_access_through_the_matrix(): void
    {
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::LEMBAGA)->id, [
            'permissions' => ['dashboard.lembaga', 'institutions.view'],
        ])->assertOk();

        $this->assertSame(['dashboard.lembaga', 'institutions.view'], $this->permissionsOf(Role::LEMBAGA));
    }

    public function test_the_change_is_audited_with_added_and_removed_permissions(): void
    {
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::SISWA)->id, ['permissions' => ['dashboard.siswa', 'gamification.view']])->assertOk();
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::SISWA)->id, ['permissions' => ['dashboard.siswa', 'coupons.view']])->assertOk();

        $log = $this->lastLog('role.updated');
        $this->assertSame('Siswa', $log->changes['role']);
        $this->assertSame($this->role(Role::SISWA)->id, $log->target_id);
        $this->assertSame(['coupons.view'], $log->changes['permissions_added']);
        $this->assertSame(['gamification.view'], $log->changes['permissions_removed']);
    }

    public function test_a_change_that_changes_nothing_writes_no_log(): void
    {
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::SISWA)->id, ['permissions' => ['dashboard.siswa']])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'role.updated')->count());
    }

    public function test_the_admin_role_is_locked(): void
    {
        $admin = $this->role(Role::ADMIN);
        $before = $this->permissionsOf(Role::ADMIN);

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$admin->id, ['permissions' => ['dashboard.admin']])->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$admin->id, ['description' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->asAdmin()->deleteJson('/api/v1/settings/roles/'.$admin->id)->assertStatus(422)->assertJsonValidationErrors(['role']);

        $this->assertSame($before, $this->permissionsOf(Role::ADMIN));
    }

    public function test_a_system_role_keeps_its_own_dashboard_permission(): void
    {
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $slug) {
            $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role($slug)->id, ['permissions' => []])
                ->assertStatus(422)->assertJsonValidationErrors(['permissions']);
            $this->assertContains("dashboard.{$slug}", $this->permissionsOf($slug));
        }
    }

    public function test_admin_only_permissions_cannot_be_granted_to_other_roles(): void
    {
        foreach (['roles.manage', 'roles.view', 'audit.view', 'users.reset_password', 'dashboard.admin'] as $slug) {
            $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$this->role(Role::MENTOR)->id, ['permissions' => ['dashboard.mentor', $slug]])
                ->assertStatus(422)->assertJsonValidationErrors(['permissions']);
            $this->asAdmin()->postJson('/api/v1/settings/roles', ['name' => 'Peran '.$slug, 'permissions' => [$slug]])
                ->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        }

        $this->assertSame(['dashboard.mentor'], $this->permissionsOf(Role::MENTOR));
        $this->assertSame(5, Role::count());
    }

    public function test_permission_input_is_validated(): void
    {
        $url = '/api/v1/settings/roles/'.$this->role(Role::MENTOR)->id;

        $this->asAdmin()->patchJson($url, ['permissions' => ['dashboard.mentor', 'tidak.ada']])->assertStatus(422)->assertJsonValidationErrors(['permissions.1']);
        $this->asAdmin()->patchJson($url, ['permissions' => 'coupons.view'])->assertStatus(422)->assertJsonValidationErrors(['permissions']);
        $this->asAdmin()->patchJson($url, ['permissions' => ['dashboard.mentor', 'dashboard.mentor']])->assertStatus(422)->assertJsonValidationErrors(['permissions.0']);

        $this->assertSame(['dashboard.mentor'], $this->permissionsOf(Role::MENTOR));
    }

    public function test_a_system_role_cannot_be_renamed_or_deleted_but_may_get_a_description(): void
    {
        $mentor = $this->role(Role::MENTOR);

        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$mentor->id, ['name' => 'Pengajar'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->deleteJson('/api/v1/settings/roles/'.$mentor->id)->assertStatus(422)->assertJsonValidationErrors(['role']);
        $this->asAdmin()->patchJson('/api/v1/settings/roles/'.$mentor->id, ['name' => 'Mentor', 'description' => 'Pengajar kursus'])->assertOk()->assertJsonPath('data.description', 'Pengajar kursus');

        $this->assertSame('Mentor', $mentor->fresh()->name);
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
            ->assertJsonPath('data.users_count', 0)
            ->assertJsonPath('data.permissions', ['coupons.create', 'coupons.view']);

        $this->assertSame(['coupons.create', 'coupons.view'], $this->permissionsOf('staf-kupon'));
        $this->assertSame(['coupons.create', 'coupons.view'], $this->lastLog('role.created')->changes['after']['permissions']);
        $this->asAdmin()->getJson('/api/v1/settings/roles')->assertJsonPath('summary.custom_roles', 1)->assertJsonPath('summary.total_roles', 6);
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
        // Nama yang bila diubah menjadi slug bentrok dengan role bawaan tidak menimpanya.
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
        $this->assertSame(0, \DB::table('permission_role')->where('role_id', $id)->count());
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
        $mentorId = $this->role(Role::MENTOR)->id;

        $this->as($actor)->getJson('/api/v1/settings/roles')->assertForbidden();
        $this->as($actor)->getJson('/api/v1/settings/roles/'.$mentorId)->assertForbidden();
        $this->as($actor)->getJson('/api/v1/settings/permissions')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/settings/roles', ['name' => 'Baru'])->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/settings/roles/'.$mentorId, ['permissions' => ['dashboard.mentor', 'coupons.view']])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/settings/roles/'.$mentorId)->assertForbidden();

        $this->assertSame(['dashboard.mentor'], $this->permissionsOf(Role::MENTOR));
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_view_permission_alone_cannot_change_anything(): void
    {
        // Pemegang roles.view saja (mis. role khusus) boleh melihat matriks, tetapi tidak mengubahnya.
        $this->role(Role::MENTOR)->permissions()->syncWithoutDetaching(Permission::where('slug', 'roles.view')->pluck('id'));
        $reader = $this->userWithRole(Role::MENTOR);

        $this->as($reader)->getJson('/api/v1/settings/roles')->assertOk();
        $this->as($reader)->getJson('/api/v1/settings/permissions')->assertOk();
        $this->as($reader)->postJson('/api/v1/settings/roles', ['name' => 'Baru'])->assertForbidden();
        $this->as($reader)->patchJson('/api/v1/settings/roles/'.$this->role(Role::SISWA)->id, ['permissions' => ['dashboard.siswa', 'coupons.view']])->assertForbidden();
        $this->as($reader)->deleteJson('/api/v1/settings/roles/'.$this->role(Role::SISWA)->id)->assertForbidden();
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
}
