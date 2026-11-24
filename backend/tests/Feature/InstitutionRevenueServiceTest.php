<?php

namespace Tests\Feature;

use App\Exceptions\InstitutionException;
use App\Models\Course;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Role;
use App\Models\Transaction;
use App\Services\InstitutionRevenueService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Aturan uang Lembaga: bagi hasil, idempotensi, dan saldo. Dipanggil modul pembayaran nanti. */
class InstitutionRevenueServiceTest extends TestCase
{
    use RefreshDatabase;

    private InstitutionRevenueService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->service = new InstitutionRevenueService;
    }

    private function buyer()
    {
        return $this->userWithRole(Role::SISWA);
    }

    public function test_the_sale_is_split_by_the_institution_share_and_both_parts_add_up(): void
    {
        $institution = Institution::factory()->share(80)->create();

        $sale = $this->service->recordSale($institution, $this->buyer(), 100_001);

        $this->assertSame(100_001, $sale->net_amount);
        $this->assertSame(80_000, $sale->institution_amount); // dibulatkan ke bawah
        $this->assertSame(20_001, $sale->platform_amount);
        $this->assertSame($sale->net_amount, $sale->institution_amount + $sale->platform_amount);
        $this->assertSame(80, $sale->institution_share_percent);
        $this->assertSame(Transaction::STATUS_PAID, $sale->status);
    }

    public function test_the_split_is_calculated_after_the_discount(): void
    {
        $institution = Institution::factory()->share(70)->create();

        $sale = $this->service->recordSale($institution, $this->buyer(), 200_000, 50_000);

        $this->assertSame(200_000, $sale->gross_amount);
        $this->assertSame(50_000, $sale->discount_amount);
        $this->assertSame(150_000, $sale->net_amount);
        $this->assertSame(105_000, $sale->institution_amount);
        $this->assertSame(45_000, $sale->platform_amount);
    }

    public function test_a_fully_discounted_sale_is_not_possible_but_a_free_one_is_rejected(): void
    {
        $institution = Institution::factory()->create();

        $full = $this->service->recordSale($institution, $this->buyer(), 100_000, 100_000);
        $this->assertSame(0, $full->net_amount);
        $this->assertSame(0, $full->institution_amount);

        foreach ([[0, 0], [-5, 0], [100, 101], [100, -1]] as [$gross, $discount]) {
            try {
                $this->service->recordSale($institution, $this->buyer(), $gross, $discount);
                $this->fail("Seharusnya ditolak: gross {$gross}, diskon {$discount}.");
            } catch (InstitutionException $e) {
                $this->assertSame(InstitutionException::INVALID_AMOUNT, $e->reason);
            }
        }
    }

    public function test_the_same_reference_is_recorded_only_once(): void
    {
        $institution = Institution::factory()->create();
        $buyer = $this->buyer();

        $first = $this->service->recordSale($institution, $buyer, 100_000, 0, null, null, 'PAY-123');
        $second = $this->service->recordSale($institution, $buyer, 100_000, 0, null, null, 'PAY-123');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Transaction::count());
    }

    public function test_changing_the_share_later_does_not_rewrite_history(): void
    {
        $institution = Institution::factory()->share(80)->create();
        $old = $this->service->recordSale($institution, $this->buyer(), 100_000);

        $institution->update(['revenue_share_percent' => 50]);
        $new = $this->service->recordSale($institution->fresh(), $this->buyer(), 100_000);

        $this->assertSame(80_000, $old->fresh()->institution_amount);
        $this->assertSame(50_000, $new->institution_amount);
    }

    public function test_a_sale_needs_the_revenue_share_to_be_set(): void
    {
        $institution = Institution::factory()->share(null)->create();

        try {
            $this->service->recordSale($institution, $this->buyer(), 100_000);
            $this->fail('Seharusnya ditolak karena bagi hasil belum diatur.');
        } catch (InstitutionException $e) {
            $this->assertSame(InstitutionException::SHARE_NOT_SET, $e->reason);
        }

        $this->assertSame(0, Transaction::count());
    }

    public function test_the_program_must_belong_to_the_institution(): void
    {
        $institution = Institution::factory()->create();
        $other = Institution::factory()->create();
        $mine = Course::factory()->institution($institution->user)->active()->create();
        $theirs = Course::factory()->institution($other->user)->active()->create();
        $academic = Course::factory()->academic()->active()->create();

        $sale = $this->service->recordSale($institution, $this->buyer(), 100_000, 0, $mine);
        $this->assertSame($mine->id, $sale->course_id);

        foreach ([$theirs, $academic] as $course) {
            try {
                $this->service->recordSale($institution, $this->buyer(), 100_000, 0, $course);
                $this->fail('Program milik pihak lain seharusnya ditolak.');
            } catch (InstitutionException $e) {
                $this->assertSame(InstitutionException::INVALID_STATE, $e->reason);
            }
        }
    }

    public function test_balance_counts_paid_sales_minus_pending_and_completed_payouts(): void
    {
        $institution = Institution::factory()->create();
        Transaction::factory()->amount(100_000)->create(['institution_id' => $institution->id]); // lembaga 80.000, platform 20.000
        Transaction::factory()->amount(50_000)->create(['institution_id' => $institution->id]);  // lembaga 40.000, platform 10.000
        Transaction::factory()->amount(999_000)->refunded()->create(['institution_id' => $institution->id]);
        InstitutionPayout::create(['code' => 'PO-1', 'amount' => 30_000, 'status' => 'completed', 'institution_id' => $institution->id]);
        InstitutionPayout::create(['code' => 'PO-2', 'amount' => 20_000, 'status' => 'pending', 'institution_id' => $institution->id]);
        InstitutionPayout::create(['code' => 'PO-3', 'amount' => 500_000, 'status' => 'cancelled', 'institution_id' => $institution->id]);
        Transaction::factory()->amount(70_000)->create(['institution_id' => Institution::factory()->create()->id]); // lembaga lain

        $balance = $this->service->balance($institution);

        $this->assertSame(150_000, $balance['gross']);
        $this->assertSame(120_000, $balance['earned']);
        $this->assertSame(30_000, $balance['platform']);
        $this->assertSame(30_000, $balance['completed']);
        $this->assertSame(20_000, $balance['pending']);
        $this->assertSame(70_000, $balance['available']);
    }

    public function test_a_refund_takes_the_sale_out_of_the_balance_and_is_idempotent(): void
    {
        $institution = Institution::factory()->create();
        $sale = $this->service->recordSale($institution, $this->buyer(), 100_000);
        $this->assertSame(80_000, $this->service->balance($institution)['available']);

        $this->service->refund($sale);
        $this->service->refund($sale);

        $this->assertSame(Transaction::STATUS_REFUNDED, $sale->fresh()->status);
        $this->assertSame(0, $this->service->balance($institution)['available']);
        $this->assertSame(1, Transaction::count());
    }

    public function test_the_balance_never_shows_negative_after_a_refund_following_a_payout(): void
    {
        $institution = Institution::factory()->create();
        $sale = $this->service->recordSale($institution, $this->buyer(), 100_000);
        InstitutionPayout::create(['code' => 'PO-1', 'amount' => 80_000, 'status' => 'completed', 'institution_id' => $institution->id]);

        $this->service->refund($sale);

        $this->assertSame(0, $this->service->balance($institution)['available']);
    }

    public function test_money_columns_are_whole_rupiah_integers(): void
    {
        $institution = Institution::factory()->share(33)->create();

        $sale = $this->service->recordSale($institution, $this->buyer(), 100_000);

        $this->assertIsInt($sale->institution_amount);
        $this->assertSame(33_000, $sale->institution_amount);
        $this->assertSame(67_000, $sale->platform_amount);
    }
}
