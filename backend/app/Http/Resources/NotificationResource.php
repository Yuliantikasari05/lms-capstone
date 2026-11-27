<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Illuminate\Notifications\DatabaseNotification */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = is_array($this->data) ? $this->data : [];

        return [
            'id' => $this->id,
            'category' => $data['category'] ?? 'system',
            'title' => $data['title'] ?? '',
            'message' => $data['message'] ?? '',
            'actor_name' => $data['actor_name'] ?? 'Sistem',
            'actor_role' => $data['actor_role'] ?? 'Sistem',
            'action_label' => $data['action_label'] ?? null,
            'href' => $data['href'] ?? null,
            'is_read' => $this->read_at !== null,
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
