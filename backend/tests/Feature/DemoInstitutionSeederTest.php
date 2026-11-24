<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use Database\Seeders\DemoInstitutionSeeder;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DemoInstitutionSeederTest extends TestCase
{
    use RefreshDatabase;

    private function prepare(bool $withAdmin = true): ?User
    {
        $this->seedRbac();
        $this->seed(DemoUserSeeder::class);

        return $withAdmin ? $this->userWithRole(Role::ADMIN) : null;
    }

    public function test_it_creates_institutions_programs_sales_vouchers_and_payouts(): void
    {
        $this->prepare();

        $this->seed(DemoInstitutionSeeder::class);

        $this->assertSame(3, Institution::count());
        $byName = Institution::with('user')->get()->keyBy('name');
        $this->assertSame(80, $byName['Bimbel Cerdas Mandiri']->revenue_share_percent);
        $this->assertSame('bimbel.cerdas@demo.test', $byName['Bimbel Cerdas Mandiri']->user->email);
        $this->assertSame('suspended', $byName['Bimbel Nusantara']->user->status);
        $this->assertSame('8830127810', $byName['Bimbel Cerdas Mandiri']->bank_account_number);
        $this->assertFalse($byName['Bimbel Nusantara']->hasBankAccount());

        $this->assertSame(6, Course::where('type', Course::TYPE_INSTITUTION)->count());
        $this->assertSame(6, Course::where('type', Course::TYPE_INSTITUTION)->where('status', 'active')->count());
        $this->assertGreaterThan(0, Enrollment::where('source', 'purchase')->count());
        $this->assertSame(Enrollment::where('source', 'purchase')->count(), Transaction::count());
        $this->assertSame(3, Coupon::where('owner_type', Coupon::OWNER_INSTITUTION)->count());

        foreach (Transaction::all() as $sale) {
            $this->assertSame($sale->net_amount, $sale->institution_amount + $sale->platform_amount);
        }

        // Pencairan hanya untuk lembaga yang punya rekening dan saldo.
        $this->assertGreaterThanOrEqual(1, InstitutionPayout::where('status', 'completed')->count());
        $this->assertGreaterThanOrEqual(1, InstitutionPayout::where('status', 'pending')->count());
        $this->assertSame(0, InstitutionPayout::where('institution_id', $byName['Bimbel Nusantara']->id)->count());
    }

    public function test_the_demo_data_fills_the_admin_dashboard_through_the_api(): void
    {
        $admin = $this->prepare();
        $this->seed(DemoInstitutionSeeder::class);
        $institution = Institution::where('name', 'Bimbel Cerdas Mandiri')->firstOrFail();

        $response = $this->actingAs($admin, 'web')->getJson('/api/v1/institutions/'.$institution->id.'/dashboard?period=1y')->assertOk();

        $this->assertGreaterThan(0, $response->json('data.cards.total_revenue.value'));
        $this->assertGreaterThan(0, $response->json('data.cards.active_students.value'));
        $this->assertSame(3, $response->json('data.cards.active_programs.value'));
        $this->assertSame(2, $response->json('data.active_vouchers.total'));
        $this->assertNotEmpty($response->json('data.top_programs'));
        $this->assertCount(2, $response->json('data.recent_payouts'));
        $this->assertGreaterThan(0, collect($response->json('data.revenue_chart.points'))->sum('institution_amount'));
        $this->assertGreaterThan(0, $response->json('data.finance.available_balance'));
    }

    public function test_it_can_be_repeated_without_duplicating_anything(): void
    {
        $this->prepare();

        $this->seed(DemoInstitutionSeeder::class);
        $counts = [Institution::count(), Course::count(), Enrollment::count(), Transaction::count(), Coupon::count(), InstitutionPayout::count()];
        $this->seed(DemoInstitutionSeeder::class);

        $this->assertSame($counts, [Institution::count(), Course::count(), Enrollment::count(), Transaction::count(), Coupon::count(), InstitutionPayout::count()]);
    }

    public function test_it_adopts_profiles_created_by_the_migration_backfill(): void
    {
        $this->prepare();
        $account = User::where('email', 'bimbel.cerdas@demo.test')->firstOrFail();
        Institution::factory()->forUser($account)->share(null)->create(['name' => 'Nama Lama']);

        $this->seed(DemoInstitutionSeeder::class);

        $this->assertSame(1, Institution::where('user_id', $account->id)->count());
        $this->assertSame('Bimbel Cerdas Mandiri', Institution::where('user_id', $account->id)->value('name'));
        $this->assertSame(80, Institution::where('user_id', $account->id)->value('revenue_share_percent'));
    }

    public function test_without_an_admin_it_still_seeds_everything_except_payouts(): void
    {
        $this->prepare(false);

        $this->seed(DemoInstitutionSeeder::class);

        $this->assertSame(3, Institution::count());
        $this->assertGreaterThan(0, Transaction::count());
        $this->assertSame(0, InstitutionPayout::count());
    }

    public function test_it_is_cancelled_without_demo_users(): void
    {
        $this->seedRbac();

        $this->seed(DemoInstitutionSeeder::class);

        $this->assertSame(0, Institution::count());
    }

    public function test_it_refuses_to_run_outside_local(): void
    {
        $this->prepare();
        $this->app['env'] = 'production';

        // Dipanggil langsung: `db:seed` di production meminta konfirmasi interaktif sebelum seeder berjalan.
        (new DemoInstitutionSeeder)->run();

        $this->assertSame(0, Institution::count());
    }
}
