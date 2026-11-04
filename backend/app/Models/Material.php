<?php

namespace App\Models;

use Database\Factories\MaterialFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Material extends Model
{
    /** @use HasFactory<MaterialFactory> */
    use HasFactory, SoftDeletes;

    public const TYPE_VIDEO = 'video';
    public const TYPE_PDF = 'pdf';
    public const TYPE_DOCUMENT = 'document';
    public const TYPE_LINK = 'link';

    public const TYPES = [self::TYPE_VIDEO, self::TYPE_PDF, self::TYPE_DOCUMENT, self::TYPE_LINK];

    public const TYPE_LABELS = [
        self::TYPE_VIDEO => 'Video',
        self::TYPE_PDF => 'PDF',
        self::TYPE_DOCUMENT => 'Dokumen',
        self::TYPE_LINK => 'Tautan',
    ];

    protected $fillable = [
        'title', 'description', 'type', 'external_url', 'duration_minutes', 'xp_points', 'position',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'duration_minutes' => 'integer',
            'xp_points' => 'integer',
            'position' => 'integer',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'course_module_id')->withTrashed();
    }

    public function hasFile(): bool
    {
        return $this->file_path !== null && $this->file_path !== '';
    }

    public function auditLabel(): string
    {
        return $this->title;
    }
}
