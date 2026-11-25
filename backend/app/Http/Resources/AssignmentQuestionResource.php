<?php

namespace App\Http\Resources;

use App\Models\AssignmentQuestion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AssignmentQuestion */
class AssignmentQuestionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => $this->typeLabel(),
            'prompt' => $this->prompt,
            'options' => $this->options ?? [],
            'correct_option_ids' => $this->correct_option_ids ?? [],
            'multi_select' => $this->multi_select,
            'max_words' => $this->max_words,
            'allowed_file_types' => $this->allowed_file_types ?? [],
            'max_file_size_mb' => $this->max_file_size_mb,
            'max_files' => $this->max_files,
            'points' => $this->points,
            'position' => $this->position,
        ];
    }

    /** Format soal yang dipakai UI: satu tipe bila seragam, "Mix" bila campuran. */
    public static function formatOf(iterable $questions): string
    {
        $types = collect($questions)->pluck('type')->unique()->values();

        if ($types->count() !== 1) {
            return 'Mix';
        }

        return match ($types->first()) {
            AssignmentQuestion::TYPE_ESSAY => 'Essay',
            AssignmentQuestion::TYPE_MULTIPLE_CHOICE => 'Pilihan ganda',
            AssignmentQuestion::TYPE_FILE => 'Upload file',
            default => 'Mix',
        };
    }
}
