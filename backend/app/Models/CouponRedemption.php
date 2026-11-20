<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu kali pemakaian kupon oleh satu pengguna. */
class CouponRedemption extends Model
{
    public $timestamps = false;

    protected $fillable = ['reference', 'original_amount', 'discount_amount'];

    protected function casts(): array
    {
        return [
            'original_amount' => 'integer',
            'discount_amount' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }
}
