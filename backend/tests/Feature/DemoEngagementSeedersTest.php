<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Level;
use App\Models\Role;
use App\Models\User;
use App\Models\XpBalance;
use App\Models\XpTransaction;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoCouponSeeder;
use Database\Seeders\DemoCourseSeeder;
use Database\Seeders\DemoGamificationSeeder;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoEngagementSeedersTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        config(['lms.demo_password' => 'KataSandiDemo123']);
        $this->admin = $this->userWithRole(Role::ADMIN);
    }

    private function seedUsers(): void
    {
        $this->seed(DemoUserSeeder::class);
    }

    // ------------------------------------------------------------------ kupon

    public function test_coupon_seeder_creates_every_status_and_real_usage(): void
    {
        $this->seedUsers();
        $this->seed(DemoCouponSeeder::class);

        $coupons = Coupon::query()->withCount('redemptions')->get();
        $this->assertCount(8, $coupons);
        $this->assertEqualsCanonicalizing(['active', 'inactive', 'expired', 'exhausted'], $coupons->map->status()->unique()->values()->all());
        $this->assertGreaterThan(0, CouponRedemption::count());

        $admin = $this->actingAs($this->admin, 'web')->getJson('/api/v1/coupons?per_page=50')->assertOk();
        $this->assertSame(8, $admin->json('summary.total'));
        $this->assertSame(CouponRedemption::count(), $admin->json('summary.total_redemptions'));
        $this->assertTrue($coupons->every(fn (Coupon $c) => $c->owner_type === 'admin'));
    }

    public function test_coupon_seeder_is_idempotent(): void
    {
        $this->seedUsers();
        $this->seed(DemoCouponSeeder::class);
        $counts = fn () => [Coupon::withTrashed()->count(), CouponRedemption::count()];
        $before = $counts();

        $this->seed(DemoCouponSeeder::class);
        $this->seed(DemoCouponSeeder::class);

        $this->assertSame($before, $counts());
    }

    public function test_coupon_seeder_repairs_changes_and_restores_deleted_demo_coupons(): void
    {
        $this->seedUsers();
        $this->seed(DemoCouponSeeder::class);
        $coupon = Coupon::where('code', 'DEMO_SPECIAL_50')->firstOrFail();
        $coupon->update(['is_active' => false, 'discount_value' => 5]);
        Coupon::where('code', 'DEMOMATI')->firstOrFail()->delete();

        $this->seed(DemoCouponSeeder::class);

        $this->assertTrue($coupon->fresh()->is_active);
        $this->assertSame(50, $coupon->fresh()->discount_value);
        $this->assertNotNull(Coupon::where('code', 'DEMOMATI')->first(), 'Kupon demo yang terhapus dipulihkan.');
    }

    public function test_coupon_seeder_works_without_demo_students_but_makes_no_usage(): void
    {
        $this->artisan('db:seed', ['--class' => DemoCouponSeeder::class])->assertSuccessful();

        $this->assertSame(8, Coupon::count());
        $this->assertSame(0, CouponRedemption::count());
    }

    public function test_coupon_seeder_ties_a_coupon_to_a_demo_course_when_available(): void
    {
        $this->seedUsers();
        $this->seed(DemoCourseSeeder::class);
        $this->seed(DemoCouponSeeder::class);

        $this->assertNotNull(Coupon::where('code', 'DEMOUTBK10')->firstOrFail()->course_id);
    }

    public function test_coupon_seeder_refuses_outside_local(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--class' => DemoCouponSeeder::class, '--force' => true])
            ->expectsOutputToContain('hanya boleh dijalankan di lingkungan local')->assertSuccessful();

        $this->assertSame(0, Coupon::count());
    }

    // ------------------------------------------------------------------ gamifikasi

    public function test_gamification_seeder_creates_levels_and_xp_with_ties_and_zeros(): void
    {
        $this->seedUsers();
        $this->seed(DemoGamificationSeeder::class);

        $this->assertSame(['Pemula', 'Menengah', 'Mahir', 'Ahli'], Level::orderBy('min_xp')->pluck('name')->all());

        $rows = collect($this->actingAs($this->admin, 'web')->getJson('/api/v1/gamification/leaderboard?per_page=100')->assertOk()->json('data'));
        $ranks = $rows->take(10)->pluck('rank')->all();
        $this->assertSame([1, 2, 2, 4, 5, 5, 7, 8, 9], array_slice($ranks, 0, 9), 'Skor kembar berbagi peringkat.');
        $this->assertSame('Ahli', $rows->first()['level']['name']);
        $this->assertEqualsCanonicalizing(['Ahli', 'Mahir', 'Menengah', 'Pemula'], $rows->take(10)->pluck('level.name')->unique()->values()->all(), 'Keempat level contoh tampil.');
        $this->assertGreaterThan(0, $rows->where('xp', 0)->count());
    }

    public function test_gamification_seeder_keeps_balances_equal_to_the_ledger(): void
    {
        $this->seedUsers();
        $this->seed(DemoGamificationSeeder::class);

        foreach (XpBalance::all() as $balance) {
            $this->assertSame((int) XpTransaction::where('user_id', $balance->user_id)->sum('amount'), $balance->total_xp);
        }
    }

    public function test_gamification_seeder_is_idempotent(): void
    {
        $this->seedUsers();
        $this->seed(DemoGamificationSeeder::class);
        $counts = fn () => [Level::count(), XpTransaction::count(), (int) XpBalance::sum('total_xp')];
        $before = $counts();

        $this->seed(DemoGamificationSeeder::class);
        $this->seed(DemoGamificationSeeder::class);

        $this->assertSame($before, $counts());
    }

    public function test_gamification_seeder_never_overrides_real_levels(): void
    {
        $this->seedUsers();
        Level::create(['name' => 'Level Resmi', 'min_xp' => 100]);

        $this->seed(DemoGamificationSeeder::class);

        $this->assertSame(['Level Resmi'], Level::pluck('name')->all(), 'Level yang sudah diatur Admin tidak diubah dan tidak ditambah.');
        $this->assertGreaterThan(0, XpTransaction::count(), 'XP contoh tetap dibuat.');
    }

    public function test_gamification_seeder_needs_admin_and_students(): void
    {
        $this->artisan('db:seed', ['--class' => DemoGamificationSeeder::class])
            ->expectsOutputToContain('Butuh Admin dan Siswa demo')->assertSuccessful();

        $this->assertSame(0, Level::count());
        $this->assertSame(0, XpTransaction::count());
    }

    public function test_gamification_seeder_refuses_outside_local(): void
    {
        $this->seedUsers();
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--class' => DemoGamificationSeeder::class, '--force' => true])
            ->expectsOutputToContain('hanya boleh dijalankan di lingkungan local')->assertSuccessful();

        $this->assertSame(0, Level::count());
        $this->assertSame(0, XpTransaction::count());
    }

    public function test_the_default_seed_creates_no_demo_engagement_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Coupon::count());
        $this->assertSame(0, Level::count());
        $this->assertSame(0, XpTransaction::count());
    }
}
