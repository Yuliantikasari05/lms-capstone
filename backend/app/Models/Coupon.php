<?php

namespace App\Models;

use Database\Factories\CouponFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Kupon diskon. Milik Admin (owner_type=admin); voucher Lembaga (owner_type=institution) dikerjakan
 * di tahap pembayaran dengan tabel yang sama.
 */
class Coupon extends Model
{
    /** @use HasFactory<CouponFactory> */
    use HasFactory, SoftDeletes;

    public const OWNER_ADMIN = 'admin';
    public const OWNER_INSTITUTION = 'institution';

    public const TYPE_PERCENTAGE = 'percentage';
    public const TYPE_FIXED = 'fixed';

    public const TYPES = [self::TYPE_PERCENTAGE, self::TYPE_FIXED];

    public const TYPE_LABELS = [
        self::TYPE_PERCENTAGE => 'Persentase (%)',
        self::TYPE_FIXED => 'Nominal Tetap (Rp)',
    ];

    /** Status efektif (dihitung): nonaktif > kedaluwarsa > habis > aktif. */
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_EXHAUSTED = 'exhausted';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_EXPIRED, self::STATUS_EXHAUSTED];

    public const STATUS_LABELS = [
        self::STATUS_ACTIVE => 'Aktif',
        self::STATUS_INACTIVE => 'Nonaktif',
        self::STATUS_EXPIRED => 'Kedaluwarsa',
        self::STATUS_EXHAUSTED => 'Kuota habis',
    ];

    /** Nilai bawaan di model (bukan hanya di database) agar respons pembuatan langsung benar. */
    protected $attributes = ['is_active' => true];

    /** owner_type, owner_id, dan created_by sengaja tidak fillable: diisi eksplisit oleh controller. */
    protected $fillable = ['name', 'code', 'discount_type', 'discount_value', 'usage_limit', 'course_id', 'expires_at', 'is_active'];

    protected function casts(): array
    {
        return [
            'discount_value' => 'integer',
            'usage_limit' => 'integer',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /** Kode selalu disimpan huruf besar tanpa spasi di pinggir (unik tanpa membedakan besar-kecil). */
    public function setCodeAttribute(?string $value): void
    {
        $this->attributes['code'] = $value === null ? null : strtoupper(trim($value));
    }

    // ------------------------------------------------------------------ relasi

    /** withTrashed: nama kursus tetap tampil walaupun kursusnya sudah dihapus. */
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    // ------------------------------------------------------------------ aturan kupon

    public function isOwnedByAdmin(): bool
    {
        return $this->owner_type === self::OWNER_ADMIN;
    }

    /** Jumlah pemakaian. Memakai withCount('redemptions') bila ada agar tidak query berulang. */
    public function usedCount(): int
    {
        return (int) ($this->redemptions_count ?? $this->redemptions()->count());
    }

    public function status(?int $usedCount = null): string
    {
        $used = $usedCount ?? $this->usedCount();

        return match (true) {
            ! $this->is_active => self::STATUS_INACTIVE,
            $this->expires_at !== null && $this->expires_at->lessThanOrEqualTo(now()) => self::STATUS_EXPIRED,
            $this->usage_limit !== null && $used >= $this->usage_limit => self::STATUS_EXHAUSTED,
            default => self::STATUS_ACTIVE,
        };
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status()];
    }

    /** Besar potongan untuk sebuah nominal (rupiah bulat, tidak pernah melebihi nominal). */
    public function discountFor(int $amount): int
    {
        if ($amount <= 0) {
            return 0;
        }

        $raw = $this->discount_type === self::TYPE_PERCENTAGE
            ? intdiv($amount * $this->discount_value, 100)
            : $this->discount_value;

        return max(0, min($amount, $raw));
    }

    public function discountLabel(): string
    {
        return $this->discount_type === self::TYPE_PERCENTAGE
            ? "{$this->discount_value}%"
            : 'Rp '.number_format($this->discount_value, 0, ',', '.');
    }

    public function auditLabel(): string
    {
        return $this->code;
    }

    // ------------------------------------------------------------------ query

    public function scopeOwnedByAdmin(Builder $query): Builder
    {
        return $query->where('coupons.owner_type', self::OWNER_ADMIN);
    }

    /** Menyaring berdasarkan status efektif; urutan prioritas sama dengan status(). */
    public function scopeWithStatus(Builder $query, string $status): Builder
    {
        $used = '(select count(*) from coupon_redemptions where coupon_redemptions.coupon_id = coupons.id)';
        $now = now();

        $notExpired = fn (Builder $q) => $q->whereNull('coupons.expires_at')->orWhere('coupons.expires_at', '>', $now);

        return match ($status) {
            self::STATUS_INACTIVE => $query->where('coupons.is_active', false),
            self::STATUS_EXPIRED => $query->where('coupons.is_active', true)
                ->whereNotNull('coupons.expires_at')->where('coupons.expires_at', '<=', $now),
            self::STATUS_EXHAUSTED => $query->where('coupons.is_active', true)->where($notExpired)
                ->whereNotNull('coupons.usage_limit')->whereRaw("{$used} >= coupons.usage_limit"),
            self::STATUS_ACTIVE => $query->where('coupons.is_active', true)->where($notExpired)
                ->where(fn (Builder $q) => $q->whereNull('coupons.usage_limit')->orWhereRaw("{$used} < coupons.usage_limit")),
            default => $query,
        };
    }
}
