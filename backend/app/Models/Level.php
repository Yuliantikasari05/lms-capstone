<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/** Level: nama dan batas XP minimal, diatur Admin. */
class Level extends Model
{
    protected $fillable = ['name', 'min_xp'];

    protected function casts(): array
    {
        return ['min_xp' => 'integer'];
    }

    /**
     * Level tertinggi yang batasnya sudah tercapai; null bila belum ada level yang tercapai
     * (atau belum ada level sama sekali).
     *
     * @param  Collection<int, Level>  $levels  boleh dalam urutan apa pun
     */
    public static function resolve(Collection $levels, int $xp): ?self
    {
        return $levels->where('min_xp', '<=', $xp)->sortByDesc('min_xp')->first();
    }

    public function auditLabel(): string
    {
        return $this->name;
    }
}
