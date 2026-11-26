<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssignmentSubmission */
class AssignmentSubmissionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'assignment_id' => $this->assignment_id,
            'assignment' => $this->whenLoaded('assignment', fn () => [
                'id' => $this->assignment->id,
                'title' => $this->assignment->title,
                'kind' => $this->assignment->kind,
                'kind_label' => $this->assignment->kindLabel(),
                'course_id' => $this->assignment->course_id,
                'course_title' => $this->assignment->course?->title,
                'course_type' => $this->assignment->course?->type,
            ]),
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ]),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'status' => $this->status,
            'status_label' => $this->status === \App\Models\AssignmentSubmission::STATUS_GRADED ? 'Sudah dinilai' : 'Belum dinilai',
            'score' => $this->score,
            'feedback' => $this->feedback,
            'graded_at' => $this->graded_at?->toIso8601String(),
            'answers' => AssignmentAnswerResource::collection($this->whenLoaded('answers')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
