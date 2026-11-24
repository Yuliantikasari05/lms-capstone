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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Halaman detail "Manajemen Lembaga Bimbingan": kartu, grafik, keuangan, program terlaris, voucher. */
class InstitutionDashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Institution $institution;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->travelTo(now()->setDate(2026, 11, 23)->setTime(10, 0)); // Senin
        $this->admin = $this->userWithRole(Role::ADMIN);
        $this->institution = Institution::factory()->withBank()->share(80)->create(['name' => 'Bimbel CN']);
    }

    private function dashboard(string $query = ''): \Illuminate\Testing\TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->admin, 'web')->getJson('/api/v1/institutions/'.$this->institution->id.'/dashboard'.$query);
    }

    private function sale(int $net, string $when, ?Course $course = null, ?Institution $institution = null): Transaction
    {
        return Transaction::factory()->amount($net)->paidAt($when)->create([
            'institution_id' => ($institution ?? $this->institution)->id,
            'course_id' => $course?->id,
        ]);
    }

    private function program(string $title, string $status = 'active', ?Institution $institution = null): Course
    {
        return Course::factory()->institution(($institution ?? $this->institution)->user)->create(['title' => $title, 'status' => $status]);
    }

    public function test_an_institution_without_data_returns_zeros_and_empty_lists(): void
    {
        $this->dashboard()->assertOk()
            ->assertJsonPath('data.period.key', '3m')
            ->assertJsonPath('data.cards.total_revenue.value', 0)
            ->assertJsonPath('data.cards.total_revenue.change_percent', null)
            ->assertJsonPath('data.cards.content_sold.value', 0)
            ->assertJsonPath('data.cards.active_students.value', 0)
            ->assertJsonPath('data.cards.active_programs.value', 0)
            ->assertJsonPath('data.cards.available_balance.value', 0)
            ->assertJsonPath('data.finance.gross_total', 0)
            ->assertJsonPath('data.finance.can_request_payout', false)
            ->assertJsonPath('data.top_programs', [])
            ->assertJsonPath('data.student_progress', [])
            ->assertJsonPath('data.active_vouchers.total', 0)
            ->assertJsonPath('data.active_vouchers.items', [])
            ->assertJsonPath('data.recent_payouts', [])
            ->assertJsonPath('institution.name', 'Bimbel CN');
    }

    public function test_cards_sum_only_paid_sales_of_this_institution_inside_the_period(): void
    {
        $this->sale(100_000, '2026-11-10'); // lembaga 80.000
        $this->sale(200_000, '2026-10-01'); // lembaga 160.000
        $this->sale(500_000, '2026-01-01'); // di luar 3 bulan
        Transaction::factory()->amount(900_000)->refunded()->paidAt('2026-11-01')->create(['institution_id' => $this->institution->id]);
        $this->sale(700_000, '2026-11-05', null, Institution::factory()->create());

        $this->dashboard('?period=3m')->assertOk()
            ->assertJsonPath('data.cards.total_revenue.value', 240_000)
            ->assertJsonPath('data.cards.content_sold.value', 2)
            ->assertJsonPath('data.revenue_split.institution_amount', 240_000)
            ->assertJsonPath('data.revenue_split.platform_amount', 60_000)
            ->assertJsonPath('data.revenue_split.institution_percent', 80)
            ->assertJsonPath('data.revenue_split.platform_percent', 20);
    }

    public function test_the_change_percent_compares_with_the_previous_equal_period(): void
    {
        $this->sale(300_000, '2026-11-10'); // 240.000 di periode ini
        $this->sale(120_000, '2026-07-01'); // 96.000 di periode sebelumnya (24 Mei sampai 23 Agu)

        $this->dashboard('?period=3m')->assertOk()
            ->assertJsonPath('data.cards.total_revenue.value', 240_000)
            ->assertJsonPath('data.cards.total_revenue.previous', 96_000)
            ->assertJsonPath('data.cards.total_revenue.change_percent', 150);
    }

    public function test_the_change_percent_can_be_negative_and_is_null_without_a_baseline(): void
    {
        $this->sale(100_000, '2026-11-20');   // 80.000 pada 7 hari terakhir
        $this->sale(500_000, '2026-11-12');   // 400.000 pada 7 hari sebelumnya (10 sampai 16 Nov)

        $this->dashboard('?period=7d')->assertOk()
            ->assertJsonPath('data.cards.total_revenue.value', 80_000)
            ->assertJsonPath('data.cards.total_revenue.previous', 400_000)
            ->assertJsonPath('data.cards.total_revenue.change_percent', -80);

        $this->dashboard('?period=30d')->assertOk()->assertJsonPath('data.cards.total_revenue.change_percent', null);
    }

    public function test_each_period_has_the_expected_chart_buckets_filled_with_zeros(): void
    {
        $counts = ['7d' => [7, 'day'], '30d' => [30, 'day'], '3m' => [14, 'week'], '6m' => [7, 'month'], '1y' => [13, 'month']];

        foreach ($counts as $period => [$count, $bucket]) {
            $this->dashboard('?period='.$period)->assertOk()
                ->assertJsonPath('data.revenue_chart.bucket', $bucket)
                ->assertJsonCount($count, 'data.revenue_chart.points')
                ->assertJsonPath('data.period.label', ['7d' => '7 hari', '30d' => '30 hari', '3m' => '3 bulan', '6m' => '6 bulan', '1y' => '1 tahun'][$period]);
        }
    }

    public function test_chart_points_carry_the_institution_and_platform_amounts(): void
    {
        $this->sale(100_000, '2026-11-20 08:00');
        $this->sale(50_000, '2026-11-20 20:00');
        $this->sale(100_000, '2026-11-22');

        $points = collect($this->dashboard('?period=7d')->assertOk()->json('data.revenue_chart.points'))->keyBy('key');

        $this->assertSame(120_000, $points['2026-11-20']['institution_amount']);
        $this->assertSame(30_000, $points['2026-11-20']['platform_amount']);
        $this->assertSame('20 Nov', $points['2026-11-20']['label']);
        $this->assertSame(80_000, $points['2026-11-22']['institution_amount']);
        $this->assertSame(0, $points['2026-11-21']['institution_amount']);
        $this->assertSame(200_000, (int) $points->sum('institution_amount'));
    }

    public function test_monthly_buckets_are_labelled_with_month_and_year(): void
    {
        $this->sale(100_000, '2026-10-15');

        $points = collect($this->dashboard('?period=6m')->assertOk()->json('data.revenue_chart.points'))->keyBy('key');

        $this->assertSame('Okt 2026', $points['2026-10']['label']);
        $this->assertSame(80_000, $points['2026-10']['institution_amount']);
        $this->assertSame('Nov 2026', $points['2026-11']['label']);
    }

    public function test_finance_panel_uses_all_time_totals_and_flags_when_a_payout_is_possible(): void
    {
        $this->sale(1_000_000, '2026-01-10'); // di luar 3 bulan, tetap dihitung di keuangan
        $this->sale(500_000, '2026-11-10');
        InstitutionPayout::create(['code' => 'PO-1', 'amount' => 300_000, 'status' => 'completed', 'institution_id' => $this->institution->id]);
        InstitutionPayout::create(['code' => 'PO-2', 'amount' => 100_000, 'status' => 'pending', 'institution_id' => $this->institution->id]);

        $this->dashboard()->assertOk()
            ->assertJsonPath('data.finance.gross_total', 1_500_000)
            ->assertJsonPath('data.finance.institution_total', 1_200_000)
            ->assertJsonPath('data.finance.platform_total', 300_000)
            ->assertJsonPath('data.finance.paid_out_total', 300_000)
            ->assertJsonPath('data.finance.pending_payout_total', 100_000)
            ->assertJsonPath('data.finance.available_balance', 800_000)
            ->assertJsonPath('data.finance.revenue_share_percent', 80)
            ->assertJsonPath('data.finance.can_request_payout', true)
            ->assertJsonPath('data.finance.bank_account', 'BCA ····7810 (Bimbel CN)')
            ->assertJsonPath('data.cards.available_balance.value', 800_000);
    }

    public function test_a_payout_is_not_possible_without_a_bank_account_or_balance(): void
    {
        $noBank = Institution::factory()->create();
        $this->sale(100_000, '2026-11-10', null, $noBank);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin, 'web')->getJson('/api/v1/institutions/'.$noBank->id.'/dashboard')->assertOk()
            ->assertJsonPath('data.finance.available_balance', 80_000)
            ->assertJsonPath('data.finance.can_request_payout', false)
            ->assertJsonPath('data.finance.bank_account', null);
    }

    public function test_top_programs_are_ranked_by_sales_and_limited_to_five(): void
    {
        $names = ['Matematika Intensif UTBK', 'IPA Terpadu', 'B. Indonesia Lengkap', 'Kimia Dasar', 'Bahasa Inggris', 'Fisika Modern'];
        foreach ($names as $i => $name) {
            $course = $this->program($name, $i === 4 ? 'draft' : 'active');
            foreach (range(1, 6 - $i) as $n) { // 6, 5, 4, 3, 2, 1 penjualan
                $this->sale(100_000, '2026-11-10', $course);
            }
        }
        $this->sale(100_000, '2025-01-01', Course::where('title', 'Fisika Modern')->first()); // di luar periode

        $top = $this->dashboard()->assertOk()->assertJsonCount(5, 'data.top_programs')->json('data.top_programs');

        $this->assertSame(['Matematika Intensif UTBK', 'IPA Terpadu', 'B. Indonesia Lengkap', 'Kimia Dasar', 'Bahasa Inggris'], array_map(fn ($p) => $p['course']['title'], $top));
        $this->assertSame([6, 5, 4, 3, 2], array_column($top, 'sold'));
        $this->assertSame([1, 2, 3, 4, 5], array_column($top, 'rank'));
        $this->assertSame(480_000, $top[0]['revenue']);
        $this->assertSame('active', $top[0]['status']);
        $this->assertSame('Draf', $top[4]['status_label']);
    }

    public function test_students_and_programs_are_counted_from_real_enrollments(): void
    {
        $a = $this->program('Program A');
        $b = $this->program('Program B');
        $draft = $this->program('Program Draf', 'draft');
        $other = $this->program('Program Lembaga Lain', 'active', Institution::factory()->create());
        $siswa1 = $this->userWithRole(Role::SISWA);
        $siswa2 = $this->userWithRole(Role::SISWA);
        $siswa3 = $this->userWithRole(Role::SISWA);

        Enrollment::factory()->create(['course_id' => $a->id, 'user_id' => $siswa1->id, 'enrolled_at' => '2026-11-15']);
        Enrollment::factory()->create(['course_id' => $b->id, 'user_id' => $siswa1->id, 'enrolled_at' => '2026-11-16']); // siswa sama: dihitung sekali
        Enrollment::factory()->create(['course_id' => $a->id, 'user_id' => $siswa2->id, 'enrolled_at' => '2025-01-01']);  // lama
        Enrollment::factory()->create(['course_id' => $a->id, 'user_id' => $siswa3->id, 'status' => 'cancelled', 'enrolled_at' => '2026-11-15']);
        Enrollment::factory()->create(['course_id' => $other->id, 'user_id' => $this->userWithRole(Role::SISWA)->id, 'enrolled_at' => '2026-11-15']);

        $this->dashboard()->assertOk()
            ->assertJsonPath('data.cards.active_students.value', 2)
            ->assertJsonPath('data.cards.active_students.new_in_period', 1)
            ->assertJsonPath('data.cards.active_programs.value', 2)
            ->assertJsonPath('data.cards.active_programs.released_in_period', 3);
    }

    public function test_student_progress_lists_recent_students_without_inventing_progress(): void
    {
        $program = $this->program('Program A');
        foreach (range(1, 8) as $i) {
            Enrollment::factory()->create(['course_id' => $program->id, 'user_id' => $this->userWithRole(Role::SISWA, ['name' => "Siswa {$i}"])->id, 'enrolled_at' => "2026-11-0{$i}"]);
        }

        $rows = $this->dashboard()->assertOk()->assertJsonCount(6, 'data.student_progress')->json('data.student_progress');

        $this->assertSame('Siswa 8', $rows[0]['user']['name']);
        $this->assertSame('Program A', $rows[0]['program']['title']);
        $this->assertNull($rows[0]['progress_percent']); // pencatatan progres belum ada
    }

    public function test_active_vouchers_are_only_this_institutions_usable_vouchers(): void
    {
        $owner = $this->institution->user_id;
        Coupon::factory()->institution()->percentage(10)->limited(50)->create(['owner_id' => $owner, 'code' => 'HEMAT10', 'name' => 'Promo Awal']);
        Coupon::factory()->institution()->fixed(25_000)->create(['owner_id' => $owner, 'code' => 'POTONG25']);
        Coupon::factory()->institution()->inactive()->create(['owner_id' => $owner, 'code' => 'MATI']);
        Coupon::factory()->institution()->expired()->create(['owner_id' => $owner, 'code' => 'LEWAT']);
        Coupon::factory()->institution()->create(['owner_id' => Institution::factory()->create()->user_id, 'code' => 'MILIKLAIN']);
        Coupon::factory()->create(['code' => 'KUPONADMIN']);

        $vouchers = $this->dashboard()->assertOk()->assertJsonPath('data.active_vouchers.total', 2)->json('data.active_vouchers.items');

        $this->assertEqualsCanonicalizing(['HEMAT10', 'POTONG25'], array_column($vouchers, 'code'));
        $byCode = collect($vouchers)->keyBy('code');
        $this->assertSame('10%', $byCode['HEMAT10']['discount_label']);
        $this->assertSame('0/50', $byCode['HEMAT10']['usage_label']);
        $this->assertSame('Rp 25.000', $byCode['POTONG25']['discount_label']);
        $this->assertSame('0/∞', $byCode['POTONG25']['usage_label']);
    }

    public function test_only_three_vouchers_are_shown_but_the_total_counts_all(): void
    {
        foreach (range(1, 5) as $i) {
            Coupon::factory()->institution()->create(['owner_id' => $this->institution->user_id, 'code' => "VOUCHER{$i}"]);
        }

        $this->dashboard()->assertOk()->assertJsonPath('data.active_vouchers.total', 5)->assertJsonCount(3, 'data.active_vouchers.items');
    }

    public function test_recent_payouts_show_the_latest_five_newest_first(): void
    {
        foreach (range(1, 7) as $i) {
            InstitutionPayout::create(['code' => "PO-{$i}", 'amount' => $i * 1000, 'status' => 'completed', 'bank_name' => 'BCA', 'bank_account_holder' => 'Bimbel CN', 'bank_account_last4' => '7810', 'institution_id' => $this->institution->id]);
        }

        $rows = $this->dashboard()->assertOk()->assertJsonCount(5, 'data.recent_payouts')->json('data.recent_payouts');

        $this->assertSame(['PO-7', 'PO-6', 'PO-5', 'PO-4', 'PO-3'], array_column($rows, 'code'));
        $this->assertSame('BCA ····7810 (Bimbel CN)', $rows[0]['destination']['label']);
    }

    public function test_the_response_lists_the_period_choices_and_default_is_three_months(): void
    {
        $this->dashboard()->assertOk()
            ->assertJsonPath('periods.0', ['key' => '7d', 'label' => '7 hari'])
            ->assertJsonCount(5, 'periods')
            ->assertJsonPath('data.period.key', '3m');
    }

    public function test_an_unknown_period_is_rejected(): void
    {
        $this->dashboard('?period=2w')->assertStatus(422)->assertJsonValidationErrors(['period']);
    }

    public function test_the_institution_without_revenue_share_shows_no_split_percent(): void
    {
        $this->institution->update(['revenue_share_percent' => null]);

        $this->dashboard()->assertOk()
            ->assertJsonPath('data.revenue_split.institution_percent', null)
            ->assertJsonPath('data.revenue_split.platform_percent', null)
            ->assertJsonPath('institution.needs_revenue_share', true);
    }

    public function test_deleted_institutions_and_unknown_ids_are_404(): void
    {
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->admin, 'web')->getJson('/api/v1/institutions/999999/dashboard')->assertNotFound();

        $this->institution->delete();
        $this->dashboard()->assertNotFound();
    }

    public function test_the_dashboard_hides_the_full_bank_number(): void
    {
        $this->assertStringNotContainsString('1234567810', $this->dashboard()->assertOk()->getContent());
    }
}
