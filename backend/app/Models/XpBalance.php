<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Saldo XP satu Siswa. Hanya diubah oleh XpService bersama buku besarnya. */
class XpBalance extends Model
{
    public const CREATED_AT = null;

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = [];

    protected function casts(): array
    {
        return ['total_xp' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
