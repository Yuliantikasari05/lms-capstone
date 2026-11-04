<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Enrollment */
class EnrollmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'user' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
                'status' => $this->user->status,
                // true bila akun peserta sudah dihapus (pendaftarannya tetap tercatat sebagai riwayat).
                'deleted' => $this->user->trashed(),
            ] : null),
            'status' => $this->status,
            'source' => $this->source,
            'enrolled_by' => $this->whenLoaded('enrolledBy', fn () => $this->enrolledBy?->name),
            'enrolled_at' => $this->enrolled_at?->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
        ];
    }
}
