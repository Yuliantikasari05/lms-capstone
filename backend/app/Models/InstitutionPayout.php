<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu pencairan dana ke Lembaga. */
class InstitutionPayout extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_PENDING, self::STATUS_COMPLETED, self::STATUS_CANCELLED];

    public const STATUS_LABELS = [
        self::STATUS_PENDING => 'Menunggu',
        self::STATUS_COMPLETED => 'Selesai',
        self::STATUS_CANCELLED => 'Dibatalkan',
    ];

    /** Status yang menahan saldo (dana sedang/sudah keluar). */
    public const HOLDING_STATUSES = [self::STATUS_PENDING, self::STATUS_COMPLETED];

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'processed_at' => 'datetime',
        ];
    }

    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class)->withTrashed();
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by')->withTrashed();
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by')->withTrashed();
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /** Contoh: "BCA ····7810 (Bimbel CN)". */
    public function destinationLabel(): ?string
    {
        if (blank($this->bank_name)) {
            return null;
        }

        return "{$this->bank_name} ····{$this->bank_account_last4} ({$this->bank_account_holder})";
    }

    public function auditLabel(): string
    {
        return $this->code;
    }
}
