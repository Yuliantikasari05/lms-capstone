<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\Coupon */
class CouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $used = $this->usedCount();
        $user = $request->user();

        return [
            'id' => $this->id,
            'owner_type' => $this->owner_type,
            'name' => $this->name,
            'code' => $this->code,
            'discount_type' => $this->discount_type,
            'discount_type_label' => self::typeLabel($this->discount_type),
            'discount_value' => $this->discount_value,
            // Siap tampil: "50%" atau "Rp 50.000".
            'discount_label' => $this->discountLabel(),
            'usage_limit' => $this->usage_limit,
            'used_count' => $used,
            // Kolom "Penggunaan" di tabel: "0/1000" atau "12/∞" bila tanpa batas.
            'usage_label' => $used.'/'.($this->usage_limit ?? '∞'),
            'course' => $this->whenLoaded('course', fn () => $this->course ? ['id' => $this->course->id, 'title' => $this->course->title] : null),
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_active' => $this->is_active,
            // Status efektif (dihitung): active, inactive, expired, exhausted.
            'status' => $this->status($used),
            'status_label' => \App\Models\Coupon::STATUS_LABELS[$this->status($used)],
            'abilities' => $user ? [
                'update' => Gate::forUser($user)->allows('update', $this->resource),
                'delete' => Gate::forUser($user)->allows('delete', $this->resource),
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private static function typeLabel(string $type): string
    {
        return \App\Models\Coupon::TYPE_LABELS[$type] ?? $type;
    }
}
