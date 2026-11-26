<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssignmentAnswer */
class AssignmentAnswerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'question_id' => $this->question_id,
            'answer_text' => $this->answer_text,
            'selected_option_ids' => $this->selected_option_ids ?? [],
            'file_name' => $this->file_name,
            'points_awarded' => $this->points_awarded,
            'question' => $this->whenLoaded('question', fn () => [
                'id' => $this->question->id,
                'type' => $this->question->type,
                'type_label' => $this->question->typeLabel(),
                'prompt' => $this->question->prompt,
                'options' => $this->question->options ?? [],
                'correct_option_ids' => $this->question->correct_option_ids ?? [],
                'points' => $this->question->points,
                'position' => $this->question->position,
            ]),
        ];
    }
}
