<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Manajemen Lembaga Bimbingan (Admin): daftar, tambah (profil + akun), ubah, hapus, pulihkan, otorisasi. */
class InstitutionApiTest extends TestCase
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

    /** @param  array<string,mixed>  $overrides */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Bimbel Cerdas Nusantara',
            'email' => 'admin@cerdasnusantara.test',
            'revenue_share_percent' => 80,
        ], $overrides);
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ------------------------------------------------------------------ daftar

    public function test_index_lists_institutions_with_summary_and_resource_shape(): void
    {
        $one = Institution::factory()->create(['name' => 'Bimbel Alfa']);
        Institution::factory()->create(['name' => 'Bimbel Beta'])->user->update(['status' => User::STATUS_SUSPENDED]);
        Transaction::factory()->create(['institution_id' => $one->id])->refresh(); // 80.000 lembaga, 20.000 platform

        $response = $this->asAdmin()->getJson('/api/v1/institutions')->assertOk();

        $response->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Bimbel Alfa')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.status_label', 'Aktif')
            ->assertJsonPath('data.0.balance.available', 80000)
            ->assertJsonPath('data.0.programs_count', 0)
            ->assertJsonPath('data.1.status', 'suspended')
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.active', 1)
            ->assertJsonPath('summary.institution_revenue_total', 80000)
            ->assertJsonPath('summary.platform_revenue_total', 20000)
            ->assertJsonPath('summary.pending_payouts_total', 0);
    }

    public function test_index_hides_the_full_bank_account_number_everywhere(): void
    {
        Institution::factory()->withBank('BCA', 'Bimbel CN', '1234567810')->create();

        $json = $this->asAdmin()->getJson('/api/v1/institutions')->assertOk()
            ->assertJsonPath('data.0.bank.account_last4', '7810')
            ->assertJsonPath('data.0.bank.label', 'BCA ····7810 (Bimbel CN)')
            ->assertJsonPath('data.0.bank.configured', true)
            ->getContent();

        $this->assertStringNotContainsString('1234567810', $json);
    }

    public function test_search_by_name_email_and_phone_and_filter_by_status(): void
    {
        $alfa = Institution::factory()->create(['name' => 'Bimbel Alfa', 'phone' => '0812-3456-789']);
        $alfa->user->update(['email' => 'kontak@alfa.test']);
        $beta = Institution::factory()->create(['name' => 'Lembaga Beta']);
        $beta->user->update(['status' => User::STATUS_INACTIVE]);

        $names = fn (string $query) => collect($this->asAdmin()->getJson('/api/v1/institutions?'.$query)->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Bimbel Alfa'], $names('q=alfa'));
        $this->assertSame(['Bimbel Alfa'], $names('q='.urlencode('KONTAK@ALFA')));
        $this->assertSame(['Bimbel Alfa'], $names('q='.urlencode('0812-3456')));
        $this->assertSame(['Lembaga Beta'], $names('status=inactive'));
        $this->assertSame([], $names('q='.urlencode('%')));
    }

    public function test_index_paginates_and_validates_parameters(): void
    {
        Institution::factory()->count(5)->create();

        $this->asAdmin()->getJson('/api/v1/institutions?per_page=2&page=3')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3);
        $this->asAdmin()->getJson('/api/v1/institutions?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
        $this->asAdmin()->getJson('/api/v1/institutions?status=ngawur')->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    // ------------------------------------------------------------------ tambah

    public function test_create_makes_the_account_and_profile_together_with_a_temporary_password(): void
    {
        $response = $this->asAdmin()->postJson('/api/v1/institutions', $this->payload([
            'name' => '  Bimbel Cerdas Nusantara ',
            'email' => ' ADMIN@CerdasNusantara.test ',
            'description' => 'Bimbingan belajar UTBK.',
            'phone' => '+62 812-3456-7890',
            'address' => 'Jl. Malioboro 1, Yogyakarta',
            'bank_name' => 'BCA',
            'bank_account_holder' => 'Bimbel CN',
            'bank_account_number' => '1234 5678-10',
        ]))->assertCreated();

        $response->assertJsonPath('message', 'Lembaga berhasil dibuat. Kata sandi sementara hanya ditampilkan sekali.')
            ->assertJsonPath('data.name', 'Bimbel Cerdas Nusantara')
            ->assertJsonPath('data.email', 'admin@cerdasnusantara.test')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.revenue_share_percent', 80)
            ->assertJsonPath('data.needs_revenue_share', false)
            ->assertJsonPath('data.bank.account_last4', '7810')
            ->assertJsonPath('data.balance.available', 0)
            ->assertJsonPath('data.programs_count', 0);
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertGreaterThanOrEqual(12, strlen((string) $response->json('temporary_password')));
        $this->assertStringNotContainsString('1234567810', $response->getContent());

        $account = User::where('email', 'admin@cerdasnusantara.test')->firstOrFail();
        $this->assertTrue($account->hasRole(Role::LEMBAGA));
        $this->assertTrue($account->must_change_password);
        $this->assertSame('Bimbel Cerdas Nusantara', $account->name);

        $institution = Institution::where('user_id', $account->id)->firstOrFail();
        $this->assertSame($this->admin->id, $institution->created_by);
        $this->assertSame('1234567810', $institution->bank_account_number);
    }

    public function test_the_bank_account_number_is_encrypted_in_the_database(): void
    {
        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload([
            'bank_name' => 'BCA', 'bank_account_holder' => 'Bimbel CN', 'bank_account_number' => '1234567810',
        ]))->assertCreated();

        $raw = (string) DB::table('institutions')->value('bank_account_number');

        $this->assertNotSame('', $raw);
        $this->assertStringNotContainsString('1234567810', $raw);
    }

    public function test_the_temporary_password_actually_logs_the_institution_in(): void
    {
        $password = $this->asAdmin()->postJson('/api/v1/institutions', $this->payload())->assertCreated()->json('temporary_password');
        $this->app['auth']->forgetGuards();

        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => 'admin@cerdasnusantara.test', 'password' => $password])
            ->assertOk()->assertJsonPath('data.must_change_password', true)->assertJsonPath('data.primary_role', 'lembaga');
    }

    public function test_create_is_audited_without_secrets(): void
    {
        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload([
            'bank_name' => 'BCA', 'bank_account_holder' => 'Bimbel CN', 'bank_account_number' => '1234567810',
        ]))->assertCreated();

        $log = $this->lastLog('institution.created');
        $this->assertSame('Bimbel Cerdas Nusantara', $log->target_label);
        $this->assertSame('7810', $log->changes['after']['bank_account_last4']);
        $this->assertSame(80, $log->changes['after']['revenue_share_percent']);
        $this->assertStringNotContainsString('1234567810', json_encode($log->changes));
    }

    public function test_create_validates_input(): void
    {
        $post = fn (array $o) => $this->asAdmin()->postJson('/api/v1/institutions', $this->payload($o));

        $this->asAdmin()->postJson('/api/v1/institutions', [])->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'revenue_share_percent']);
        $post(['email' => 'bukan-email'])->assertStatus(422)->assertJsonValidationErrors(['email']);
        $post(['revenue_share_percent' => 0])->assertStatus(422)->assertJsonValidationErrors(['revenue_share_percent']);
        $post(['revenue_share_percent' => 101])->assertStatus(422)->assertJsonValidationErrors(['revenue_share_percent']);
        $post(['revenue_share_percent' => 80.5])->assertStatus(422)->assertJsonValidationErrors(['revenue_share_percent']);
        $post(['name' => str_repeat('A', 151)])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $post(['phone' => 'abc'])->assertStatus(422)->assertJsonValidationErrors(['phone']);
        $post(['status' => 'ngawur'])->assertStatus(422)->assertJsonValidationErrors(['status']);
        $post(['password' => 'RahasiaBanget123'])->assertStatus(422)->assertJsonValidationErrors(['password']);
        $post(['bank_name' => 'BCA'])->assertStatus(422)->assertJsonValidationErrors(['bank_account_holder', 'bank_account_number']);
        $post(['bank_name' => 'BCA', 'bank_account_holder' => 'X', 'bank_account_number' => '12ab'])->assertStatus(422)->assertJsonValidationErrors(['bank_account_number']);

        $this->assertSame(0, Institution::count());
    }

    public function test_duplicate_name_is_rejected_case_insensitively_and_duplicate_email_too(): void
    {
        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload())->assertCreated();

        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload(['name' => 'BIMBEL CERDAS NUSANTARA', 'email' => 'lain@x.test']))
            ->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload(['name' => 'Nama Lain']))
            ->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_a_failed_validation_leaves_no_half_created_account(): void
    {
        $before = User::count();

        $this->asAdmin()->postJson('/api/v1/institutions', $this->payload(['revenue_share_percent' => 500]))->assertStatus(422);

        $this->assertSame($before, User::count());
    }

    // ------------------------------------------------------------------ detail

    public function test_show_and_404(): void
    {
        $institution = Institution::factory()->create(['name' => 'Bimbel Detail']);

        $this->asAdmin()->getJson('/api/v1/institutions/'.$institution->id)->assertOk()
            ->assertJsonPath('data.name', 'Bimbel Detail')
            ->assertJsonPath('data.abilities.update', true)
            ->assertJsonPath('data.abilities.manage_payouts', true);
        $this->asAdmin()->getJson('/api/v1/institutions/999999')->assertNotFound();
    }

    public function test_an_account_deleted_through_the_user_menu_is_flagged_on_the_institution(): void
    {
        $institution = Institution::factory()->create();

        $this->asAdmin()->getJson('/api/v1/institutions/'.$institution->id)->assertOk()->assertJsonPath('data.account.deleted', false);

        $institution->user->delete();

        $this->asAdmin()->getJson('/api/v1/institutions/'.$institution->id)->assertOk()->assertJsonPath('data.account.deleted', true);
    }

    public function test_an_institution_without_revenue_share_is_flagged(): void
    {
        $institution = Institution::factory()->share(null)->create();

        $this->asAdmin()->getJson('/api/v1/institutions/'.$institution->id)->assertOk()
            ->assertJsonPath('data.revenue_share_percent', null)
            ->assertJsonPath('data.needs_revenue_share', true);
    }

    // ------------------------------------------------------------------ ubah

    public function test_update_changes_profile_and_syncs_the_account_and_logs_only_what_changed(): void
    {
        $institution = Institution::factory()->create(['name' => 'Nama Lama', 'revenue_share_percent' => 70]);
        $institution->user->update(['name' => 'Nama Lama', 'email' => 'lama@x.test']);

        $this->asAdmin()->patchJson('/api/v1/institutions/'.$institution->id, [
            'name' => 'Nama Baru', 'email' => 'baru@x.test', 'revenue_share_percent' => 75, 'phone' => '021-555-1234',
        ])->assertOk()
            ->assertJsonPath('message', 'Lembaga berhasil diperbarui.')
            ->assertJsonPath('data.name', 'Nama Baru')
            ->assertJsonPath('data.email', 'baru@x.test')
            ->assertJsonPath('data.revenue_share_percent', 75);

        $account = $institution->user->fresh();
        $this->assertSame('Nama Baru', $account->name);
        $this->assertSame('baru@x.test', $account->email);

        $log = $this->lastLog('institution.updated');
        $this->assertEqualsCanonicalizing(['name', 'email', 'revenue_share_percent', 'phone'], array_keys($log->changes['after']));
        $this->assertSame(70, $log->changes['before']['revenue_share_percent']);
    }

    public function test_update_that_changes_nothing_writes_no_log(): void
    {
        $institution = Institution::factory()->create(['name' => 'Sama Saja']);

        $this->asAdmin()->patchJson('/api/v1/institutions/'.$institution->id, ['name' => 'Sama Saja'])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'institution.updated')->count());
    }

    public function test_changing_the_status_updates_the_account_and_signs_the_user_out(): void
    {
        $institution = Institution::factory()->create();
        DB::table('sessions')->insert(['id' => 'sesi-lembaga', 'user_id' => $institution->user_id, 'payload' => 'x', 'last_activity' => time()]);

        $this->asAdmin()->patchJson('/api/v1/institutions/'.$institution->id, ['status' => 'suspended'])->assertOk()
            ->assertJsonPath('data.status', 'suspended')->assertJsonPath('data.status_label', 'Ditangguhkan');

        $this->assertSame('suspended', $institution->user->fresh()->status);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $institution->user_id)->count());
    }

    public function test_update_validates_and_keeps_uniqueness_rules(): void
    {
        $a = Institution::factory()->create(['name' => 'Lembaga A']);
        $b = Institution::factory()->create(['name' => 'Lembaga B']);

        $this->asAdmin()->patchJson('/api/v1/institutions/'.$a->id, ['name' => 'lembaga b'])->assertStatus(422)->assertJsonValidationErrors(['name']);
        $this->asAdmin()->patchJson('/api/v1/institutions/'.$a->id, ['email' => $b->user->email])->assertStatus(422)->assertJsonValidationErrors(['email']);
        $this->asAdmin()->patchJson('/api/v1/institutions/'.$a->id, ['name' => 'LEMBAGA A', 'email' => $a->user->email])->assertOk(); // milik sendiri boleh
        $this->asAdmin()->patchJson('/api/v1/institutions/'.$a->id, ['revenue_share_percent' => 0])->assertStatus(422)->assertJsonValidationErrors(['revenue_share_percent']);
        $this->asAdmin()->patchJson('/api/v1/institutions/'.$a->id, ['password' => 'RahasiaBanget123'])->assertStatus(422)->assertJsonValidationErrors(['password']);
    }

    public function test_bank_details_can_be_changed_partly_but_never_left_incomplete(): void
    {
        $institution = Institution::factory()->withBank('BCA', 'Bimbel CN', '1234567810')->create();
        $url = '/api/v1/institutions/'.$institution->id;

        $this->asAdmin()->patchJson($url, ['bank_name' => 'Mandiri'])->assertOk()->assertJsonPath('data.bank.name', 'Mandiri')->assertJsonPath('data.bank.account_last4', '7810');
        $this->asAdmin()->patchJson($url, ['bank_account_number' => null])->assertStatus(422)->assertJsonValidationErrors(['bank_name']);
        $this->asAdmin()->patchJson($url, ['bank_name' => null, 'bank_account_holder' => null, 'bank_account_number' => null])->assertOk()
            ->assertJsonPath('data.bank.configured', false)->assertJsonPath('data.bank.label', null);

        $institution->refresh();
        $this->assertNull($institution->bank_account_number);
    }

    public function test_a_bank_account_can_be_added_to_an_institution_that_had_none(): void
    {
        $institution = Institution::factory()->create();

        $this->asAdmin()->patchJson('/api/v1/institutions/'.$institution->id, [
            'bank_name' => 'BNI', 'bank_account_holder' => 'Lembaga', 'bank_account_number' => '98765432',
        ])->assertOk()->assertJsonPath('data.bank.account_last4', '5432');

        $log = $this->lastLog('institution.updated');
        $this->assertSame('5432', $log->changes['after']['bank_account_last4']);
        $this->assertStringNotContainsString('98765432', json_encode($log->changes));
    }

    // ------------------------------------------------------------------ hapus dan pulihkan

    public function test_a_clean_institution_is_soft_deleted_with_its_account_and_can_be_restored(): void
    {
        $institution = Institution::factory()->create(['name' => 'Hapus Aku']);
        DB::table('sessions')->insert(['id' => 'sesi-hapus', 'user_id' => $institution->user_id, 'payload' => 'x', 'last_activity' => time()]);

        $this->asAdmin()->deleteJson('/api/v1/institutions/'.$institution->id)->assertOk()->assertJsonPath('message', 'Lembaga berhasil dihapus.');

        $this->assertSoftDeleted($institution);
        $this->assertSoftDeleted($institution->user);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $institution->user_id)->count());
        $this->assertSame('Hapus Aku', $this->lastLog('institution.deleted')->target_label);
        $this->asAdmin()->getJson('/api/v1/institutions/'.$institution->id)->assertNotFound();

        $this->asAdmin()->getJson('/api/v1/institutions?trashed=only')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.deleted_at', fn ($v) => $v !== null);

        $this->asAdmin()->postJson('/api/v1/institutions/'.$institution->id.'/restore')->assertOk()->assertJsonPath('message', 'Lembaga berhasil dipulihkan.');
        $this->assertNotSoftDeleted($institution);
        $this->assertNotSoftDeleted($institution->user);
        $this->assertSame(1, AuditLog::where('action', 'institution.restored')->count());
    }

    public function test_restoring_an_institution_that_is_not_deleted_is_rejected(): void
    {
        $institution = Institution::factory()->create();

        $this->asAdmin()->postJson('/api/v1/institutions/'.$institution->id.'/restore')->assertStatus(422)->assertJsonValidationErrors(['institution']);
    }

    public function test_an_institution_with_financial_history_cannot_be_deleted(): void
    {
        $withSale = Institution::factory()->create();
        Transaction::factory()->create(['institution_id' => $withSale->id]);
        $withPayout = Institution::factory()->create();
        InstitutionPayout::create(['code' => 'PO-X-1', 'amount' => 1000, 'institution_id' => $withPayout->id]);

        foreach ([$withSale, $withPayout] as $institution) {
            $this->asAdmin()->deleteJson('/api/v1/institutions/'.$institution->id)->assertStatus(422)->assertJsonValidationErrors(['institution']);
            $this->assertNotSoftDeleted($institution);
        }
        $this->assertSame(0, AuditLog::where('action', 'institution.deleted')->count());
    }

    public function test_an_institution_with_active_students_cannot_be_deleted_until_they_leave(): void
    {
        $institution = Institution::factory()->create();
        $program = Course::factory()->institution($institution->user)->active()->create();
        $enrollment = Enrollment::factory()->create(['course_id' => $program->id, 'user_id' => $this->userWithRole(Role::SISWA)->id]);

        $this->asAdmin()->deleteJson('/api/v1/institutions/'.$institution->id)->assertStatus(422)->assertJsonValidationErrors(['institution']);

        $enrollment->update(['status' => Enrollment::STATUS_CANCELLED]);
        $this->asAdmin()->deleteJson('/api/v1/institutions/'.$institution->id)->assertOk();
    }

    // ------------------------------------------------------------------ otorisasi

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_rejected_everywhere(string $role): void
    {
        $actor = $this->userWithRole($role);
        $institution = Institution::factory()->create();
        $base = '/api/v1/institutions/'.$institution->id;

        $this->as($actor)->getJson('/api/v1/institutions')->assertForbidden();
        $this->as($actor)->getJson($base)->assertForbidden();
        $this->as($actor)->getJson($base.'/dashboard')->assertForbidden();
        $this->as($actor)->getJson($base.'/payouts')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/institutions', $this->payload())->assertForbidden();
        $this->as($actor)->patchJson($base, ['name' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson($base)->assertForbidden();
        $this->as($actor)->postJson($base.'/restore')->assertForbidden();
        $this->as($actor)->postJson($base.'/payouts', [])->assertForbidden();

        $this->assertSame('Bimbel', substr($institution->fresh()->name, 0, 6));
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_an_institution_account_cannot_manage_other_institutions(): void
    {
        $mine = Institution::factory()->create();
        $other = Institution::factory()->create();

        $this->as($mine->user)->getJson('/api/v1/institutions/'.$other->id)->assertForbidden();
        $this->as($mine->user)->getJson('/api/v1/institutions/'.$mine->id)->assertForbidden(); // menu ini khusus Admin
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/institutions')->assertUnauthorized();
        $this->postJson('/api/v1/institutions', [])->assertUnauthorized();
    }

    public function test_view_permission_alone_cannot_change_anything(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()
            ->syncWithoutDetaching(Permission::where('slug', 'institutions.view')->pluck('id'));
        $reader = $this->userWithRole(Role::MENTOR);
        $institution = Institution::factory()->create();

        $this->as($reader)->getJson('/api/v1/institutions')->assertOk();
        $this->as($reader)->getJson('/api/v1/institutions/'.$institution->id.'/dashboard')->assertOk();
        $this->as($reader)->postJson('/api/v1/institutions', $this->payload())->assertForbidden();
        $this->as($reader)->patchJson('/api/v1/institutions/'.$institution->id, ['name' => 'X'])->assertForbidden();
        $this->as($reader)->deleteJson('/api/v1/institutions/'.$institution->id)->assertForbidden();
    }

    public function test_institution_permissions_belong_to_admin_only(): void
    {
        $slugs = ['institutions.view', 'institutions.create', 'institutions.update', 'institutions.delete', 'institutions.payout', 'roles.manage'];

        $admin = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug');
        foreach ($slugs as $slug) {
            $this->assertTrue($admin->contains($slug), "Admin harus punya {$slug}.");
        }
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $role) {
            $permissions = Role::where('slug', $role)->firstOrFail()->permissions->pluck('slug');
            foreach ($slugs as $slug) {
                $this->assertFalse($permissions->contains($slug), "Role {$role} tidak boleh punya {$slug}.");
            }
        }
    }

    // ------------------------------------------------------------------ data lama

    public function test_existing_institution_accounts_receive_a_profile_when_the_migration_runs(): void
    {
        $legacy = $this->userWithRole(Role::LEMBAGA, ['name' => 'Bimbel Lama']);
        $gone = $this->userWithRole(Role::LEMBAGA, ['name' => 'Bimbel Dihapus']);
        $gone->delete();
        $this->userWithRole(Role::MENTOR);

        // Mengulang migrasi tabel dari nol seperti pada database yang sudah berisi akun Lembaga.
        \Illuminate\Support\Facades\Schema::dropIfExists('institution_payouts');
        \Illuminate\Support\Facades\Schema::dropIfExists('transactions');
        \Illuminate\Support\Facades\Schema::dropIfExists('institutions');
        (require base_path('database/migrations/2026_11_23_000001_create_institutions_table.php'))->up();

        $rows = DB::table('institutions')->orderBy('user_id')->get();
        $this->assertCount(2, $rows);
        $this->assertSame('Bimbel Lama', $rows[0]->name);
        $this->assertNull($rows[0]->revenue_share_percent);
        $this->assertNull($rows[0]->deleted_at);
        $this->assertNotNull($rows[1]->deleted_at);
    }
}
