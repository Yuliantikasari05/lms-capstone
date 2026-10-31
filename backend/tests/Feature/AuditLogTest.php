<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
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

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ pencatatan

    public function test_create_is_logged_with_actor_target_and_request_info(): void
    {
        $this->asAdmin()->withHeaders(['User-Agent' => 'UjiBrowser/1.0'])
            ->postJson('/api/v1/users', ['name' => 'Budi', 'email' => 'budi@example.test', 'role' => 'siswa'])->assertCreated();

        $user = User::where('email', 'budi@example.test')->firstOrFail();
        $log = $this->lastLog('user.created');

        $this->assertSame($this->admin->id, $log->actor_id);
        $this->assertSame('Admin Uji', $log->actor_name);
        $this->assertSame('admin.uji@example.test', $log->actor_email);
        $this->assertSame('user', $log->target_type);
        $this->assertSame($user->id, $log->target_id);
        $this->assertSame('Budi (budi@example.test)', $log->target_label);
        $this->assertSame(['name' => 'Budi', 'email' => 'budi@example.test', 'role' => 'siswa', 'status' => 'active'], $log->changes['after']);
        $this->assertNotNull($log->ip_address);
        $this->assertSame('UjiBrowser/1.0', $log->user_agent);
        $this->assertNotNull($log->created_at);
    }

    public function test_update_logs_only_the_fields_that_changed_with_before_and_after(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['name' => 'Lama', 'email' => 'lama@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, [
            'name' => 'Lama',                       // tidak berubah
            'email' => 'baru@example.test',         // berubah
            'status' => 'suspended',                // berubah
            'role' => 'mentor',                     // berubah
        ])->assertOk();

        $log = $this->lastLog('user.updated');
        $this->assertSame(['email' => 'lama@example.test', 'status' => 'active', 'role' => 'siswa'], $log->changes['before']);
        $this->assertSame(['email' => 'baru@example.test', 'status' => 'suspended', 'role' => 'mentor'], $log->changes['after']);
        $this->assertArrayNotHasKey('name', $log->changes['after']);
    }

    public function test_update_that_changes_nothing_writes_no_log(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['name' => 'Sama', 'email' => 'sama@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['name' => 'Sama', 'email' => 'sama@example.test'])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'user.updated')->count());
    }

    public function test_delete_restore_and_reset_password_are_logged(): void
    {
        $user = $this->userWithRole(Role::KARYAWAN, ['name' => 'Karyawan Uji', 'email' => 'karyawan@example.test']);

        $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/reset-password')->assertOk();
        $this->asAdmin()->deleteJson('/api/v1/users/'.$user->id)->assertOk();
        $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/restore')->assertOk();

        foreach (['user.password_reset', 'user.deleted', 'user.restored'] as $action) {
            $log = $this->lastLog($action);
            $this->assertSame($this->admin->id, $log->actor_id, $action);
            $this->assertSame($user->id, $log->target_id, $action);
            $this->assertSame('Karyawan Uji (karyawan@example.test)', $log->target_label, $action);
        }
    }

    public function test_export_is_logged_with_filters_and_row_count(): void
    {
        $this->userWithRole(Role::SISWA, ['email' => 'a@example.test']);
        $this->userWithRole(Role::SISWA, ['email' => 'b@example.test']);
        $this->userWithRole(Role::MENTOR, ['email' => 'c@example.test']);

        $this->asAdmin()->get('/api/v1/users/export?role=siswa')->assertOk()->streamedContent();

        $log = $this->lastLog('user.exported');
        $this->assertNull($log->target_id);
        $this->assertSame(['role' => 'siswa'], $log->changes['filters']);
        $this->assertSame(2, $log->changes['rows']);
        $this->assertSame($this->admin->id, $log->actor_id);
    }

    public function test_own_password_change_is_logged(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['email' => 'siswa@example.test']);

        $this->as($user)->postJson('/api/v1/auth/password', [
            'current_password' => 'password-rahasia-123', 'password' => 'KataSandiBaruku99', 'password_confirmation' => 'KataSandiBaruku99',
        ])->assertOk();

        $log = $this->lastLog('auth.password_changed');
        $this->assertSame($user->id, $log->actor_id);
        $this->assertSame($user->id, $log->target_id);
    }

    public function test_failed_actions_are_not_logged(): void
    {
        $this->asAdmin()->postJson('/api/v1/users', ['name' => '', 'email' => 'bukan-email', 'role' => 'x'])->assertStatus(422);
        $this->asAdmin()->deleteJson('/api/v1/users/'.$this->admin->id)->assertForbidden(); // hapus diri sendiri

        $this->assertSame(0, AuditLog::count());
    }

    // ------------------------------------------------------------------ rahasia tidak boleh bocor

    public function test_no_password_ever_reaches_the_audit_log(): void
    {
        $created = $this->asAdmin()->postJson('/api/v1/users', ['name' => 'Rahasia', 'email' => 'rahasia@example.test', 'role' => 'siswa'])->json('temporary_password');
        $user = User::where('email', 'rahasia@example.test')->firstOrFail();
        $reset = $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/reset-password')->json('temporary_password');
        $this->as($user->fresh())->postJson('/api/v1/auth/password', [
            'current_password' => $reset, 'password' => 'KataSandiBaruku99', 'password_confirmation' => 'KataSandiBaruku99',
        ])->assertOk();

        $dump = json_encode(AuditLog::all()->toArray());
        foreach ([$created, $reset, 'KataSandiBaruku99'] as $secret) {
            $this->assertStringNotContainsString($secret, $dump, 'Kata sandi tidak boleh tersimpan di audit log.');
        }
        $this->assertStringNotContainsString('$2y$', $dump, 'Hash kata sandi juga tidak boleh tersimpan.');

        // Dan tidak muncul di API audit.
        $api = json_encode($this->asAdmin()->getJson('/api/v1/audit-logs?per_page=100')->json());
        foreach ([$created, $reset, 'KataSandiBaruku99'] as $secret) {
            $this->assertStringNotContainsString($secret, $api);
        }
    }

    public function test_record_strips_password_like_keys_at_any_depth(): void
    {
        $user = $this->userWithRole(Role::SISWA);

        $log = AuditLog::record('uji.rahasia', $user, [
            'password' => 'x', 'Temporary_Password' => 'y',
            'after' => ['name' => 'Aman', 'new_password' => 'z', 'dalam' => ['password_hash' => 'h', 'ok' => 1]],
        ]);

        $this->assertSame(['after' => ['name' => 'Aman', 'dalam' => ['ok' => 1]]], $log->fresh()->changes);
    }

    // ------------------------------------------------------------------ tidak dapat diubah / dihapus

    public function test_audit_log_is_append_only(): void
    {
        $log = AuditLog::record('uji.append_only', $this->admin);

        try {
            $log->update(['action' => 'diubah']);
            $this->fail('Update seharusnya ditolak.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('tidak boleh diubah', $e->getMessage());
        }

        try {
            $log->delete();
            $this->fail('Delete seharusnya ditolak.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('tidak boleh dihapus', $e->getMessage());
        }

        $this->assertSame('uji.append_only', $log->fresh()->action);
    }

    public function test_log_survives_deletion_of_the_actor(): void
    {
        $admin2 = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Dua', 'email' => 'dua@example.test']);
        $target = $this->userWithRole(Role::SISWA);
        $this->as($admin2)->deleteJson('/api/v1/users/'.$target->id)->assertOk();

        $admin2->forceDelete(); // hapus permanen pelaku

        $log = $this->lastLog('user.deleted');
        $this->assertNull($log->actor_id, 'FK menjadi null.');
        $this->assertSame('Admin Dua', $log->actor_name, 'Salinan nama pelaku tetap ada.');
        $this->assertSame('dua@example.test', $log->actor_email);
    }

    public function test_action_is_rolled_back_when_the_log_cannot_be_written(): void
    {
        AuditLog::creating(fn () => throw new RuntimeException('log gagal ditulis'));

        try {
            $this->asAdmin()->postJson('/api/v1/users', ['name' => 'Batal', 'email' => 'batal@example.test', 'role' => 'siswa'])->assertStatus(500);
        } finally {
            AuditLog::flushEventListeners();
            AuditLog::clearBootedModels();
        }

        $this->assertDatabaseMissing('users', ['email' => 'batal@example.test']); // tidak ada aksi tanpa catatan
    }

    // ------------------------------------------------------------------ API

    public function test_admin_can_list_and_filter_audit_logs(): void
    {
        $a = $this->userWithRole(Role::SISWA, ['name' => 'A', 'email' => 'a@example.test']);
        $b = $this->userWithRole(Role::SISWA, ['name' => 'B', 'email' => 'b@example.test']);
        $this->asAdmin()->patchJson('/api/v1/users/'.$a->id, ['status' => 'inactive'])->assertOk();
        $this->asAdmin()->patchJson('/api/v1/users/'.$b->id, ['status' => 'suspended'])->assertOk();
        $this->asAdmin()->deleteJson('/api/v1/users/'.$a->id)->assertOk();

        $all = $this->asAdmin()->getJson('/api/v1/audit-logs')->assertOk();
        $all->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 3);
        $this->assertSame('user.deleted', $all->json('data.0.action'), 'Terbaru di atas.');

        $byTarget = $this->asAdmin()->getJson('/api/v1/audit-logs?target_type=user&target_id='.$a->id)->assertOk();
        $byTarget->assertJsonCount(2, 'data');
        $this->assertEqualsCanonicalizing(['user.updated', 'user.deleted'], collect($byTarget->json('data'))->pluck('action')->all());

        $this->asAdmin()->getJson('/api/v1/audit-logs?action=user.updated')->assertOk()->assertJsonCount(2, 'data');
        $this->asAdmin()->getJson('/api/v1/audit-logs?actor_id='.$this->admin->id)->assertOk()->assertJsonCount(3, 'data');
        $this->asAdmin()->getJson('/api/v1/audit-logs?per_page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.last_page', 2);
    }

    public function test_audit_log_resource_shape(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['email' => 's@example.test', 'name' => 'S']);
        $this->asAdmin()->deleteJson('/api/v1/users/'.$user->id)->assertOk();

        $this->asAdmin()->getJson('/api/v1/audit-logs')->assertOk()->assertJsonStructure([
            'data' => [['id', 'action', 'actor' => ['id', 'name', 'email'], 'target' => ['type', 'id', 'label'], 'changes', 'ip_address', 'created_at']],
            'meta', 'links',
        ]);
    }

    public function test_audit_log_validates_filters(): void
    {
        $this->asAdmin()->getJson('/api/v1/audit-logs?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
        $this->asAdmin()->getJson('/api/v1/audit-logs?from=2026-10-10&to=2026-10-01')->assertStatus(422)->assertJsonValidationErrors(['to']);
    }

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_cannot_read_audit_logs(string $role): void
    {
        $this->as($this->userWithRole($role))->getJson('/api/v1/audit-logs')->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guest_cannot_read_audit_logs(): void
    {
        $this->getJson('/api/v1/audit-logs')->assertUnauthorized();
    }
}
