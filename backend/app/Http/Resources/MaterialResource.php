<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Material */
class MaterialResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'module_id' => $this->course_module_id,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'type_label' => \App\Models\Material::TYPE_LABELS[$this->type] ?? $this->type,
            'external_url' => $this->external_url,
            // Path penyimpanan TIDAK pernah dikirim. File diunduh lewat GET /materials/{id}/file.
            'has_file' => $this->hasFile(),
            'file' => $this->hasFile()
                ? ['name' => $this->file_name, 'size' => $this->file_size, 'mime_type' => $this->mime_type]
                : null,
            'duration_minutes' => $this->duration_minutes,
            'xp_points' => $this->xp_points,
            'position' => $this->position,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
