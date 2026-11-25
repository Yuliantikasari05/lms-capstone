<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Assignment */
class AssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'course_id' => $this->course_id,
            'course' => $this->whenLoaded('course', fn () => [
                'id' => $this->course->id,
                'title' => $this->course->title,
                'type' => $this->course->type,
                'type_label' => $this->course->typeLabel(),
            ]),
            'title' => $this->title,
            'description' => $this->description,
            'kind' => $this->kind,
            'kind_label' => $this->kindLabel(),
            'format' => $this->relationLoaded('questions') ? AssignmentQuestionResource::formatOf($this->questions) : null,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'is_active' => $this->is_active,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'due_at' => $this->due_at?->toIso8601String(),
            'max_score' => $this->max_score,
            'allow_late' => $this->allow_late,
            'late_penalty' => $this->late_penalty,
            'xp_points' => $this->xp_points,
            'review_note' => $this->review_note,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'questions' => AssignmentQuestionResource::collection($this->whenLoaded('questions')),
            'questions_count' => $this->whenCounted('questions'),
            'submissions_count' => $this->whenCounted('submissions'),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
