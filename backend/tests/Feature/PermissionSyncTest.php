<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Rbac\PermissionSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Pengaman RBAC: izin yang belum tersinkron harus terdeteksi sebelum pengguna menemui 403.
 */
class PermissionSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_report_is_clean_after_seeding(): void
    {
        $this->seedRbac();

        $report = PermissionSync::inspect();

        $this->assertTrue($report['ok']);
        $this->assertSame([], $report['missing_permissions']);
        $this->assertSame([], $report['required_gaps']);
        $this->artisan('lms:permissions:check')->assertSuccessful();
    }

    public function test_permissions_that_were_never_seeded_are_reported(): void
    {
        $this->seedRbac();

        // Simulasi modul baru digabung tanpa menjalankan seeder ulang.
        Permission::where('slug', 'coupons.view')->delete();

        $report = PermissionSync::inspect();

        $this->assertFalse($report['ok']);
        $this->assertContains('coupons.view', $report['missing_permissions']);
        $this->artisan('lms:permissions:check')->assertFailed();
    }

    public function test_a_role_locked_out_of_its_required_permission_is_reported(): void
    {
        $this->seedRbac();

        Role::where('slug', Role::ADMIN)->firstOrFail()
            ->permissions()
            ->detach(Permission::where('slug', 'roles.manage')->value('id'));

        $report = PermissionSync::inspect();

        $this->assertFalse($report['ok']);
        $this->assertSame(['roles.manage'], $report['required_gaps']['admin']);
    }

    public function test_health_exposes_the_permission_state(): void
    {
        $this->seedRbac();

        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('permissions.ok', true)
            ->assertJsonPath('permissions.missing', 0);
    }
}
