<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Riwayat dan proses pencairan dana Lembaga oleh Admin. */
class InstitutionPayoutApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Institution $institution;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN);
        $this->institution = Institution::factory()->withBank('BCA', 'Bimbel CN', '1234567810')->create(['name' => 'Bimbel CN']);
    }

    private function asAdmin(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($this->admin, 'web');
    }

    private function url(string $suffix = ''): string
    {
        return '/api/v1/institutions/'.$this->institution->id.'/payouts'.$suffix;
    }

    /** Memberi lembaga saldo yang bisa dicairkan (bagian lembaga = 80% dari nominal). */
    private function earn(int $net, ?Institution $institution = null): void
    {
        Transaction::factory()->amount($net)->create(['institution_id' => ($institution ?? $this->institution)->id]);
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    public function test_payout_history_is_listed_newest_first_with_the_balance_summary(): void
    {
        $this->earn(1_000_000); // 800.000
        InstitutionPayout::create(['code' => 'PO-OLD', 'amount' => 300_000, 'status' => 'completed', 'bank_name' => 'BCA', 'bank_account_holder' => 'Bimbel CN', 'bank_account_last4' => '7810', 'institution_id' => $this->institution->id, 'processed_at' => now()]);
        InstitutionPayout::create(['code' => 'PO-NEW', 'amount' => 100_000, 'status' => 'pending', 'bank_name' => 'BCA', 'bank_account_holder' => 'Bimbel CN', 'bank_account_last4' => '7810', 'institution_id' => $this->institution->id]);

        $this->asAdmin()->getJson($this->url())->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.code', 'PO-NEW')
            ->assertJsonPath('data.0.status_label', 'Menunggu')
            ->assertJsonPath('data.0.destination.label', 'BCA ····7810 (Bimbel CN)')
            ->assertJsonPath('data.1.status_label', 'Selesai')
            ->assertJsonPath('summary.available_balance', 400_000)
            ->assertJsonPath('summary.pending_total', 100_000)
            ->assertJsonPath('summary.completed_total', 300_000);

        $this->asAdmin()->getJson($this->url('?status=completed'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.code', 'PO-OLD');
        $this->asAdmin()->getJson($this->url('?status=ngawur'))->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_requesting_without_an_amount_pays_out_the_whole_balance(): void
    {
        $this->earn(1_000_000);

        $response = $this->asAdmin()->postJson($this->url(), [])->assertCreated();

        $response->assertJsonPath('message', 'Pencairan dana diajukan dengan status Menunggu.')
            ->assertJsonPath('data.amount', 800_000)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.destination.account_last4', '7810')
            ->assertJsonPath('data.requested_by.name', $this->admin->name)
            ->assertJsonPath('data.processed_at', null);
        $this->assertMatchesRegularExpression('/^PO-\d{4}-\d{5}$/', $response->json('data.code'));
        $this->assertStringNotContainsString('1234567810', $response->getContent());

        $this->asAdmin()->getJson($this->url())->assertJsonPath('summary.available_balance', 0)->assertJsonPath('summary.pending_total', 800_000);
    }

    public function test_requesting_part_of_the_balance_leaves_the_rest_available(): void
    {
        $this->earn(1_000_000);

        $this->asAdmin()->postJson($this->url(), ['amount' => 500_000, 'note' => 'Termin 1'])->assertCreated()
            ->assertJsonPath('data.amount', 500_000)->assertJsonPath('data.note', 'Termin 1');

        $this->asAdmin()->getJson($this->url())->assertJsonPath('summary.available_balance', 300_000);
    }

    public function test_codes_are_sequential_and_unique(): void
    {
        $this->earn(1_000_000);

        $a = $this->asAdmin()->postJson($this->url(), ['amount' => 100_000])->json('data.code');
        $b = $this->asAdmin()->postJson($this->url(), ['amount' => 100_000])->json('data.code');

        $this->assertNotSame($a, $b);
        $this->assertSame(substr($a, 0, 8), substr($b, 0, 8));
    }

    public function test_the_balance_can_never_be_overdrawn_even_with_repeated_requests(): void
    {
        $this->earn(1_000_000); // saldo 800.000

        $this->asAdmin()->postJson($this->url(), ['amount' => 500_000])->assertCreated();
        $this->asAdmin()->postJson($this->url(), ['amount' => 500_000])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($this->url(), ['amount' => 300_000])->assertCreated();
        $this->asAdmin()->postJson($this->url(), ['amount' => 1])->assertStatus(422);
        $this->asAdmin()->postJson($this->url(), [])->assertStatus(422)->assertJsonValidationErrors(['amount']); // tidak ada saldo lagi

        $this->assertSame(800_000, (int) InstitutionPayout::sum('amount'));
        $this->assertSame(2, AuditLog::where('action', 'institution.payout_requested')->count());
    }

    public function test_the_error_message_names_the_available_balance(): void
    {
        $this->earn(1_000_000);

        $this->asAdmin()->postJson($this->url(), ['amount' => 900_000])->assertStatus(422)
            ->assertJsonPath('errors.amount.0', 'Jumlah pencairan melebihi saldo yang dapat dicairkan (Rp 800.000).');
    }

    public function test_an_institution_without_a_complete_bank_account_cannot_be_paid(): void
    {
        $noBank = Institution::factory()->create();
        $this->earn(1_000_000, $noBank);

        $this->asAdmin()->postJson('/api/v1/institutions/'.$noBank->id.'/payouts', [])->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->assertSame(0, InstitutionPayout::count());
    }

    public function test_request_validates_the_amount_and_note(): void
    {
        $this->earn(1_000_000);

        $this->asAdmin()->postJson($this->url(), ['amount' => 0])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($this->url(), ['amount' => -5])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($this->url(), ['amount' => 10.5])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($this->url(), ['amount' => 'banyak'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
        $this->asAdmin()->postJson($this->url(), ['note' => str_repeat('x', 256)])->assertStatus(422)->assertJsonValidationErrors(['note']);

        $this->assertSame(0, InstitutionPayout::count());
    }

    public function test_the_destination_is_a_copy_so_later_bank_changes_do_not_rewrite_history(): void
    {
        $this->earn(1_000_000);
        $payout = $this->asAdmin()->postJson($this->url(), ['amount' => 100_000])->assertCreated()->json('data');

        $this->institution->update(['bank_name' => 'Mandiri', 'bank_account_holder' => 'Pemilik Baru', 'bank_account_number' => '99998888']);

        $this->asAdmin()->getJson($this->url())->assertJsonPath('data.0.destination.label', 'BCA ····7810 (Bimbel CN)');
        $this->assertSame($payout['id'], InstitutionPayout::first()->id);
    }

    public function test_completing_a_pending_payout_records_who_and_when(): void
    {
        $this->earn(1_000_000);
        $id = $this->asAdmin()->postJson($this->url(), [])->json('data.id');

        $this->asAdmin()->patchJson($this->url('/'.$id), ['status' => 'completed', 'note' => 'Transfer berhasil'])->assertOk()
            ->assertJsonPath('message', 'Pencairan dana ditandai selesai.')
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.status_label', 'Selesai')
            ->assertJsonPath('data.processed_by.name', $this->admin->name)
            ->assertJsonPath('data.note', 'Transfer berhasil');

        $this->assertNotNull(InstitutionPayout::find($id)->processed_at);
        $this->assertSame(800_000, $this->lastLog('institution.payout_completed')->changes['amount']);
        // Selesai tetap menahan saldo (uangnya sudah keluar).
        $this->asAdmin()->getJson($this->url())->assertJsonPath('summary.available_balance', 0)->assertJsonPath('summary.completed_total', 800_000);
    }

    public function test_cancelling_returns_the_money_to_the_balance(): void
    {
        $this->earn(1_000_000);
        $id = $this->asAdmin()->postJson($this->url(), [])->json('data.id');

        $this->asAdmin()->patchJson($this->url('/'.$id), ['status' => 'cancelled'])->assertOk()
            ->assertJsonPath('message', 'Pencairan dana dibatalkan. Dana kembali ke saldo.')
            ->assertJsonPath('data.status', 'cancelled');

        $this->asAdmin()->getJson($this->url())->assertJsonPath('summary.available_balance', 800_000)->assertJsonPath('summary.pending_total', 0);
        $this->assertSame(1, AuditLog::where('action', 'institution.payout_cancelled')->count());
        $this->asAdmin()->postJson($this->url(), [])->assertCreated(); // dana bisa diajukan lagi
    }

    public function test_a_processed_payout_cannot_be_changed_again(): void
    {
        $this->earn(1_000_000);
        $done = $this->asAdmin()->postJson($this->url(), ['amount' => 100_000])->json('data.id');
        $cancelled = $this->asAdmin()->postJson($this->url(), ['amount' => 100_000])->json('data.id');
        $this->asAdmin()->patchJson($this->url('/'.$done), ['status' => 'completed'])->assertOk();
        $this->asAdmin()->patchJson($this->url('/'.$cancelled), ['status' => 'cancelled'])->assertOk();

        foreach ([$done, $cancelled] as $id) {
            foreach (['completed', 'cancelled'] as $status) {
                $this->asAdmin()->patchJson($this->url('/'.$id), ['status' => $status])->assertStatus(422)->assertJsonValidationErrors(['status']);
            }
        }
        $this->assertSame(1, AuditLog::where('action', 'institution.payout_completed')->count());
    }

    public function test_status_is_validated_and_pending_cannot_be_set_manually(): void
    {
        $this->earn(1_000_000);
        $id = $this->asAdmin()->postJson($this->url(), [])->json('data.id');

        $this->asAdmin()->patchJson($this->url('/'.$id), [])->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->asAdmin()->patchJson($this->url('/'.$id), ['status' => 'pending'])->assertStatus(422)->assertJsonValidationErrors(['status']);
        $this->asAdmin()->patchJson($this->url('/'.$id), ['status' => 'ngawur'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_a_payout_of_another_institution_cannot_be_changed_through_this_url(): void
    {
        $other = Institution::factory()->withBank()->create();
        $this->earn(1_000_000, $other);
        $foreign = $this->asAdmin()->postJson('/api/v1/institutions/'.$other->id.'/payouts', [])->json('data.id');

        $this->asAdmin()->patchJson($this->url('/'.$foreign), ['status' => 'completed'])->assertNotFound();
        $this->assertSame('pending', InstitutionPayout::find($foreign)->status);
    }

    public function test_viewing_does_not_allow_moving_money(): void
    {
        $this->earn(1_000_000);
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()
            ->syncWithoutDetaching(Permission::whereIn('slug', ['institutions.view', 'institutions.update'])->pluck('id'));
        $editor = $this->userWithRole(Role::MENTOR);
        $this->app['auth']->forgetGuards();

        $this->actingAs($editor, 'web')->getJson($this->url())->assertOk();
        $this->actingAs($editor, 'web')->postJson($this->url(), [])->assertForbidden();
        $id = InstitutionPayout::create(['code' => 'PO-1', 'amount' => 1000, 'institution_id' => $this->institution->id])->id;
        $this->actingAs($editor, 'web')->patchJson($this->url('/'.$id), ['status' => 'completed'])->assertForbidden();

        $this->assertSame('pending', InstitutionPayout::find($id)->status);
    }

    public function test_money_endpoints_reject_guests_and_other_roles(): void
    {
        $this->earn(1_000_000);

        $this->app['auth']->forgetGuards();
        $this->getJson($this->url())->assertUnauthorized();
        $this->postJson($this->url(), [])->assertUnauthorized();

        foreach ([Role::MENTOR, Role::SISWA, Role::KARYAWAN] as $role) {
            $this->app['auth']->forgetGuards();
            $this->actingAs($this->userWithRole($role), 'web')->postJson($this->url(), [])->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->institution->user, 'web')->postJson($this->url(), [])->assertForbidden();

        $this->assertSame(0, InstitutionPayout::count());
    }

    public function test_payout_actions_are_audited_with_the_institution_and_destination(): void
    {
        $this->earn(1_000_000);
        $this->asAdmin()->postJson($this->url(), ['amount' => 250_000])->assertCreated();

        $log = $this->lastLog('institution.payout_requested');
        $this->assertSame(250_000, $log->changes['amount']);
        $this->assertSame('Bimbel CN', $log->changes['institution']);
        $this->assertSame('BCA ····7810 (Bimbel CN)', $log->changes['destination']);
        $this->assertSame($this->admin->id, $log->actor_id);
        $this->assertStringNotContainsString('1234567810', json_encode($log->changes));
    }
}
