<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu hari aktif (kalender WIB) seorang peserta, dicatat saat login pertama hari itu. */
class LearningDay extends Model
{
    protected $fillable = ['user_id', 'day'];

    protected function casts(): array
    {
        return ['day' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
