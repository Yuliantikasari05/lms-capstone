<?php

namespace App\Models;

use Database\Factories\AssignmentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Tugas, kuis, atau ujian beserta soalnya. Diampu Mentor kursus, direview Admin (khusus ujian). */
class Assignment extends Model
{
    /** @use HasFactory<AssignmentFactory> */
    use HasFactory, SoftDeletes;

    public const KIND_TASK = 'task';
    public const KIND_QUIZ = 'quiz';
    public const KIND_EXAM = 'exam';

    public const KINDS = [self::KIND_TASK, self::KIND_QUIZ, self::KIND_EXAM];

    public const KIND_LABELS = [
        self::KIND_TASK => 'Tugas',
        self::KIND_QUIZ => 'Kuis',
        self::KIND_EXAM => 'Ujian',
    ];

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_REJECTED];

    public const STATUS_LABELS = [
        self::STATUS_DRAFT => 'Draf',
        self::STATUS_PENDING => 'Menunggu persetujuan',
        self::STATUS_APPROVED => 'Tersedia',
        self::STATUS_REJECTED => 'Ditolak',
    ];

    protected $fillable = [
        'course_id', 'title', 'description', 'kind', 'starts_at', 'due_at', 'max_score',
        'allow_late', 'late_penalty', 'xp_points', 'status', 'review_note', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'due_at' => 'datetime',
            'allow_late' => 'boolean',
            'is_active' => 'boolean',
            'reviewed_at' => 'datetime',
            'max_score' => 'integer',
            'late_penalty' => 'integer',
            'xp_points' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by')->withTrashed();
    }

    public function questions(): HasMany
    {
        return $this->hasMany(AssignmentQuestion::class)->orderBy('position')->orderBy('id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(AssignmentSubmission::class)->orderByDesc('submitted_at');
    }

    public function kindLabel(): string
    {
        return self::KIND_LABELS[$this->kind] ?? $this->kind;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    public function auditLabel(): string
    {
        return $this->title;
    }
}
