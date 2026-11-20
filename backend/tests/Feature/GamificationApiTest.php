<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Level;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\XpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GamificationApiTest extends TestCase
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

    private function siswa(string $name, int $xp = 0, array $attributes = []): User
    {
        $user = $this->userWithRole(Role::SISWA, array_merge(['name' => $name, 'email' => strtolower(str_replace(' ', '.', $name)).'@example.test'], $attributes));
        if ($xp > 0) {
            (new XpService)->adjust($user, $xp, 'Data uji', $this->admin);
        }

        return $user;
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ papan peringkat

    public function test_leaderboard_shares_ranks_for_equal_scores_and_skips_the_next_number(): void
    {
        $this->siswa('Andi', 500);
        $this->siswa('Budi', 300);
        $this->siswa('Citra', 300);
        $this->siswa('Dewi', 100);
        $this->siswa('Eko');
        $this->siswa('Fajar');

        $rows = collect($this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertOk()->json('data'));

        $this->assertSame(['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar'], $rows->pluck('user.name')->all());
        $this->assertSame([1, 2, 2, 4, 5, 5], $rows->pluck('rank')->all(), 'Peringkat kompetisi: 1, 2, 2, 4, 5, 5.');
        $this->assertSame([500, 300, 300, 100, 0, 0], $rows->pluck('xp')->all());
    }

    public function test_leaderboard_only_lists_active_students_who_are_not_deleted(): void
    {
        $this->siswa('Aktif Satu', 10);
        $this->siswa('Nonaktif', 999, ['status' => 'inactive']);
        $this->siswa('Ditangguhkan', 999, ['status' => 'suspended']);
        $this->siswa('Terhapus', 999)->delete();
        $this->userWithRole(Role::MENTOR, ['name' => 'Mentor X']);
        $this->userWithRole(Role::KARYAWAN, ['name' => 'Karyawan X']);

        $names = collect($this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertOk()->json('data'))->pluck('user.name')->all();

        $this->assertSame(['Aktif Satu'], $names);
    }

    public function test_equal_scores_are_ordered_by_name_then_id(): void
    {
        $this->siswa('Zaki', 50);
        $this->siswa('Ali', 50);
        $this->siswa('Mira', 50);

        $names = collect($this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->json('data'))->pluck('user.name')->all();

        $this->assertSame(['Ali', 'Mira', 'Zaki'], $names);
    }

    public function test_leaderboard_includes_level_when_levels_exist(): void
    {
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        Level::create(['name' => 'Menengah', 'min_xp' => 300]);
        Level::create(['name' => 'Mahir', 'min_xp' => 500]);
        $this->siswa('Andi', 500);
        $this->siswa('Budi', 350);
        $this->siswa('Citra', 20);

        $levels = collect($this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->json('data'))->pluck('level.name', 'user.name')->all();

        $this->assertSame(['Andi' => 'Mahir', 'Budi' => 'Menengah', 'Citra' => 'Pemula'], $levels);
    }

    public function test_leaderboard_has_no_level_when_none_is_defined(): void
    {
        $this->siswa('Andi', 500);

        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertOk()
            ->assertJsonPath('data.0.level', null)->assertJsonPath('data.0.xp', 500);
    }

    public function test_search_keeps_the_true_global_rank(): void
    {
        $this->siswa('Andi Pertama', 900);
        $this->siswa('Budi Kedua', 800);
        $this->siswa('Citra Ketiga', 700);

        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?q=citra')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.rank', 3)->assertJsonPath('data.0.user.name', 'Citra Ketiga');
        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?q='.urlencode('BUDI.KEDUA@EXAMPLE'))->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.rank', 2);
    }

    public function test_search_treats_wildcards_as_plain_text(): void
    {
        $this->siswa('Diskon 50% Siswa');
        $this->siswa('Biasa Saja');

        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?q='.urlencode('%'))->assertOk()->assertJsonCount(1, 'data');
        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?q='.urlencode('_'))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_leaderboard_paginates_and_validates(): void
    {
        foreach (range(1, 5) as $i) {
            $this->siswa("Siswa {$i}", $i * 10);
        }

        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?per_page=2&page=3')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('data.0.rank', 5);
        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
    }

    // ------------------------------------------------------------------ ringkasan

    public function test_summary_cards(): void
    {
        $this->siswa('Satu', 100);
        $this->siswa('Dua', 200);
        $this->siswa('Tiga');                                   // tanpa XP dihitung 0 dalam rata-rata
        $this->siswa('Nonaktif', 1000, ['status' => 'inactive']); // tidak dihitung
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);

        $this->asAdmin()->getJson('/api/v1/gamification/summary')->assertOk()
            ->assertJsonPath('data.students_count', 3)
            ->assertJsonPath('data.total_xp', 300)
            ->assertJsonPath('data.average_xp', 100)
            ->assertJsonPath('data.highest_xp', 200)
            ->assertJsonPath('data.levels_count', 1);
    }

    public function test_summary_rounds_the_average_to_one_decimal(): void
    {
        $this->siswa('Satu', 10);
        $this->siswa('Dua');
        $this->siswa('Tiga');

        $this->asAdmin()->getJson('/api/v1/gamification/summary')->assertOk()->assertJsonPath('data.average_xp', 3.3);
    }

    public function test_summary_without_students_is_all_zero(): void
    {
        $this->asAdmin()->getJson('/api/v1/gamification/summary')->assertOk()
            ->assertJsonPath('data.students_count', 0)->assertJsonPath('data.total_xp', 0)
            ->assertJsonPath('data.average_xp', 0)->assertJsonPath('data.highest_xp', 0);
    }

    // ------------------------------------------------------------------ riwayat XP

    public function test_xp_history_shows_entries_newest_first_with_labels_and_state(): void
    {
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        $siswa = $this->siswa('Andi');
        $xp = new XpService;
        $xp->award($siswa, 10, 'material', 5, 'Materi selesai');
        $xp->adjust($siswa, 40, 'Bonus lomba', $this->admin);

        $response = $this->asAdmin()->getJson('/api/v1/gamification/users/'.$siswa->id.'/xp')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('xp', 50)
            ->assertJsonPath('level.name', 'Pemula')
            ->assertJsonPath('data.0.amount', 40)
            ->assertJsonPath('data.0.source_label', 'Koreksi Admin')
            ->assertJsonPath('data.0.reason', 'Bonus lomba')
            ->assertJsonPath('data.0.created_by.name', 'Admin Uji')
            ->assertJsonPath('data.1.amount', 10)
            ->assertJsonPath('data.1.source_label', 'Materi diselesaikan')
            ->assertJsonPath('data.1.created_by', null);
    }

    public function test_xp_history_is_only_for_students(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);

        $this->asAdmin()->getJson('/api/v1/gamification/users/'.$mentor->id.'/xp')->assertNotFound();
        $this->asAdmin()->getJson('/api/v1/gamification/users/999999/xp')->assertNotFound();
    }

    // ------------------------------------------------------------------ koreksi XP

    public function test_adjust_creates_a_ledger_entry_and_an_audit_record(): void
    {
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        Level::create(['name' => 'Menengah', 'min_xp' => 100]);
        $siswa = $this->siswa('Andi', 80);

        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments', ['amount' => 50, 'reason' => 'Juara lomba'])
            ->assertCreated()
            ->assertJsonPath('message', 'XP berhasil dikoreksi.')
            ->assertJsonPath('data.amount', 50)
            ->assertJsonPath('data.source_type', 'adjustment')
            ->assertJsonPath('xp', 130)
            ->assertJsonPath('level.name', 'Menengah');

        $log = $this->lastLog('xp.adjusted');
        $this->assertSame($siswa->id, $log->target_id);
        $this->assertSame($this->admin->id, $log->actor_id);
        $this->assertSame(['amount' => 50, 'reason' => 'Juara lomba', 'before' => 80, 'after' => 130], $log->changes);
    }

    public function test_a_negative_adjustment_is_allowed_but_never_below_zero(): void
    {
        $siswa = $this->siswa('Andi', 60);

        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments', ['amount' => -20, 'reason' => 'Salah input'])
            ->assertCreated()->assertJsonPath('xp', 40);

        $logsBefore = AuditLog::count();
        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments', ['amount' => -41, 'reason' => 'Kebanyakan'])
            ->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->assertSame(40, (new XpService)->balanceOf($siswa));
        $this->assertSame($logsBefore, AuditLog::count(), 'Penolakan tidak meninggalkan catatan audit.');
    }

    public function test_adjust_validates_input(): void
    {
        $siswa = $this->siswa('Andi', 10);
        $url = '/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments';

        $this->asAdmin()->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['amount', 'reason']);
        $this->asAdmin()->postJson($url, ['amount' => 0, 'reason' => 'Uji'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($url, ['amount' => 1.5, 'reason' => 'Uji'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($url, ['amount' => 1000001, 'reason' => 'Uji'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($url, ['amount' => 5, 'reason' => 'ab'])->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->asAdmin()->postJson($url, ['amount' => 5, 'reason' => str_repeat('a', 256)])->assertStatus(422)->assertJsonValidationErrors(['reason']);

        $this->assertSame(1, XpTransaction::count());
        $this->assertSame(0, AuditLog::where('action', 'xp.adjusted')->count());
    }

    public function test_only_students_can_be_adjusted(): void
    {
        $mentor = $this->userWithRole(Role::MENTOR);

        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$mentor->id.'/xp-adjustments', ['amount' => 10, 'reason' => 'Uji'])
            ->assertStatus(422)->assertJsonValidationErrors(['user']);

        $deleted = $this->siswa('Terhapus');
        $deleted->delete();
        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$deleted->id.'/xp-adjustments', ['amount' => 10, 'reason' => 'Uji'])->assertNotFound();

        $this->assertSame(0, XpTransaction::count());
    }

    // ------------------------------------------------------------------ reset XP

    public function test_reset_zeroes_the_xp_keeps_history_and_is_audited(): void
    {
        $siswa = $this->siswa('Andi', 250);

        $this->asAdmin()->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-reset', ['reason' => 'Akun disalahgunakan'])
            ->assertOk()
            ->assertJsonPath('message', 'XP berhasil direset ke 0.')
            ->assertJsonPath('xp', 0)
            ->assertJsonPath('data.amount', -250)
            ->assertJsonPath('data.source_type', 'reset');

        $this->assertSame(2, XpTransaction::where('user_id', $siswa->id)->count(), 'Riwayat lama tetap ada.');
        $this->assertSame(['reason' => 'Akun disalahgunakan', 'before' => 250, 'after' => 0], $this->lastLog('xp.reset')->changes);
        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertJsonPath('data.0.xp', 0);
    }

    public function test_reset_validates_and_rejects_a_zero_balance(): void
    {
        $siswa = $this->siswa('Andi');
        $url = '/api/v1/gamification/users/'.$siswa->id.'/xp-reset';

        $this->asAdmin()->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->asAdmin()->postJson($url, ['reason' => 'Uji'])->assertStatus(422)->assertJsonValidationErrors(['user']);

        $this->assertSame(0, AuditLog::where('action', 'xp.reset')->count());
    }

    // ------------------------------------------------------------------ level

    public function test_levels_crud(): void
    {
        $created = $this->asAdmin()->postJson('/api/v1/gamification/levels', ['name' => 'Pemula', 'min_xp' => 0])
            ->assertCreated()->assertJsonPath('message', 'Level berhasil dibuat.')->assertJsonPath('data.min_xp', 0);
        $id = $created->json('data.id');
        $this->asAdmin()->postJson('/api/v1/gamification/levels', ['name' => 'Mahir', 'min_xp' => 500])->assertCreated();
        $this->asAdmin()->postJson('/api/v1/gamification/levels', ['name' => 'Menengah', 'min_xp' => 200])->assertCreated();

        $names = collect($this->asAdmin()->getJson('/api/v1/gamification/levels')->assertOk()->json('data'))->pluck('name')->all();
        $this->assertSame(['Pemula', 'Menengah', 'Mahir'], $names, 'Terurut dari batas XP terendah.');

        $this->asAdmin()->getJson('/api/v1/gamification/levels/'.$id)->assertOk()->assertJsonPath('data.name', 'Pemula');
        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$id, ['name' => 'Pemula Baru'])->assertOk()->assertJsonPath('data.name', 'Pemula Baru');
        $this->asAdmin()->deleteJson('/api/v1/gamification/levels/'.$id)->assertOk()->assertJsonPath('message', 'Level berhasil dihapus.');
        $this->assertNull(Level::find($id));
        $this->asAdmin()->getJson('/api/v1/gamification/levels/'.$id)->assertNotFound();
    }

    public function test_level_validation(): void
    {
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        $post = fn (array $o) => $this->asAdmin()->postJson('/api/v1/gamification/levels', array_merge(['name' => 'Baru', 'min_xp' => 100], $o));

        $this->asAdmin()->postJson('/api/v1/gamification/levels', [])->assertStatus(422)->assertJsonValidationErrors(['name', 'min_xp']);
        $post(['name' => 'Pemula'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $post(['min_xp' => 0])->assertStatus(422)->assertJsonValidationErrors(['min_xp']);
        $post(['min_xp' => -1])->assertStatus(422)->assertJsonValidationErrors(['min_xp']);
        $post(['min_xp' => 1.5])->assertStatus(422)->assertJsonValidationErrors(['min_xp']);
        $post(['name' => str_repeat('a', 51)])->assertStatus(422)->assertJsonValidationErrors(['name']);

        $this->assertSame(1, Level::count());
    }

    public function test_updating_a_level_keeps_its_own_values_valid_but_not_a_duplicate(): void
    {
        $a = Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        Level::create(['name' => 'Mahir', 'min_xp' => 500]);

        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$a->id, ['name' => 'Pemula', 'min_xp' => 0])->assertOk();
        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$a->id, ['name' => 'Mahir'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$a->id, ['min_xp' => 500])->assertStatus(422)->assertJsonValidationErrors(['min_xp']);
    }

    public function test_levels_are_audited_and_a_no_op_update_is_not(): void
    {
        $id = $this->asAdmin()->postJson('/api/v1/gamification/levels', ['name' => 'Pemula', 'min_xp' => 0])->json('data.id');
        $this->assertSame(['name' => 'Pemula', 'min_xp' => 0], $this->lastLog('level.created')->changes['after']);

        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$id, ['name' => 'Pemula'])->assertOk();
        $this->assertSame(0, AuditLog::where('action', 'level.updated')->count());

        $this->asAdmin()->patchJson('/api/v1/gamification/levels/'.$id, ['min_xp' => 50])->assertOk();
        $log = $this->lastLog('level.updated');
        $this->assertSame(['min_xp' => 0], $log->changes['before']);
        $this->assertSame(['min_xp' => 50], $log->changes['after']);

        $this->asAdmin()->deleteJson('/api/v1/gamification/levels/'.$id)->assertOk();
        $this->assertSame('Pemula', $this->lastLog('level.deleted')->target_label);
    }

    public function test_changing_levels_changes_the_leaderboard_without_touching_xp(): void
    {
        $this->siswa('Andi', 300);
        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertJsonPath('data.0.level', null);

        $this->asAdmin()->postJson('/api/v1/gamification/levels', ['name' => 'Menengah', 'min_xp' => 200]);

        $this->asAdmin()->getJson('/api/v1/gamification/leaderboard')->assertJsonPath('data.0.level.name', 'Menengah')->assertJsonPath('data.0.xp', 300);
    }

    // ------------------------------------------------------------------ otorisasi

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_rejected_everywhere(string $role): void
    {
        $actor = $this->userWithRole($role);
        $siswa = $this->siswa('Target', 100);
        $level = Level::create(['name' => 'Pemula', 'min_xp' => 0]);

        $reads = ['/api/v1/gamification/leaderboard', '/api/v1/gamification/summary', '/api/v1/gamification/users/'.$siswa->id.'/xp',
            '/api/v1/gamification/levels', '/api/v1/gamification/levels/'.$level->id];
        foreach ($reads as $url) {
            $this->as($actor)->getJson($url)->assertForbidden();
        }

        $this->as($actor)->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments', ['amount' => 5, 'reason' => 'Curang'])->assertForbidden();
        $this->as($actor)->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-reset', ['reason' => 'Curang'])->assertForbidden();
        $this->as($actor)->postJson('/api/v1/gamification/levels', ['name' => 'X', 'min_xp' => 9])->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/gamification/levels/'.$level->id, ['name' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/gamification/levels/'.$level->id)->assertForbidden();

        $this->assertSame(100, (new XpService)->balanceOf($siswa));
        $this->assertSame('Pemula', $level->fresh()->name);
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_view_permission_alone_cannot_change_anything(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()
            ->syncWithoutDetaching(Permission::where('slug', 'gamification.view')->pluck('id'));
        $reader = $this->userWithRole(Role::MENTOR);
        $siswa = $this->siswa('Target', 100);

        $this->as($reader)->getJson('/api/v1/gamification/leaderboard')->assertOk();
        $this->as($reader)->getJson('/api/v1/gamification/levels')->assertOk();
        $this->as($reader)->postJson('/api/v1/gamification/users/'.$siswa->id.'/xp-adjustments', ['amount' => 5, 'reason' => 'Curang'])->assertForbidden();
        $this->as($reader)->postJson('/api/v1/gamification/levels', ['name' => 'X', 'min_xp' => 9])->assertForbidden();
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/gamification/leaderboard')->assertUnauthorized();
        $this->getJson('/api/v1/gamification/summary')->assertUnauthorized();
        $this->postJson('/api/v1/gamification/levels', [])->assertUnauthorized();
    }

    public function test_gamification_permissions_belong_to_admin_only(): void
    {
        $slugs = ['gamification.view', 'gamification.manage'];

        $admin = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug');
        foreach ($slugs as $slug) {
            $this->assertTrue($admin->contains($slug), "Admin harus punya {$slug}.");
        }
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $role) {
            $permissions = Role::where('slug', $role)->firstOrFail()->permissions->pluck('slug');
            foreach ($slugs as $slug) {
                $this->assertFalse($permissions->contains($slug), "{$role} tidak boleh punya {$slug}.");
            }
        }
    }
}
