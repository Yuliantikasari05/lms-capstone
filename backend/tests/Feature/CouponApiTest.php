<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Course;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CouponApiTest extends TestCase
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

    private function use(Coupon $coupon, int $times = 1): void
    {
        for ($i = 0; $i < $times; $i++) {
            $r = new CouponRedemption(['original_amount' => 100000, 'discount_amount' => 10000]);
            $r->coupon_id = $coupon->id;
            $r->user_id = $this->userWithRole(Role::SISWA)->id;
            $r->save();
        }
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    private function payload(array $overrides = []): array
    {
        return array_merge(['code' => 'HEMAT50', 'discount_type' => 'percentage', 'discount_value' => 50, 'usage_limit' => 1000], $overrides);
    }

    // ------------------------------------------------------------------ daftar dan ringkasan

    public function test_list_matches_the_design_columns(): void
    {
        $coupon = Coupon::factory()->fixed(50000)->limited(1000)->create(['code' => 'KAMISHEMAT', 'name' => 'Promo Kamis']);
        $this->use($coupon, 3);

        $this->asAdmin()->getJson('/api/v1/coupons')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'KAMISHEMAT')
            ->assertJsonPath('data.0.name', 'Promo Kamis')
            ->assertJsonPath('data.0.discount_type', 'fixed')
            ->assertJsonPath('data.0.discount_type_label', 'Nominal Tetap (Rp)')
            ->assertJsonPath('data.0.discount_label', 'Rp 50.000')
            ->assertJsonPath('data.0.usage_limit', 1000)
            ->assertJsonPath('data.0.used_count', 3)
            ->assertJsonPath('data.0.usage_label', '3/1000')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.status_label', 'Aktif')
            ->assertJsonPath('data.0.abilities.update', true)
            ->assertJsonPath('data.0.abilities.delete', true);
    }

    public function test_unlimited_coupons_show_an_infinity_label(): void
    {
        Coupon::factory()->percentage(10)->create();

        $this->asAdmin()->getJson('/api/v1/coupons')->assertOk()
            ->assertJsonPath('data.0.usage_limit', null)
            ->assertJsonPath('data.0.usage_label', '0/∞')
            ->assertJsonPath('data.0.discount_label', '10%');
    }

    public function test_summary_cards_count_all_coupons_active_ones_and_real_usage(): void
    {
        $a = Coupon::factory()->create();
        $b = Coupon::factory()->create();
        Coupon::factory()->inactive()->create();
        Coupon::factory()->expired()->create();
        Coupon::factory()->institution()->create();   // voucher Lembaga tidak dihitung
        Coupon::factory()->create()->delete();         // yang sudah dihapus tidak dihitung
        $this->use($a, 2);
        $this->use($b, 1);

        $this->asAdmin()->getJson('/api/v1/coupons')->assertOk()
            ->assertJsonPath('summary.total', 4)
            ->assertJsonPath('summary.active', 2)
            ->assertJsonPath('summary.total_redemptions', 3);
    }

    public function test_summary_ignores_the_search_filter(): void
    {
        Coupon::factory()->create(['code' => 'SATU']);
        Coupon::factory()->create(['code' => 'DUA']);

        $this->asAdmin()->getJson('/api/v1/coupons?q=satu')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('summary.total', 2);
    }

    public function test_list_excludes_institution_vouchers_and_deleted_coupons_and_orders_newest_first(): void
    {
        Coupon::factory()->create(['code' => 'LAMA', 'created_at' => now()->subDays(2)]);
        Coupon::factory()->create(['code' => 'BARU', 'created_at' => now()]);
        Coupon::factory()->institution()->create(['code' => 'VOUCHERLEMBAGA']);
        Coupon::factory()->create(['code' => 'DIHAPUS'])->delete();

        $codes = collect($this->asAdmin()->getJson('/api/v1/coupons')->assertOk()->json('data'))->pluck('code')->all();

        $this->assertSame(['BARU', 'LAMA'], $codes);
    }

    public function test_search_by_code_or_name_and_wildcards_are_plain_text(): void
    {
        Coupon::factory()->create(['code' => 'QR_SPECIAL_50']);
        Coupon::factory()->create(['code' => 'UTBK10', 'name' => 'Promo Harga Kelas Materi UTBK']);
        Coupon::factory()->create(['code' => 'DISKON50', 'name' => 'Diskon 50% Akhir Tahun']);

        $codes = fn (string $q) => collect($this->asAdmin()->getJson('/api/v1/coupons?q='.urlencode($q))->assertOk()->json('data'))->pluck('code')->sort()->values()->all();

        $this->assertSame(['QR_SPECIAL_50'], $codes('qr_special'), 'Tidak peka huruf besar-kecil.');
        $this->assertSame(['UTBK10'], $codes('materi utbk'), 'Pencarian juga mencakup nama.');
        $this->assertSame(['DISKON50'], $codes('%'), '% hanya cocok sebagai teks literal.');
        $this->assertSame([], $codes('_'.'zzz'));
    }

    public function test_filter_by_each_effective_status(): void
    {
        Coupon::factory()->create(['code' => 'AKTIF']);
        Coupon::factory()->inactive()->create(['code' => 'MATI']);
        Coupon::factory()->expired()->create(['code' => 'LEWAT']);
        $full = Coupon::factory()->limited(1)->create(['code' => 'PENUH']);
        $this->use($full);

        foreach (['active' => 'AKTIF', 'inactive' => 'MATI', 'expired' => 'LEWAT', 'exhausted' => 'PENUH'] as $status => $code) {
            $codes = collect($this->asAdmin()->getJson("/api/v1/coupons?status={$status}")->assertOk()->json('data'))->pluck('code')->all();
            $this->assertSame([$code], $codes, "Filter {$status}");
        }
    }

    public function test_filter_by_course_and_validate_params(): void
    {
        $course = Course::factory()->create(['title' => 'Kelas UTBK']);
        Coupon::factory()->create(['code' => 'KHUSUS', 'course_id' => $course->id]);
        Coupon::factory()->create(['code' => 'UMUM']);

        $this->asAdmin()->getJson('/api/v1/coupons?course_id='.$course->id)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.course.title', 'Kelas UTBK');

        $this->asAdmin()->getJson('/api/v1/coupons?status=ngawur')->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->asAdmin()->getJson('/api/v1/coupons?per_page=1000')->assertStatus(422)->assertJsonValidationErrors(['per_page']);
    }

    public function test_pagination(): void
    {
        Coupon::factory()->count(5)->create();

        $this->asAdmin()->getJson('/api/v1/coupons?per_page=2&page=3')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 5)->assertJsonPath('meta.last_page', 3);
    }

    // ------------------------------------------------------------------ tambah

    public function test_create_normalizes_the_code_and_records_owner_and_audit(): void
    {
        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload(['code' => '  hemat50 ', 'name' => 'Promo']))
            ->assertCreated()
            ->assertJsonPath('message', 'Kupon berhasil dibuat.')
            ->assertJsonPath('data.code', 'HEMAT50')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.used_count', 0)
            ->assertJsonPath('data.status', 'active');

        $coupon = Coupon::firstOrFail();
        $this->assertSame('admin', $coupon->owner_type);
        $this->assertSame($this->admin->id, $coupon->created_by);

        $log = $this->lastLog('coupon.created');
        $this->assertSame('HEMAT50', $log->target_label);
        $this->assertSame('coupon', $log->target_type);
        $this->assertSame('HEMAT50', $log->changes['after']['code']);
    }

    public function test_create_supports_course_scope_expiry_and_inactive_start(): void
    {
        $course = Course::factory()->create();
        $expires = now()->addMonth()->startOfDay();

        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload([
            'course_id' => $course->id, 'expires_at' => $expires->toIso8601String(), 'is_active' => false, 'usage_limit' => null,
        ]))->assertCreated()
            ->assertJsonPath('data.course.id', $course->id)
            ->assertJsonPath('data.status', 'inactive')
            ->assertJsonPath('data.usage_limit', null);
    }

    public function test_create_validates_input(): void
    {
        $post = fn (array $o) => $this->asAdmin()->postJson('/api/v1/coupons', $this->payload($o));

        $this->asAdmin()->postJson('/api/v1/coupons', [])->assertStatus(422)->assertJsonValidationErrors(['code', 'discount_type', 'discount_value']);
        $post(['code' => 'AB'])->assertStatus(422)->assertJsonValidationErrors(['code']);                 // terlalu pendek
        $post(['code' => str_repeat('A', 31)])->assertStatus(422)->assertJsonValidationErrors(['code']);  // terlalu panjang
        $post(['code' => 'ADA SPASI'])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $post(['code' => 'TANDA!'])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $post(['discount_type' => 'ngawur'])->assertStatus(422)->assertJsonValidationErrors(['discount_type']);
        $post(['discount_value' => 0])->assertStatus(422)->assertJsonValidationErrors(['discount_value']);
        $post(['discount_value' => 101])->assertStatus(422)->assertJsonValidationErrors(['discount_value']);   // persen maks 100
        $post(['discount_value' => 12.5])->assertStatus(422)->assertJsonValidationErrors(['discount_value']);
        $post(['usage_limit' => 0])->assertStatus(422)->assertJsonValidationErrors(['usage_limit']);
        $post(['expires_at' => now()->subDay()->toIso8601String()])->assertStatus(422)->assertJsonValidationErrors(['expires_at']);
        $post(['course_id' => 999999])->assertStatus(422)->assertJsonValidationErrors(['course_id']);

        $this->assertSame(0, Coupon::count());
        $this->assertSame(0, AuditLog::where('action', 'coupon.created')->count());
    }

    public function test_a_fixed_discount_may_exceed_one_hundred(): void
    {
        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload(['discount_type' => 'fixed', 'discount_value' => 250000]))
            ->assertCreated()->assertJsonPath('data.discount_label', 'Rp 250.000');
    }

    public function test_duplicate_codes_are_rejected_case_insensitively_even_for_deleted_coupons(): void
    {
        Coupon::factory()->create(['code' => 'KODEBARU']);
        Coupon::factory()->create(['code' => 'DIHAPUS'])->delete();

        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload(['code' => 'kodebaru']))->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload(['code' => 'dihapus']))->assertStatus(422)->assertJsonValidationErrors(['code']);
    }

    public function test_a_deleted_course_cannot_be_used_as_scope(): void
    {
        $course = Course::factory()->create();
        $course->delete();

        $this->asAdmin()->postJson('/api/v1/coupons', $this->payload(['course_id' => $course->id]))
            ->assertStatus(422)->assertJsonValidationErrors(['course_id']);
    }

    // ------------------------------------------------------------------ detail

    public function test_show_and_404(): void
    {
        $coupon = Coupon::factory()->create(['code' => 'DETAIL']);

        $this->asAdmin()->getJson('/api/v1/coupons/'.$coupon->id)->assertOk()->assertJsonPath('data.code', 'DETAIL');
        $this->asAdmin()->getJson('/api/v1/coupons/999999')->assertNotFound();

        $coupon->delete();
        $this->asAdmin()->getJson('/api/v1/coupons/'.$coupon->id)->assertNotFound();
    }

    public function test_admin_cannot_view_or_change_institution_vouchers_through_this_menu(): void
    {
        $voucher = Coupon::factory()->institution()->create(['code' => 'VOUCHERLEMBAGA']);

        $this->asAdmin()->getJson('/api/v1/coupons/'.$voucher->id)->assertForbidden()->assertJsonPath('message', 'Voucher Lembaga dikelola oleh lembaganya.');
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$voucher->id, ['name' => 'Diubah'])->assertForbidden();
        $this->asAdmin()->deleteJson('/api/v1/coupons/'.$voucher->id)->assertForbidden();

        $this->assertNull($voucher->fresh()->name);
        $this->assertNotSoftDeleted($voucher);
    }

    // ------------------------------------------------------------------ ubah

    public function test_update_changes_fields_and_logs_only_what_changed(): void
    {
        $coupon = Coupon::factory()->percentage(10)->create(['code' => 'UBAHDONG', 'name' => 'Lama']);

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['name' => 'Baru', 'discount_value' => 25, 'code' => 'UBAHDONG'])
            ->assertOk()->assertJsonPath('message', 'Kupon berhasil diperbarui.')
            ->assertJsonPath('data.name', 'Baru')->assertJsonPath('data.discount_label', '25%');

        $log = $this->lastLog('coupon.updated');
        $this->assertSame(['name' => 'Lama', 'discount_value' => 10], $log->changes['before']);
        $this->assertSame(['name' => 'Baru', 'discount_value' => 25], $log->changes['after']);
    }

    public function test_update_that_changes_nothing_writes_no_log(): void
    {
        $coupon = Coupon::factory()->create(['name' => 'Sama']);

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['name' => 'Sama'])->assertOk();

        $this->assertSame(0, AuditLog::where('action', 'coupon.updated')->count());
    }

    public function test_deactivating_and_reactivating(): void
    {
        $coupon = Coupon::factory()->create();

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['is_active' => false])->assertOk()->assertJsonPath('data.status', 'inactive');
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['is_active' => true])->assertOk()->assertJsonPath('data.status', 'active');
    }

    public function test_an_expired_coupon_can_be_revived_by_moving_the_date(): void
    {
        $coupon = Coupon::factory()->expired()->create();

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['expires_at' => now()->addMonth()->toIso8601String()])
            ->assertOk()->assertJsonPath('data.status', 'active');
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['expires_at' => now()->subDay()->toIso8601String()])
            ->assertOk()->assertJsonPath('data.status', 'expired'); // tanggal lampau diizinkan saat mengubah
    }

    public function test_the_code_cannot_change_once_the_coupon_was_used(): void
    {
        $used = Coupon::factory()->create(['code' => 'DIPAKAI']);
        $fresh = Coupon::factory()->create(['code' => 'BELUMDIPAKAI']);
        $this->use($used);

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$used->id, ['code' => 'KODEBARU'])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$fresh->id, ['code' => 'KODEBARU'])->assertOk()->assertJsonPath('data.code', 'KODEBARU');
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$used->id, ['code' => 'dipakai'])->assertOk(); // kode yang sama (beda huruf) boleh
    }

    public function test_usage_limit_cannot_drop_below_the_current_usage(): void
    {
        $coupon = Coupon::factory()->limited(10)->create();
        $this->use($coupon, 3);

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['usage_limit' => 2])
            ->assertStatus(422)->assertJsonValidationErrors(['usage_limit']);
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['usage_limit' => 3])->assertOk()->assertJsonPath('data.status', 'exhausted');
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['usage_limit' => null])->assertOk()->assertJsonPath('data.status', 'active');
    }

    public function test_update_uses_the_existing_type_to_validate_the_value(): void
    {
        $percent = Coupon::factory()->percentage(10)->create();

        $this->asAdmin()->patchJson('/api/v1/coupons/'.$percent->id, ['discount_value' => 150])->assertStatus(422)->assertJsonValidationErrors(['discount_value']);
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$percent->id, ['discount_type' => 'fixed', 'discount_value' => 150000])->assertOk();
    }

    // ------------------------------------------------------------------ hapus

    public function test_an_unused_coupon_is_soft_deleted_and_logged(): void
    {
        $coupon = Coupon::factory()->create(['code' => 'HAPUSAJA']);

        $this->asAdmin()->deleteJson('/api/v1/coupons/'.$coupon->id)->assertOk()->assertJsonPath('message', 'Kupon berhasil dihapus.');

        $this->assertSoftDeleted($coupon);
        $this->assertSame('HAPUSAJA', $this->lastLog('coupon.deleted')->target_label);
    }

    public function test_a_used_coupon_cannot_be_deleted_only_deactivated(): void
    {
        $coupon = Coupon::factory()->create();
        $this->use($coupon);

        $this->asAdmin()->deleteJson('/api/v1/coupons/'.$coupon->id)->assertStatus(422)->assertJsonValidationErrors(['coupon']);

        $this->assertNotSoftDeleted($coupon);
        $this->assertSame(0, AuditLog::where('action', 'coupon.deleted')->count());
        $this->asAdmin()->patchJson('/api/v1/coupons/'.$coupon->id, ['is_active' => false])->assertOk();
    }

    // ------------------------------------------------------------------ otorisasi

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_rejected_everywhere(string $role): void
    {
        $actor = $this->userWithRole($role);
        $coupon = Coupon::factory()->create();

        $this->as($actor)->getJson('/api/v1/coupons')->assertForbidden();
        $this->as($actor)->getJson('/api/v1/coupons/'.$coupon->id)->assertForbidden();
        $this->as($actor)->postJson('/api/v1/coupons', $this->payload())->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/coupons/'.$coupon->id, ['name' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/coupons/'.$coupon->id)->assertForbidden();

        $this->assertSame(1, Coupon::count());
        $this->assertNull($coupon->fresh()->name);
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/coupons')->assertUnauthorized();
        $this->postJson('/api/v1/coupons', [])->assertUnauthorized();
    }

    public function test_coupon_permissions_belong_to_admin_only(): void
    {
        $slugs = ['coupons.view', 'coupons.create', 'coupons.update', 'coupons.delete'];

        $admin = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug');
        foreach ($slugs as $slug) {
            $this->assertTrue($admin->contains($slug), "Admin harus punya {$slug}.");
            $this->assertNotNull(Permission::where('slug', $slug)->first());
        }
        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN, Role::LEMBAGA] as $role) {
            $permissions = Role::where('slug', $role)->firstOrFail()->permissions->pluck('slug');
            foreach ($slugs as $slug) {
                $this->assertFalse($permissions->contains($slug), "{$role} tidak boleh punya {$slug}.");
            }
        }
    }
}
