<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Jawaban peserta untuk satu soal. */
class AssignmentAnswer extends Model
{
    protected $fillable = [
        'submission_id', 'question_id', 'answer_text', 'selected_option_ids', 'file_name', 'points_awarded',
    ];

    protected function casts(): array
    {
        return [
            'selected_option_ids' => 'array',
            'points_awarded' => 'integer',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(AssignmentSubmission::class, 'submission_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(AssignmentQuestion::class, 'question_id');
    }
}
