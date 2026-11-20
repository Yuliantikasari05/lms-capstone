<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Satu baris buku besar XP. Tidak dapat diubah atau dihapus lewat aplikasi (append-only). */
class XpTransaction extends Model
{
    public $timestamps = false;

    protected $fillable = ['amount', 'source_type', 'source_id', 'reason'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'source_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Catatan XP tidak boleh diubah. Gunakan koreksi.'));
        static::deleting(fn () => throw new LogicException('Catatan XP tidak boleh dihapus. Gunakan koreksi.'));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}
