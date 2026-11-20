<?php

namespace App\Services;

use App\Exceptions\CouponException;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Aturan pemakaian kupon. Dipanggil modul pembayaran (tahap berikutnya); diuji sekarang
 * agar aturannya sudah pasti sebelum pembayaran dibangun.
 */
class CouponService
{
    /**
     * Memeriksa kupon tanpa mencatat pemakaian.
     *
     * @return array{coupon: Coupon, original: int, discount: int, final: int}
     *
     * @throws CouponException
     */
    public function evaluate(string $code, int $amount, ?int $courseId = null): array
    {
        $coupon = $this->find($code);
        $this->assertUsable($coupon, $coupon?->usedCount() ?? 0, $amount, $courseId);

        $discount = $coupon->discountFor($amount);

        return ['coupon' => $coupon, 'original' => $amount, 'discount' => $discount, 'final' => $amount - $discount];
    }

    /**
     * Memakai kupon dan mencatatnya. Atomik: kuota dicek dan dicatat dalam satu transaksi dengan
     * kunci baris, sehingga kuota tidak terlampaui walau ada pemakaian bersamaan. Idempoten bila
     * $reference sama (mis. id pembayaran): pemakaian yang sama tidak tercatat dua kali.
     *
     * @throws CouponException
     */
    public function redeem(string $code, User $user, int $amount, ?int $courseId = null, ?string $reference = null): CouponRedemption
    {
        return DB::transaction(function () use ($code, $user, $amount, $courseId, $reference) {
            if ($reference !== null && ($existing = CouponRedemption::query()->where('reference', $reference)->first())) {
                return $existing;
            }

            $coupon = Coupon::query()->where('code', $this->normalize($code))->lockForUpdate()->first();
            $this->assertUsable($coupon, $coupon?->redemptions()->count() ?? 0, $amount, $courseId);

            $redemption = new CouponRedemption([
                'reference' => $reference,
                'original_amount' => $amount,
                'discount_amount' => $coupon->discountFor($amount),
            ]);
            $redemption->coupon_id = $coupon->id;
            $redemption->user_id = $user->id;
            $redemption->course_id = $courseId;
            $redemption->save();

            return $redemption;
        });
    }

    private function find(string $code): ?Coupon
    {
        return Coupon::query()->withCount('redemptions')->where('code', $this->normalize($code))->first();
    }

    private function normalize(string $code): string
    {
        return strtoupper(trim($code));
    }

    /** @throws CouponException */
    private function assertUsable(?Coupon $coupon, int $used, int $amount, ?int $courseId): void
    {
        if ($coupon === null) {
            throw new CouponException(CouponException::NOT_FOUND, 'Kode kupon tidak ditemukan.');
        }
        if ($amount <= 0) {
            throw new CouponException(CouponException::INVALID_AMOUNT, 'Nominal pembayaran tidak valid.');
        }

        match ($coupon->status($used)) {
            Coupon::STATUS_INACTIVE => throw new CouponException(CouponException::INACTIVE, 'Kupon tidak aktif.'),
            Coupon::STATUS_EXPIRED => throw new CouponException(CouponException::EXPIRED, 'Kupon sudah kedaluwarsa.'),
            Coupon::STATUS_EXHAUSTED => throw new CouponException(CouponException::EXHAUSTED, 'Kuota kupon sudah habis.'),
            default => null,
        };

        if ($coupon->course_id !== null && $coupon->course_id !== $courseId) {
            throw new CouponException(CouponException::WRONG_COURSE, 'Kupon ini hanya berlaku untuk kursus tertentu.');
        }
    }
}
