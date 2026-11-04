<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\Course */
class CourseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => $this->typeLabel(),
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'mentor' => $this->whenLoaded('mentor', fn () => $this->mentor
                ? ['id' => $this->mentor->id, 'name' => $this->mentor->name, 'deleted' => $this->mentor->trashed()]
                : null),
            'created_by' => $this->created_by,
            // Ringkasan untuk kartu kursus. participants_count = peserta dengan pendaftaran aktif.
            'modules_count' => $this->whenCounted('modules'),
            'sessions_count' => $this->whenCounted('sessions'),
            'participants_count' => $this->whenHas('participants_count'),
            // Apa yang boleh dilakukan pengguna ini pada kursus ini (frontend menonaktifkan tombol sesuai ini;
            // backend tetap yang menentukan).
            'abilities' => $user ? [
                'update' => Gate::forUser($user)->allows('update', $this->resource),
                'delete' => Gate::forUser($user)->allows('delete', $this->resource),
                'assign_mentor' => Gate::forUser($user)->allows('assignMentor', $this->resource),
                'manage_content' => Gate::forUser($user)->allows('manageContent', $this->resource),
                'manage_enrollments' => Gate::forUser($user)->allows('manageEnrollments', $this->resource),
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
