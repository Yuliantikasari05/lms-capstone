<?php

namespace App\Services;

use App\Exceptions\InstitutionException;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Transaction;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Pencatatan penjualan Program Lembaga dan saldo lembaga. Dipanggil modul pembayaran (tahap berikutnya,
 * termasuk "Bayar (simulasi)"); diuji sekarang agar aturan uangnya sudah pasti sebelum pembayaran dibangun.
 *
 * Aturan: pembagian hasil dihitung dari persentase lembaga SAAT transaksi lalu disalin ke transaksi;
 * bagian lembaga dibulatkan ke bawah; transaksi idempoten menurut "reference".
 */
class InstitutionRevenueService
{
    /**
     * Mencatat satu penjualan. Atomik dan idempoten: reference yang sama mengembalikan transaksi yang
     * sudah ada tanpa mencatat ulang.
     *
     * @param  int  $grossAmount  harga sebelum diskon (rupiah, > 0)
     * @param  int  $discountAmount  potongan kupon/voucher (0 sampai $grossAmount)
     *
     * @throws InstitutionException
     */
    public function recordSale(
        Institution $institution,
        User $buyer,
        int $grossAmount,
        int $discountAmount = 0,
        ?Course $course = null,
        ?Coupon $coupon = null,
        ?string $reference = null,
        ?CarbonInterface $paidAt = null,
    ): Transaction {
        if ($grossAmount <= 0 || $discountAmount < 0 || $discountAmount > $grossAmount) {
            throw new InstitutionException(InstitutionException::INVALID_AMOUNT, 'Nominal transaksi tidak valid.');
        }

        return DB::transaction(function () use ($institution, $buyer, $grossAmount, $discountAmount, $course, $coupon, $reference, $paidAt) {
            if ($reference !== null && ($existing = Transaction::query()->where('reference', $reference)->first())) {
                return $existing;
            }

            // Kunci baris lembaga: persentase yang dibaca tidak berubah di tengah pencatatan.
            $locked = Institution::query()->lockForUpdate()->find($institution->id);

            if ($locked === null) {
                throw new InstitutionException(InstitutionException::INVALID_STATE, 'Lembaga tidak ditemukan.');
            }
            if (! $locked->hasRevenueShare()) {
                throw new InstitutionException(InstitutionException::SHARE_NOT_SET, 'Persentase bagi hasil lembaga belum diatur oleh Admin.');
            }
            if ($course !== null && ! ($course->isInstitutionProgram() && $course->created_by === $locked->user_id)) {
                throw new InstitutionException(InstitutionException::INVALID_STATE, 'Program tersebut bukan milik lembaga ini.');
            }

            $net = $grossAmount - $discountAmount;
            $split = $locked->splitFor($net);

            $transaction = new Transaction([
                'reference' => $reference ?? 'TRX-'.Str::upper(Str::random(14)),
                'gross_amount' => $grossAmount,
                'discount_amount' => $discountAmount,
                'net_amount' => $net,
                'institution_share_percent' => $locked->revenue_share_percent,
                'institution_amount' => $split['institution'],
                'platform_amount' => $split['platform'],
                'status' => Transaction::STATUS_PAID,
                'paid_at' => $paidAt ?? now(),
            ]);
            $transaction->institution_id = $locked->id;
            $transaction->user_id = $buyer->id;
            $transaction->course_id = $course?->id;
            $transaction->coupon_id = $coupon?->id;
            $transaction->save();

            return $transaction;
        });
    }

    /** Pengembalian dana: transaksi tidak dihapus, hanya keluar dari perhitungan pendapatan. Idempoten. */
    public function refund(Transaction $transaction): Transaction
    {
        if ($transaction->status !== Transaction::STATUS_REFUNDED) {
            $transaction->status = Transaction::STATUS_REFUNDED;
            $transaction->save();
        }

        return $transaction;
    }

    /**
     * Ringkasan uang lembaga (seluruh waktu). Saldo tidak pernah negatif pada tampilan walau ada
     * pengembalian dana setelah pencairan; selisih itu terlihat dari "earned" dan "held".
     *
     * @return array{gross: int, earned: int, platform: int, completed: int, pending: int, available: int}
     */
    public function balance(Institution $institution): array
    {
        $paid = Transaction::query()->where('institution_id', $institution->id)->paid();

        $earned = (int) (clone $paid)->sum('institution_amount');
        $platform = (int) (clone $paid)->sum('platform_amount');
        $gross = (int) (clone $paid)->sum('net_amount');

        $payouts = InstitutionPayout::query()->where('institution_id', $institution->id);
        $completed = (int) (clone $payouts)->where('status', InstitutionPayout::STATUS_COMPLETED)->sum('amount');
        $pending = (int) (clone $payouts)->where('status', InstitutionPayout::STATUS_PENDING)->sum('amount');

        return [
            'gross' => $gross,
            'earned' => $earned,
            'platform' => $platform,
            'completed' => $completed,
            'pending' => $pending,
            'available' => max(0, $earned - $completed - $pending),
        ];
    }
}
