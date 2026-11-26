<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Satu soal pada tugas/kuis/ujian. */
class AssignmentQuestion extends Model
{
    public const TYPE_MULTIPLE_CHOICE = 'multiple_choice';
    public const TYPE_ESSAY = 'essay';
    public const TYPE_FILE = 'file_upload';

    public const TYPES = [self::TYPE_MULTIPLE_CHOICE, self::TYPE_ESSAY, self::TYPE_FILE];

    public const TYPE_LABELS = [
        self::TYPE_MULTIPLE_CHOICE => 'Pilihan ganda',
        self::TYPE_ESSAY => 'Essay',
        self::TYPE_FILE => 'Upload file',
    ];

    protected $fillable = [
        'type', 'prompt', 'options', 'correct_option_ids', 'multi_select', 'max_words',
        'allowed_file_types', 'max_file_size_mb', 'max_files', 'points', 'position',
    ];

    protected function casts(): array
    {
        return [
            'options' => 'array',
            'correct_option_ids' => 'array',
            'allowed_file_types' => 'array',
            'multi_select' => 'boolean',
            'max_words' => 'integer',
            'max_file_size_mb' => 'integer',
            'max_files' => 'integer',
            'points' => 'integer',
            'position' => 'integer',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    public function typeLabel(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }
}
