<?php

namespace App\Services;

use App\Exceptions\InstitutionException;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pencairan dana ke Lembaga. Setiap perubahan dijaga transaksi dan kunci baris lembaga, sehingga dua
 * pengajuan bersamaan tidak bisa menarik saldo yang sama dua kali.
 */
class InstitutionPayoutService
{
    public function __construct(private readonly InstitutionRevenueService $revenue = new InstitutionRevenueService) {}

    /**
     * Mengajukan pencairan. $amount kosong = seluruh saldo yang bisa dicairkan.
     *
     * @throws InstitutionException
     */
    public function request(Institution $institution, ?int $amount, ?string $note, User $actor): InstitutionPayout
    {
        return DB::transaction(function () use ($institution, $amount, $note, $actor) {
            $locked = Institution::query()->lockForUpdate()->findOrFail($institution->id);

            if (! $locked->hasBankAccount()) {
                throw new InstitutionException(InstitutionException::BANK_NOT_SET, 'Rekening tujuan lembaga belum lengkap. Lengkapi bank, nama pemilik, dan nomor rekening terlebih dahulu.');
            }

            $available = $this->revenue->balance($locked)['available'];

            if ($amount === null) {
                if ($available <= 0) {
                    throw new InstitutionException(InstitutionException::NOTHING_TO_PAY_OUT, 'Tidak ada saldo yang dapat dicairkan.');
                }
                $amount = $available;
            }

            if ($amount <= 0) {
                throw new InstitutionException(InstitutionException::INVALID_AMOUNT, 'Jumlah pencairan harus lebih dari 0.');
            }
            if ($amount > $available) {
                throw new InstitutionException(
                    InstitutionException::INSUFFICIENT_BALANCE,
                    'Jumlah pencairan melebihi saldo yang dapat dicairkan (Rp '.number_format($available, 0, ',', '.').').'
                );
            }

            $payout = new InstitutionPayout([
                // Kode sementara agar kolom unik terpenuhi; diganti kode berurutan setelah id diketahui.
                'code' => 'PO-TMP-'.Str::upper(Str::random(12)),
                'amount' => $amount,
                'status' => InstitutionPayout::STATUS_PENDING,
                'bank_name' => $locked->bank_name,
                'bank_account_holder' => $locked->bank_account_holder,
                'bank_account_last4' => $locked->bankAccountLast4(),
                'note' => $note,
            ]);
            $payout->institution_id = $locked->id;
            $payout->requested_by = $actor->id;
            $payout->save();

            $payout->code = sprintf('PO-%s-%05d', now()->format('Y'), $payout->id);
            $payout->save();

            return $payout;
        });
    }

    /** @throws InstitutionException */
    public function complete(InstitutionPayout $payout, User $actor, ?string $note = null): InstitutionPayout
    {
        return $this->transition($payout, InstitutionPayout::STATUS_COMPLETED, $actor, $note);
    }

    /** Dibatalkan: nominalnya kembali menjadi saldo yang dapat dicairkan. @throws InstitutionException */
    public function cancel(InstitutionPayout $payout, User $actor, ?string $note = null): InstitutionPayout
    {
        return $this->transition($payout, InstitutionPayout::STATUS_CANCELLED, $actor, $note);
    }

    private function transition(InstitutionPayout $payout, string $to, User $actor, ?string $note): InstitutionPayout
    {
        return DB::transaction(function () use ($payout, $to, $actor, $note) {
            $locked = InstitutionPayout::query()->lockForUpdate()->findOrFail($payout->id);

            if (! $locked->isPending()) {
                throw new InstitutionException(
                    InstitutionException::INVALID_STATE,
                    "Pencairan {$locked->code} sudah berstatus {$locked->statusLabel()} dan tidak dapat diubah lagi."
                );
            }

            $locked->status = $to;
            $locked->processed_by = $actor->id;
            $locked->processed_at = now();
            if ($note !== null && $note !== '') {
                $locked->note = $note;
            }
            $locked->save();

            return $locked;
        });
    }
}
