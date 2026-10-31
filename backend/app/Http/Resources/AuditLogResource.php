<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AuditLog */
class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'actor' => [
                'id' => $this->actor_id,
                'name' => $this->actor_name,
                'email' => $this->actor_email,
            ],
            'target' => [
                'type' => $this->target_type,
                'id' => $this->target_id,
                'label' => $this->target_label,
            ],
            'changes' => $this->changes,
            'ip_address' => $this->ip_address,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
