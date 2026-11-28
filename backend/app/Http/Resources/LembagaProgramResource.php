<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Kartu Program Lembaga: ringkasan untuk dashboard, kelola modul, jelajahi, dan laporan.
 *
 * @mixin \App\Models\Course
 */
class LembagaProgramResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'category' => $this->category,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'price' => (int) ($this->price ?? 0),
            'discount_price' => $this->discount_price,
            'price_label' => $this->priceLabel(),
            'is_free' => $this->isFree(),
            'modules_count' => $this->whenCounted('modules'),
            'sessions_count' => $this->whenCounted('sessions'),
            'students_count' => $this->whenHas('participants_count'),
            'sold_count' => (int) ($this->sold_count ?? 0),
            'revenue' => (int) ($this->revenue ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
