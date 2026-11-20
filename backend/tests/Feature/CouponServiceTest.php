<?php

namespace Tests\Feature;

use App\Exceptions\CouponException;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Course;
use App\Models\Role;
use App\Services\CouponService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\QueryException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Aturan kupon (model) dan layanan pemakaian yang akan dipanggil modul pembayaran. */
class CouponServiceTest extends TestCase
{
    use RefreshDatabase;

    private CouponService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->service = new CouponService;
    }

    private function redeemTimes(Coupon $coupon, int $times): void
    {
        for ($i = 0; $i < $times; $i++) {
            $this->service->redeem($coupon->code, $this->userWithRole(Role::SISWA), 100_000);
        }
    }

    // ------------------------------------------------------------------ model

    public function test_code_is_stored_uppercase_and_trimmed(): void
    {
        $coupon = Coupon::factory()->create(['code' => '  promo_utbk-1 ']);

        $this->assertSame('PROMO_UTBK-1', $coupon->fresh()->code);
    }

    public function test_code_is_unique_regardless_of_case(): void
    {
        Coupon::factory()->create(['code' => 'HEMAT10']);

        $this->expectException(QueryException::class);
        Coupon::factory()->create(['code' => 'hemat10']);
    }

    #[DataProvider('discountCases')]
    public function test_discount_calculation(string $type, int $value, int $amount, int $expected): void
    {
        $coupon = Coupon::factory()->make(['discount_type' => $type, 'discount_value' => $value]);

        $this->assertSame($expected, $coupon->discountFor($amount));
    }

    public static function discountCases(): array
    {
        return [
            'persen biasa' => ['percentage', 50, 200_000, 100_000],
            'persen dibulatkan ke bawah' => ['percentage', 10, 99_999, 9_999],
            'persen 100' => ['percentage', 100, 150_000, 150_000],
            'nominal tetap' => ['fixed', 50_000, 200_000, 50_000],
            'nominal melebihi harga dibatasi harga' => ['fixed', 500_000, 120_000, 120_000],
            'harga nol' => ['percentage', 50, 0, 0],
            'harga negatif' => ['fixed', 10_000, -5, 0],
        ];
    }

    public function test_labels(): void
    {
        $this->assertSame('50%', Coupon::factory()->make(['discount_type' => 'percentage', 'discount_value' => 50])->discountLabel());
        $this->assertSame('Rp 50.000', Coupon::factory()->make(['discount_type' => 'fixed', 'discount_value' => 50000])->discountLabel());
        $this->assertSame('Rp 1.250.000', Coupon::factory()->make(['discount_type' => 'fixed', 'discount_value' => 1250000])->discountLabel());
    }

    public function test_effective_status_precedence(): void
    {
        $this->assertSame('active', Coupon::factory()->create()->status());
        $this->assertSame('inactive', Coupon::factory()->inactive()->create()->status());
        $this->assertSame('expired', Coupon::factory()->expired()->create()->status());

        $exhausted = Coupon::factory()->limited(1)->create();
        $this->redeemTimes($exhausted, 1);
        $this->assertSame('exhausted', $exhausted->fresh()->status());

        // Nonaktif menang atas kedaluwarsa dan habis; kedaluwarsa menang atas habis.
        $both = Coupon::factory()->limited(1)->expired()->inactive()->create();
        $this->assertSame('inactive', $both->status());
        $expiredAndFull = Coupon::factory()->limited(1)->expired()->create();
        CouponRedemption::query()->insert(['coupon_id' => $expiredAndFull->id, 'user_id' => $this->userWithRole(Role::SISWA)->id, 'original_amount' => 1, 'discount_amount' => 1]);
        $this->assertSame('expired', $expiredAndFull->fresh()->status());
    }

    public function test_status_scope_agrees_with_the_status_method(): void
    {
        $active = Coupon::factory()->create(['code' => 'AKTIF']);
        $unlimitedUsed = Coupon::factory()->create(['code' => 'TANPABATAS']);
        $this->redeemTimes($unlimitedUsed, 3);
        $inactive = Coupon::factory()->inactive()->create(['code' => 'MATI']);
        $expired = Coupon::factory()->expired()->create(['code' => 'LEWAT']);
        $full = Coupon::factory()->limited(2)->create(['code' => 'PENUH']);
        $this->redeemTimes($full, 2);
        $room = Coupon::factory()->limited(5)->create(['code' => 'MASIHADA']);
        $this->redeemTimes($room, 2);

        foreach (Coupon::STATUSES as $status) {
            $viaScope = Coupon::query()->withStatus($status)->orderBy('code')->pluck('code')->all();
            $viaMethod = Coupon::query()->withCount('redemptions')->orderBy('code')->get()
                ->filter(fn (Coupon $c) => $c->status() === $status)->pluck('code')->values()->all();

            $this->assertSame($viaMethod, $viaScope, "Status {$status}: scope dan method harus sepakat.");
        }

        $this->assertSame(['AKTIF', 'MASIHADA', 'TANPABATAS'], Coupon::query()->withStatus('active')->orderBy('code')->pluck('code')->all());
        $this->assertSame(['PENUH'], Coupon::query()->withStatus('exhausted')->pluck('code')->all());
        $this->assertSame(['LEWAT'], Coupon::query()->withStatus('expired')->pluck('code')->all());
        $this->assertSame(['MATI'], Coupon::query()->withStatus('inactive')->pluck('code')->all());
    }

    // ------------------------------------------------------------------ evaluate

    public function test_evaluate_returns_the_discount_without_recording_usage(): void
    {
        Coupon::factory()->percentage(50)->create(['code' => 'HEMAT50']);

        $result = $this->service->evaluate('hemat50 ', 200_000); // huruf kecil dan spasi dinormalkan

        $this->assertSame(['original' => 200_000, 'discount' => 100_000, 'final' => 100_000], collect($result)->only(['original', 'discount', 'final'])->all());
        $this->assertSame(0, CouponRedemption::count());
    }

    #[DataProvider('unusableCases')]
    public function test_evaluate_rejects_unusable_coupons(string $state, string $reason, string $message): void
    {
        $factory = Coupon::factory();
        match ($state) {
            'inactive' => $factory = $factory->inactive(),
            'expired' => $factory = $factory->expired(),
            default => null,
        };
        $coupon = $factory->create(['code' => 'COBA']);

        if ($state === 'exhausted') {
            $coupon->update(['usage_limit' => 1]);
            $this->redeemTimes($coupon, 1);
        }
        if ($state === 'deleted') {
            $coupon->delete();
        }

        try {
            $this->service->evaluate($state === 'missing' ? 'TIDAKADA' : 'COBA', 100_000);
            $this->fail('Seharusnya ditolak.');
        } catch (CouponException $e) {
            $this->assertSame($reason, $e->reason);
            $this->assertSame($message, $e->getMessage());
        }
    }

    public static function unusableCases(): array
    {
        return [
            'tidak ditemukan' => ['missing', 'not_found', 'Kode kupon tidak ditemukan.'],
            'sudah dihapus' => ['deleted', 'not_found', 'Kode kupon tidak ditemukan.'],
            'nonaktif' => ['inactive', 'inactive', 'Kupon tidak aktif.'],
            'kedaluwarsa' => ['expired', 'expired', 'Kupon sudah kedaluwarsa.'],
            'kuota habis' => ['exhausted', 'exhausted', 'Kuota kupon sudah habis.'],
        ];
    }

    public function test_evaluate_rejects_invalid_amounts(): void
    {
        Coupon::factory()->create(['code' => 'COBA']);

        foreach ([0, -1] as $amount) {
            try {
                $this->service->evaluate('COBA', $amount);
                $this->fail('Seharusnya ditolak.');
            } catch (CouponException $e) {
                $this->assertSame('invalid_amount', $e->reason);
            }
        }
    }

    public function test_a_course_specific_coupon_only_works_for_that_course(): void
    {
        $course = Course::factory()->create();
        $other = Course::factory()->create();
        Coupon::factory()->create(['code' => 'KHUSUS', 'course_id' => $course->id]);

        $this->assertSame(90_000, $this->service->evaluate('KHUSUS', 100_000, $course->id)['final']); // diskon bawaan pabrik: 10%

        foreach ([$other->id, null] as $wrong) {
            try {
                $this->service->evaluate('KHUSUS', 100_000, $wrong);
                $this->fail('Seharusnya ditolak.');
            } catch (CouponException $e) {
                $this->assertSame('wrong_course', $e->reason);
            }
        }
    }

    public function test_a_general_coupon_works_for_any_course(): void
    {
        Coupon::factory()->create(['code' => 'UMUM']);

        $this->assertSame(90_000, $this->service->evaluate('UMUM', 100_000, Course::factory()->create()->id)['final']);
        $this->assertSame(90_000, $this->service->evaluate('UMUM', 100_000)['final']);
    }

    // ------------------------------------------------------------------ redeem

    public function test_redeem_records_the_usage_with_amounts(): void
    {
        $coupon = Coupon::factory()->fixed(25_000)->create(['code' => 'POTONG']);
        $user = $this->userWithRole(Role::SISWA);
        $course = Course::factory()->create();

        $redemption = $this->service->redeem('potong', $user, 80_000, $course->id, 'PAY-1');

        $this->assertSame($coupon->id, $redemption->coupon_id);
        $this->assertSame($user->id, $redemption->user_id);
        $this->assertSame($course->id, $redemption->course_id);
        $this->assertSame(80_000, $redemption->original_amount);
        $this->assertSame(25_000, $redemption->discount_amount);
        $this->assertSame('PAY-1', $redemption->reference);
        $this->assertSame(1, $coupon->fresh()->usedCount());
    }

    public function test_redeem_never_exceeds_the_usage_limit(): void
    {
        $coupon = Coupon::factory()->limited(2)->create(['code' => 'TERBATAS']);

        $this->redeemTimes($coupon, 2);

        try {
            $this->service->redeem('TERBATAS', $this->userWithRole(Role::SISWA), 100_000);
            $this->fail('Kuota seharusnya habis.');
        } catch (CouponException $e) {
            $this->assertSame('exhausted', $e->reason);
        }

        $this->assertSame(2, CouponRedemption::count());
    }

    public function test_redeem_is_idempotent_for_the_same_reference(): void
    {
        $coupon = Coupon::factory()->limited(1)->create(['code' => 'SEKALI']);
        $user = $this->userWithRole(Role::SISWA);

        $first = $this->service->redeem('SEKALI', $user, 100_000, null, 'PAY-77');
        $again = $this->service->redeem('SEKALI', $user, 100_000, null, 'PAY-77'); // pembayaran diulang: tidak menghabiskan kuota lagi

        $this->assertSame($first->id, $again->id);
        $this->assertSame(1, CouponRedemption::count());
        $this->assertSame('exhausted', $coupon->fresh()->status());
    }

    public function test_a_failed_redeem_writes_nothing(): void
    {
        Coupon::factory()->inactive()->create(['code' => 'MATI']);

        try {
            $this->service->redeem('MATI', $this->userWithRole(Role::SISWA), 100_000, null, 'PAY-9');
        } catch (CouponException) {
        }

        $this->assertSame(0, CouponRedemption::count());
    }

    public function test_total_usage_counts_real_redemptions(): void
    {
        $a = Coupon::factory()->create();
        $b = Coupon::factory()->create();
        $this->redeemTimes($a, 3);
        $this->redeemTimes($b, 2);

        $this->assertSame(5, CouponRedemption::count());
        $this->assertSame(3, $a->fresh()->usedCount());
    }
}
