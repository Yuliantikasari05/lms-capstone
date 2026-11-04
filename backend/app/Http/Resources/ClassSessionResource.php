<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/** @mixin \App\Models\ClassSession */
class ClassSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $course = $this->course;
        $user = $request->user();

        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'title' => $this->title,
            // Tipe mengikuti jenis kursus; instruktur = Mentor kursus (keputusan 6).
            'type' => match ($course->type) {
                \App\Models\Course::TYPE_TRAINING => 'training',
                \App\Models\Course::TYPE_WEBINAR => 'webinar',
                default => 'class',
            },
            'type_label' => $this->typeLabel(),
            'instructor' => $course->mentor ? ['id' => $course->mentor->id, 'name' => $course->mentor->name] : null,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'status' => $this->timeStatus(),
            // Link meeting hanya untuk yang berhak mengelola. Peserta mengambilnya lewat endpoint tersendiri
            // (dengan aturan jendela waktu) pada tahap 2b.
            'meeting_url' => $this->when($user && Gate::forUser($user)->allows('manageContent', $course), $this->meeting_url),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
