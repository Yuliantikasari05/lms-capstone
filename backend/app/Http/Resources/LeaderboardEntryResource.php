<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Satu baris papan peringkat. Atribut xp, rank, dan level_data diisi LeaderboardService. */
class LeaderboardEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'rank' => $this->rank,
            'user' => ['id' => $this->id, 'name' => $this->name, 'email' => $this->email],
            'xp' => (int) $this->xp,
            'level' => $this->level_data,
        ];
    }
}
