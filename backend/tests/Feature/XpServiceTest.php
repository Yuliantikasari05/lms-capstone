<?php

namespace Tests\Feature;

use App\Exceptions\XpException;
use App\Models\Level;
use App\Models\Role;
use App\Models\User;
use App\Models\XpBalance;
use App\Models\XpTransaction;
use App\Services\XpService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Buku besar XP: saldo selalu sama dengan jumlah riwayat, riwayat tidak dapat diubah, pemberian idempoten. */
class XpServiceTest extends TestCase
{
    use RefreshDatabase;

    private XpService $xp;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->xp = new XpService;
        $this->admin = $this->userWithRole(Role::ADMIN);
    }

    private function siswa(): User
    {
        return $this->userWithRole(Role::SISWA);
    }

    private function ledgerSum(User $user): int
    {
        return (int) XpTransaction::where('user_id', $user->id)->sum('amount');
    }

    // ------------------------------------------------------------------ award

    public function test_award_records_the_transaction_and_updates_the_balance(): void
    {
        $siswa = $this->siswa();

        $tx = $this->xp->award($siswa, 10, 'material', 42, 'Materi selesai');

        $this->assertNotNull($tx);
        $this->assertSame(10, $tx->amount);
        $this->assertSame('material', $tx->source_type);
        $this->assertSame(42, $tx->source_id);
        $this->assertNull($tx->created_by);
        $this->assertSame(10, $this->xp->balanceOf($siswa));
        $this->assertSame(10, XpBalance::find($siswa->id)->total_xp);
    }

    public function test_the_same_source_awards_xp_only_once_per_student(): void
    {
        $siswa = $this->siswa();

        $this->assertNotNull($this->xp->award($siswa, 10, 'material', 42));
        $this->assertNull($this->xp->award($siswa, 10, 'material', 42), 'Pemberian kedua dari sumber yang sama diabaikan.');
        $this->assertNull($this->xp->award($siswa, 99, 'material', 42), 'Walau nilainya berbeda.');

        $this->assertSame(10, $this->xp->balanceOf($siswa));
        $this->assertSame(1, XpTransaction::count());
    }

    public function test_different_sources_and_different_students_are_independent(): void
    {
        $a = $this->siswa();
        $b = $this->siswa();

        $this->xp->award($a, 10, 'material', 1);
        $this->xp->award($a, 20, 'material', 2);   // materi lain
        $this->xp->award($a, 30, 'task', 1);       // jenis sumber lain, id sama
        $this->xp->award($b, 10, 'material', 1);   // siswa lain, sumber sama

        $this->assertSame(60, $this->xp->balanceOf($a));
        $this->assertSame(10, $this->xp->balanceOf($b));
        $this->assertSame(4, XpTransaction::count());
    }

    #[DataProvider('invalidAwards')]
    public function test_award_rejects_invalid_input(int $amount, string $source, string $reason): void
    {
        try {
            $this->xp->award($this->siswa(), $amount, $source, 1);
            $this->fail('Seharusnya ditolak.');
        } catch (XpException $e) {
            $this->assertSame($reason, $e->reason);
        }

        $this->assertSame(0, XpTransaction::count());
        $this->assertSame(0, XpBalance::count());
    }

    public static function invalidAwards(): array
    {
        return [
            'nol' => [0, 'material', 'invalid_amount'],
            'negatif' => [-5, 'material', 'invalid_amount'],
            'sumber koreksi tidak boleh lewat award' => [10, 'adjustment', 'invalid_source'],
            'sumber ngawur' => [10, 'apa-saja', 'invalid_source'],
        ];
    }

    #[DataProvider('nonStudentRoles')]
    public function test_only_students_can_have_xp(string $role): void
    {
        $user = $this->userWithRole($role);

        foreach ([fn () => $this->xp->award($user, 10, 'material', 1), fn () => $this->xp->adjust($user, 10, 'Uji', $this->admin), fn () => $this->xp->reset($user, 'Uji', $this->admin)] as $action) {
            try {
                $action();
                $this->fail('Seharusnya ditolak.');
            } catch (XpException $e) {
                $this->assertSame('not_student', $e->reason);
                $this->assertSame('Hanya Siswa yang dapat memiliki XP.', $e->getMessage());
            }
        }

        $this->assertSame(0, XpTransaction::count());
    }

    public static function nonStudentRoles(): array
    {
        return [['admin'], ['mentor'], ['karyawan'], ['lembaga']];
    }

    public function test_a_deleted_student_cannot_receive_xp(): void
    {
        $siswa = $this->siswa();
        $siswa->delete();

        $this->expectException(XpException::class);
        $this->xp->award($siswa, 10, 'material', 1);
    }

    // ------------------------------------------------------------------ adjust

    public function test_adjust_adds_and_subtracts_with_the_admin_recorded(): void
    {
        $siswa = $this->siswa();

        $up = $this->xp->adjust($siswa, 100, 'Bonus lomba', $this->admin);
        $down = $this->xp->adjust($siswa, -30, 'Salah input', $this->admin);

        $this->assertSame(100, $up->amount);
        $this->assertSame('adjustment', $up->source_type);
        $this->assertSame('Bonus lomba', $up->reason);
        $this->assertSame($this->admin->id, $up->created_by);
        $this->assertSame(-30, $down->amount);
        $this->assertSame(70, $this->xp->balanceOf($siswa));
    }

    public function test_adjustments_do_not_deduplicate(): void
    {
        $siswa = $this->siswa();

        $this->xp->adjust($siswa, 10, 'Sama', $this->admin);
        $this->xp->adjust($siswa, 10, 'Sama', $this->admin);

        $this->assertSame(20, $this->xp->balanceOf($siswa));
        $this->assertSame(2, XpTransaction::count());
    }

    public function test_adjust_rejects_zero_and_a_negative_balance_without_writing_anything(): void
    {
        $siswa = $this->siswa();
        $this->xp->adjust($siswa, 50, 'Awal', $this->admin);

        foreach ([[0, 'invalid_amount'], [-51, 'below_zero']] as [$delta, $reason]) {
            try {
                $this->xp->adjust($siswa, $delta, 'Uji', $this->admin);
                $this->fail('Seharusnya ditolak.');
            } catch (XpException $e) {
                $this->assertSame($reason, $e->reason);
            }
        }

        $this->assertSame(50, $this->xp->balanceOf($siswa));
        $this->assertSame(1, XpTransaction::count());
    }

    public function test_the_balance_can_reach_exactly_zero(): void
    {
        $siswa = $this->siswa();
        $this->xp->adjust($siswa, 50, 'Awal', $this->admin);

        $this->xp->adjust($siswa, -50, 'Habis', $this->admin);

        $this->assertSame(0, $this->xp->balanceOf($siswa));
    }

    // ------------------------------------------------------------------ reset

    public function test_reset_zeroes_the_balance_with_one_new_entry_and_keeps_history(): void
    {
        $siswa = $this->siswa();
        $this->xp->award($siswa, 40, 'material', 1);
        $this->xp->adjust($siswa, 60, 'Bonus', $this->admin);

        $reset = $this->xp->reset($siswa, 'Akun salah pakai', $this->admin);

        $this->assertSame(-100, $reset->amount);
        $this->assertSame('reset', $reset->source_type);
        $this->assertSame('Akun salah pakai', $reset->reason);
        $this->assertSame(0, $this->xp->balanceOf($siswa));
        $this->assertSame(3, XpTransaction::where('user_id', $siswa->id)->count(), 'Riwayat lama tetap ada.');
        $this->assertSame(0, $this->ledgerSum($siswa));
    }

    public function test_resetting_a_zero_balance_is_rejected(): void
    {
        $siswa = $this->siswa();

        try {
            $this->xp->reset($siswa, 'Uji', $this->admin);
            $this->fail('Seharusnya ditolak.');
        } catch (XpException $e) {
            $this->assertSame('already_zero', $e->reason);
        }

        $this->assertSame(0, XpTransaction::count());
    }

    public function test_xp_can_be_earned_again_after_a_reset_from_new_sources_only(): void
    {
        $siswa = $this->siswa();
        $this->xp->award($siswa, 40, 'material', 1);
        $this->xp->reset($siswa, 'Reset', $this->admin);

        $this->assertNull($this->xp->award($siswa, 40, 'material', 1), 'Sumber lama tidak memberi XP lagi.');
        $this->assertNotNull($this->xp->award($siswa, 25, 'material', 2));
        $this->assertSame(25, $this->xp->balanceOf($siswa));
    }

    // ------------------------------------------------------------------ keutuhan

    public function test_the_ledger_cannot_be_edited_or_deleted(): void
    {
        $tx = $this->xp->award($this->siswa(), 10, 'material', 1);

        try {
            $tx->update(['amount' => 9999]);
            $this->fail('Update seharusnya ditolak.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('tidak boleh diubah', $e->getMessage());
        }
        try {
            $tx->delete();
            $this->fail('Delete seharusnya ditolak.');
        } catch (LogicException $e) {
            $this->assertStringContainsString('tidak boleh dihapus', $e->getMessage());
        }

        $this->assertSame(10, $tx->fresh()->amount);
    }

    public function test_the_database_itself_rejects_a_duplicate_source(): void
    {
        $siswa = $this->siswa();
        $this->xp->award($siswa, 10, 'material', 7);

        $this->expectException(QueryException::class);
        $duplicate = new XpTransaction(['amount' => 5, 'source_type' => 'material', 'source_id' => 7]);
        $duplicate->user_id = $siswa->id;
        $duplicate->save();
    }

    public function test_the_balance_always_equals_the_sum_of_the_ledger(): void
    {
        mt_srand(20261105);
        $students = [$this->siswa(), $this->siswa(), $this->siswa()];

        for ($i = 0; $i < 60; $i++) {
            $student = $students[mt_rand(0, 2)];
            try {
                match (mt_rand(0, 3)) {
                    0, 1 => $this->xp->award($student, mt_rand(1, 50), ['material', 'task', 'exam'][mt_rand(0, 2)], mt_rand(1, 8)),
                    2 => $this->xp->adjust($student, mt_rand(-80, 80) ?: 5, 'Acak', $this->admin),
                    default => $this->xp->reset($student, 'Acak', $this->admin),
                };
            } catch (XpException) {
                // penolakan sah (saldo negatif / sudah nol): tidak boleh meninggalkan jejak
            }

            foreach ($students as $s) {
                $this->assertSame($this->ledgerSum($s), $this->xp->balanceOf($s), "Saldo {$s->id} harus sama dengan jumlah riwayat (langkah {$i}).");
                $this->assertGreaterThanOrEqual(0, $this->xp->balanceOf($s));
            }
        }
    }

    public function test_balance_of_a_student_without_xp_is_zero(): void
    {
        $this->assertSame(0, $this->xp->balanceOf($this->siswa()));
    }

    // ------------------------------------------------------------------ level

    public function test_a_level_is_the_highest_one_whose_threshold_is_reached(): void
    {
        Level::create(['name' => 'Pemula', 'min_xp' => 0]);
        Level::create(['name' => 'Mahir', 'min_xp' => 500]);
        Level::create(['name' => 'Menengah', 'min_xp' => 200]);
        $levels = Level::all();

        $this->assertSame('Pemula', Level::resolve($levels, 0)->name);
        $this->assertSame('Pemula', Level::resolve($levels, 199)->name);
        $this->assertSame('Menengah', Level::resolve($levels, 200)->name);
        $this->assertSame('Menengah', Level::resolve($levels, 499)->name);
        $this->assertSame('Mahir', Level::resolve($levels, 500)->name);
        $this->assertSame('Mahir', Level::resolve($levels, 999999)->name);
    }

    public function test_there_is_no_level_when_none_is_defined_or_reached(): void
    {
        $this->assertNull(Level::resolve(Level::all(), 100), 'Tanpa level yang dibuat Admin, tidak ada level.');

        Level::create(['name' => 'Mahir', 'min_xp' => 500]);
        $this->assertNull(Level::resolve(Level::all(), 499), 'Di bawah level terendah: tanpa level.');
    }
}
