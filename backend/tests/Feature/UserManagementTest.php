<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\V1\UserController;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        // Data tetap (bukan acak dari Faker) supaya test pencarian tidak kadang-kadang gagal.
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'web');
    }

    // ------------------------------------------------------------------ daftar & filter

    public function test_list_hides_deleted_users_by_default_and_trashed_only_shows_them(): void
    {
        $aktif = $this->userWithRole(Role::SISWA, ['name' => 'Aktif Biasa', 'email' => 'aktif@example.test']);
        $dihapus = $this->userWithRole(Role::SISWA, ['name' => 'Sudah Dihapus', 'email' => 'dihapus.biasa@example.test']);
        $dihapus->delete();

        $names = collect($this->asAdmin()->getJson('/api/v1/users')->assertOk()->json('data'))->pluck('name');
        $this->assertTrue($names->contains('Aktif Biasa'));
        $this->assertFalse($names->contains('Sudah Dihapus'));

        $this->asAdmin()->getJson('/api/v1/users?trashed=only')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $dihapus->id)
            ->assertJsonPath('data.0.deleted_at', fn ($value) => $value !== null);

        $this->assertNotNull($aktif->fresh());
    }

    public function test_search_treats_percent_and_underscore_as_plain_text(): void
    {
        $this->userWithRole(Role::SISWA, ['name' => 'Budi Santoso', 'email' => 'budi@example.test']);
        $this->userWithRole(Role::SISWA, ['name' => 'Diskon 50% Spesial', 'email' => 'promo@example.test']);

        // "%" tidak boleh menjadi wildcard yang mencocokkan semua orang.
        $this->asAdmin()->getJson('/api/v1/users?q='.urlencode('%'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Diskon 50% Spesial');

        $this->asAdmin()->getJson('/api/v1/users?q='.urlencode('_'))
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_search_with_zero_is_not_ignored(): void
    {
        $this->userWithRole(Role::SISWA, ['name' => 'Peserta 007', 'email' => 'peserta.a@example.test']);
        $this->userWithRole(Role::SISWA, ['name' => 'Peserta Lain', 'email' => 'peserta.b@example.test']);

        $this->asAdmin()->getJson('/api/v1/users?q=0')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Peserta 007');
    }

    public function test_list_filters_by_role_status_and_validates_params(): void
    {
        $this->userWithRole(Role::SISWA, ['name' => 'Siswa Aktif']);
        $this->userWithRole(Role::SISWA, ['name' => 'Siswa Blokir', 'status' => 'suspended']);
        $this->userWithRole(Role::MENTOR, ['name' => 'Mentor Aktif']);

        $this->asAdmin()->getJson('/api/v1/users?role=siswa&status=suspended')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Siswa Blokir');

        $this->asAdmin()->getJson('/api/v1/users?status=ngawur')->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->asAdmin()->getJson('/api/v1/users?trashed=ngawur')->assertStatus(422)->assertJsonValidationErrors(['trashed']);
        $this->asAdmin()->getJson('/api/v1/users?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
    }

    public function test_pagination_meta_and_stable_order(): void
    {
        foreach (range(1, 5) as $i) {
            $this->userWithRole(Role::SISWA, ['name' => 'Sama Nama', 'email' => "sama{$i}@example.test"]);
        }

        $page1 = $this->asAdmin()->getJson('/api/v1/users?q=sama&per_page=2&page=1')->assertOk();
        $page2 = $this->asAdmin()->getJson('/api/v1/users?q=sama&per_page=2&page=2')->assertOk();
        $page3 = $this->asAdmin()->getJson('/api/v1/users?q=sama&per_page=2&page=3')->assertOk();

        $page1->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3);

        $ids = collect([$page1, $page2, $page3])->flatMap(fn ($r) => collect($r->json('data'))->pluck('id'));
        $this->assertCount(5, $ids->unique(), 'Tidak boleh ada baris dobel/terlewat antar halaman.');
    }

    // ------------------------------------------------------------------ detail

    public function test_admin_can_view_detail_including_deleted_user(): void
    {
        $user = $this->userWithRole(Role::KARYAWAN, ['name' => 'Detail Karyawan']);

        $this->asAdmin()->getJson('/api/v1/users/'.$user->id)
            ->assertOk()
            ->assertJsonPath('data.name', 'Detail Karyawan')
            ->assertJsonPath('data.primary_role', 'karyawan')
            ->assertJsonPath('data.deleted_at', null);

        $user->delete();

        $this->asAdmin()->getJson('/api/v1/users/'.$user->id)
            ->assertOk()
            ->assertJsonPath('data.deleted_at', fn ($value) => $value !== null);
    }

    public function test_detail_of_missing_user_returns_404(): void
    {
        $this->asAdmin()->getJson('/api/v1/users/999999')->assertNotFound();
    }

    // ------------------------------------------------------------------ tambah & ubah

    public function test_create_defaults_to_active_and_exactly_one_role(): void
    {
        $this->asAdmin()->postJson('/api/v1/users', [
            'name' => 'Mentor Baru',
            'email' => 'mentor.baru@example.test',
            'password' => 'KataSandiKuat123',
            'role' => 'mentor',
        ])->assertCreated()->assertJsonPath('message', 'Pengguna berhasil dibuat.');

        $user = User::where('email', 'mentor.baru@example.test')->firstOrFail();
        $this->assertSame('active', $user->status);
        $this->assertSame(['mentor'], $user->roles()->pluck('slug')->all());
    }

    public function test_cannot_reuse_email_of_a_deleted_user(): void
    {
        $lama = $this->userWithRole(Role::SISWA, ['email' => 'lama@example.test']);
        $lama->delete();

        $this->asAdmin()->postJson('/api/v1/users', [
            'name' => 'Orang Baru',
            'email' => 'lama@example.test',
            'password' => 'KataSandiKuat123',
            'role' => 'siswa',
        ])->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_update_changes_role_to_exactly_one_role(): void
    {
        $user = $this->userWithRole(Role::SISWA);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['role' => 'mentor', 'name' => 'Nama Baru'])
            ->assertOk()
            ->assertJsonPath('data.primary_role', 'mentor')
            ->assertJsonPath('data.name', 'Nama Baru');

        $this->assertSame(['mentor'], $user->roles()->pluck('slug')->all());
    }

    public function test_update_allows_keeping_own_email_but_rejects_taken_email(): void
    {
        $a = $this->userWithRole(Role::SISWA, ['email' => 'a@example.test']);
        $this->userWithRole(Role::SISWA, ['email' => 'b@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$a->id, ['email' => 'a@example.test'])->assertOk();
        $this->asAdmin()->patchJson('/api/v1/users/'.$a->id, ['email' => 'b@example.test'])
            ->assertStatus(422)->assertJsonValidationErrors(['email']);
    }

    public function test_update_rejects_unknown_role_and_cannot_edit_deleted_user(): void
    {
        $user = $this->userWithRole(Role::SISWA);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['role' => 'tidak-ada'])
            ->assertStatus(422)->assertJsonValidationErrors(['role']);

        $user->delete();
        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['name' => 'X'])->assertNotFound();
    }

    public function test_admin_password_reset_signs_the_user_out_everywhere(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $this->fakeSession($user);
        $this->assertSame(1, DB::table('sessions')->where('user_id', $user->id)->count());

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['password' => 'PasswordBaru12345'])->assertOk();

        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
        $this->assertTrue(password_verify('PasswordBaru12345', $user->fresh()->password));
    }

    public function test_update_without_password_keeps_sessions(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $this->fakeSession($user);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['name' => 'Ganti Nama Saja'])->assertOk();

        $this->assertSame(1, DB::table('sessions')->where('user_id', $user->id)->count());
    }

    // ------------------------------------------------------------------ hapus & pulihkan

    public function test_delete_is_soft_and_revokes_sessions(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $this->fakeSession($user);

        $this->asAdmin()->deleteJson('/api/v1/users/'.$user->id)
            ->assertOk()
            ->assertJsonPath('message', 'Pengguna berhasil dihapus.');

        $this->assertSoftDeleted($user);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
        $this->assertSame(['siswa'], $user->roles()->pluck('slug')->all(), 'Role dipertahankan agar bisa dipulihkan.');
    }

    public function test_deleted_user_cannot_log_in(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['email' => 'hapus@example.test']);
        $user->delete();

        $this->asSpa()->postJson('/api/v1/auth/login', [
            'email' => 'hapus@example.test',
            'password' => 'password-rahasia-123',
        ])->assertStatus(422);

        $this->assertGuest('web');
    }

    public function test_restore_brings_user_back_with_role_and_status(): void
    {
        $user = $this->userWithRole(Role::MENTOR, ['status' => 'inactive']);
        $user->delete();

        $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/restore')
            ->assertOk()
            ->assertJsonPath('message', 'Pengguna berhasil dipulihkan.')
            ->assertJsonPath('data.primary_role', 'mentor')
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.deleted_at', null);

        $this->assertNotSoftDeleted($user);
    }

    public function test_restore_of_a_user_that_is_not_deleted_is_rejected(): void
    {
        $user = $this->userWithRole(Role::SISWA);

        $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/restore')
            ->assertStatus(422)->assertJsonValidationErrors(['user']);
    }

    // ------------------------------------------------------------------ export

    public function test_export_returns_csv_with_bom_header_and_respects_filters(): void
    {
        $this->userWithRole(Role::SISWA, ['name' => 'Siswa Satu', 'email' => 'satu@example.test']);
        $this->userWithRole(Role::MENTOR, ['name' => 'Mentor Satu', 'email' => 'mentor1@example.test']);
        $hapus = $this->userWithRole(Role::SISWA, ['name' => 'Siswa Terhapus', 'email' => 'hapus@example.test']);
        $hapus->delete();

        $response = $this->asAdmin()->get('/api/v1/users/export?role=siswa');
        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename=pengguna-', $response->headers->get('Content-Disposition'));

        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv, 'BOM UTF-8 diperlukan agar Excel membaca benar.');
        $this->assertStringContainsString('ID,Nama,Email,Role,Status', $csv);
        $this->assertStringContainsString('satu@example.test', $csv);
        $this->assertStringNotContainsString('mentor1@example.test', $csv, 'Filter role harus berlaku di export.');
        $this->assertStringNotContainsString('hapus@example.test', $csv, 'Akun terhapus tidak ikut kecuali diminta.');
        $this->assertStringContainsString('Aktif', $csv);
    }

    public function test_export_can_include_only_deleted_users(): void
    {
        $this->userWithRole(Role::SISWA, ['email' => 'masih@example.test']);
        $hapus = $this->userWithRole(Role::SISWA, ['email' => 'dihapus@example.test']);
        $hapus->delete();

        $csv = $this->asAdmin()->get('/api/v1/users/export?trashed=only')->streamedContent();

        $this->assertStringContainsString('dihapus@example.test', $csv);
        $this->assertStringNotContainsString('masih@example.test', $csv);
    }

    public function test_export_neutralises_spreadsheet_formulas(): void
    {
        $this->userWithRole(Role::SISWA, ['name' => '=HYPERLINK("http://jahat.test","klik")', 'email' => 'rumus@example.test']);

        $csv = $this->asAdmin()->get('/api/v1/users/export')->streamedContent();

        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringNotContainsString(',"=HYPERLINK', $csv);
    }

    public function test_csv_safe_helper(): void
    {
        $this->assertSame("'=1+1", UserController::csvSafe('=1+1'));
        $this->assertSame("'+62812", UserController::csvSafe('+62812'));
        $this->assertSame("'-5", UserController::csvSafe('-5'));
        $this->assertSame("'@SUM(A1)", UserController::csvSafe('@SUM(A1)'));
        $this->assertSame('Budi', UserController::csvSafe('Budi'));
        $this->assertSame('', UserController::csvSafe(null));
        $this->assertSame('12', UserController::csvSafe(12));
    }

    public function test_export_route_is_not_swallowed_by_user_id_route(): void
    {
        // Jika "export" dibaca sebagai {user}, hasilnya 404 (user tidak ditemukan).
        $this->asAdmin()->get('/api/v1/users/export')->assertOk();
    }

    // ------------------------------------------------------------------ otorisasi (role lain harus ditolak)

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_cannot_use_new_endpoints(string $role): void
    {
        $actor = $this->userWithRole($role);
        $target = $this->userWithRole(Role::SISWA);
        $target->delete();

        $this->actingAs($actor, 'web')->get('/api/v1/users/export')->assertForbidden();
        $this->actingAs($actor, 'web')->postJson('/api/v1/users/'.$target->id.'/restore')->assertForbidden();
        $this->actingAs($actor, 'web')->getJson('/api/v1/users/'.$target->id)->assertForbidden();
        $this->actingAs($actor, 'web')->getJson('/api/v1/users?trashed=only')->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guest_cannot_use_new_endpoints(): void
    {
        $this->getJson('/api/v1/users/export')->assertUnauthorized();
        $this->postJson('/api/v1/users/1/restore')->assertUnauthorized();
    }

    // ------------------------------------------------------------------ ringkasan & command admin

    public function test_admin_summary_excludes_deleted_users_and_counts_them_separately(): void
    {
        $this->userWithRole(Role::SISWA);
        $hapus = $this->userWithRole(Role::MENTOR);
        $hapus->delete();

        $response = $this->asAdmin()->getJson('/api/v1/admin/summary')->assertOk();

        $response->assertJsonPath('data.users_total', 2)   // admin + 1 siswa
            ->assertJsonPath('data.users_trashed', 1)
            ->assertJsonPath('data.mentors_total', 0);
    }

    public function test_create_admin_command_restores_deleted_account_and_keeps_single_role(): void
    {
        $lama = $this->userWithRole(Role::SISWA, ['email' => 'pulih@example.test']);
        $lama->delete();

        $this->artisan('lms:create-admin', ['--name' => 'Admin Pulih', '--email' => 'pulih@example.test'])
            ->expectsQuestion('Password (min. 12 karakter, tidak akan ditampilkan)', 'KataSandiKuat123')
            ->expectsQuestion('Ulangi password', 'KataSandiKuat123')
            ->assertSuccessful();

        $user = User::where('email', 'pulih@example.test')->firstOrFail();
        $this->assertSame(['admin'], $user->roles()->pluck('slug')->all(), 'Tidak boleh punya dua role.');
        $this->assertSame('Admin Pulih', $user->name);
        $this->assertSame(1, User::withTrashed()->where('email', 'pulih@example.test')->count());
    }

    private function fakeSession(User $user): void
    {
        DB::table('sessions')->insert([
            'id' => bin2hex(random_bytes(20)),
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'phpunit',
            'payload' => '',
            'last_activity' => time(),
        ]);
    }
}
