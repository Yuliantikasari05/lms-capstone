<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Pengumpulan tugas oleh satu peserta. */
class AssignmentSubmission extends Model
{
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_GRADED = 'graded';

    public const STATUSES = [self::STATUS_SUBMITTED, self::STATUS_GRADED];

    protected $fillable = ['assignment_id', 'user_id', 'submitted_at', 'status', 'score', 'feedback', 'graded_by', 'graded_at'];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'graded_at' => 'datetime',
            'score' => 'integer',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function grader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'graded_by')->withTrashed();
    }

    public function answers(): HasMany
    {
        return $this->hasMany(AssignmentAnswer::class, 'submission_id');
    }
}
