<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\XpTransaction */
class XpTransactionResource extends JsonResource
{
    public const SOURCE_LABELS = [
        'material' => 'Materi diselesaikan',
        'task' => 'Tugas dikumpulkan',
        'exam' => 'Ujian',
        'adjustment' => 'Koreksi Admin',
        'reset' => 'Reset XP',
    ];

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'amount' => $this->amount,
            'source_type' => $this->source_type,
            'source_label' => self::SOURCE_LABELS[$this->source_type] ?? $this->source_type,
            'source_id' => $this->source_id,
            'reason' => $this->reason,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
