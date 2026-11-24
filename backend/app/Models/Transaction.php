<?php

namespace App\Models;

use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu transaksi pembelian. Pembagian hasil dicatat saat transaksi (tidak berubah mengikuti pengaturan). */
class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    public const STATUS_PAID = 'paid';
    public const STATUS_REFUNDED = 'refunded';

    public const STATUSES = [self::STATUS_PAID, self::STATUS_REFUNDED];

    /** Hanya pengisian lewat InstitutionRevenueService; tidak ada mass assignment dari request. */
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'integer',
            'discount_amount' => 'integer',
            'net_amount' => 'integer',
            'institution_share_percent' => 'integer',
            'institution_amount' => 'integer',
            'platform_amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class)->withTrashed();
    }

    public function scopePaid($query)
    {
        return $query->where('transactions.status', self::STATUS_PAID);
    }
}
