<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
    }

    public function test_five_roles_are_seeded(): void
    {
        $this->assertEqualsCanonicalizing(
            ['admin', 'mentor', 'siswa', 'karyawan', 'lembaga'],
            Role::pluck('slug')->all()
        );
    }

    public function test_least_privilege_only_admin_manages_users(): void
    {
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $slug) {
            $permissions = Role::where('slug', $slug)->firstOrFail()->permissions->pluck('slug')->all();

            $this->assertSame(["dashboard.{$slug}"], $permissions, "Role {$slug} mendapat permission berlebih.");
        }

        $adminPermissions = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug');
        $this->assertTrue($adminPermissions->contains('users.delete'));
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seedRbac();

        $this->assertSame(5, Role::count());
        $this->assertSame(10, Permission::count());
    }

    public function test_guest_cannot_list_users(): void
    {
        $this->getJson('/api/v1/users')->assertUnauthorized();
    }

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_forbidden_from_admin_resources(string $role): void
    {
        $user = $this->userWithRole($role);

        $this->actingAs($user, 'web')->getJson('/api/v1/users')->assertForbidden();
        $this->actingAs($user, 'web')->getJson('/api/v1/roles')->assertForbidden();
        $this->actingAs($user, 'web')->getJson('/api/v1/admin/summary')->assertForbidden();
        $this->actingAs($user, 'web')->postJson('/api/v1/users', [])->assertForbidden();
        $this->actingAs($user, 'web')->deleteJson('/api/v1/users/'.$user->id)->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_admin_can_list_users_with_filters(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $this->userWithRole(Role::SISWA, ['name' => 'Budi Santoso']);
        $this->userWithRole(Role::MENTOR, ['name' => 'Citra Dewi']);

        $this->actingAs($admin, 'web')
            ->getJson('/api/v1/users?role=siswa&q=budi')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Budi Santoso');
    }

    public function test_admin_can_create_user_with_role(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);

        $this->actingAs($admin, 'web')->postJson('/api/v1/users', [
            'name' => 'Karyawan Baru',
            'email' => 'Karyawan.Baru@Example.test',
            'password' => 'KataSandiKuat123',
            'role' => 'karyawan',
        ])
            ->assertCreated()
            ->assertJsonPath('data.email', 'karyawan.baru@example.test')
            ->assertJsonPath('data.primary_role', 'karyawan');

        $this->assertDatabaseHas('users', ['email' => 'karyawan.baru@example.test', 'status' => 'active']);
    }

    public function test_create_user_validates_input(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);

        $this->actingAs($admin, 'web')->postJson('/api/v1/users', [
            'name' => '',
            'email' => 'bukan-email',
            'password' => 'pendek',
            'role' => 'tidak-ada',
        ])->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'password', 'role']);
    }

    public function test_admin_can_update_another_user_status(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $target = $this->userWithRole(Role::SISWA);

        $this->actingAs($admin, 'web')
            ->patchJson('/api/v1/users/'.$target->id, ['status' => 'suspended'])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');
    }

    public function test_admin_cannot_deactivate_or_demote_own_account(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);

        $this->actingAs($admin, 'web')
            ->patchJson('/api/v1/users/'.$admin->id, ['status' => 'inactive'])
            ->assertStatus(422);

        $this->actingAs($admin, 'web')
            ->patchJson('/api/v1/users/'.$admin->id, ['role' => 'siswa'])
            ->assertStatus(422);
    }

    public function test_admin_cannot_delete_own_account_but_can_delete_others(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $other = $this->userWithRole(Role::SISWA);

        $this->actingAs($admin, 'web')->deleteJson('/api/v1/users/'.$admin->id)->assertForbidden();
        $this->actingAs($admin, 'web')->deleteJson('/api/v1/users/'.$other->id)->assertOk();

        $this->assertModelMissing($other);
        $this->assertModelExists($admin);
    }

    public function test_admin_summary_contains_real_counts_and_null_courses(): void
    {
        $admin = $this->userWithRole(Role::ADMIN);
        $this->userWithRole(Role::MENTOR);
        $this->userWithRole(Role::MENTOR);

        $this->actingAs($admin, 'web')
            ->getJson('/api/v1/admin/summary')
            ->assertOk()
            ->assertJsonPath('data.users_total', 3)
            ->assertJsonPath('data.mentors_total', 2)
            ->assertJsonPath('data.courses_total', null);
    }

    public function test_user_model_permission_helpers(): void
    {
        $siswa = $this->userWithRole(Role::SISWA);

        $this->assertTrue($siswa->hasRole('siswa'));
        $this->assertFalse($siswa->hasRole(['admin', 'mentor']));
        $this->assertTrue($siswa->hasPermission('dashboard.siswa'));
        $this->assertFalse($siswa->hasPermission('users.view'));
        $this->assertInstanceOf(User::class, $siswa);
    }
}
