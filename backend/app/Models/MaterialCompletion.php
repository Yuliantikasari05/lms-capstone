<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu materi yang sudah diselesaikan seorang peserta. */
class MaterialCompletion extends Model
{
    protected $fillable = ['user_id', 'material_id', 'completed_at', 'xp_awarded'];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'xp_awarded' => 'integer',
        ];
    }

    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
