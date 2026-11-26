<?php

namespace App\Models;

use Database\Factories\ClassSessionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Sesi belajar online. Tabel: class_sessions (bukan "sessions", yang dipakai Laravel untuk login). */
class ClassSession extends Model
{
    /** @use HasFactory<ClassSessionFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'class_sessions';

    public const MODE_ONLINE = 'online';
    public const MODE_OFFLINE = 'offline';

    public const MODES = [self::MODE_ONLINE, self::MODE_OFFLINE];

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_SCHEDULED, self::STATUS_CANCELLED];

    public const STATUS_LABELS = [
        self::STATUS_DRAFT => 'Draft',
        self::STATUS_SCHEDULED => 'Terjadwal',
        self::STATUS_CANCELLED => 'Dibatalkan',
    ];

    protected $fillable = [
        'title', 'description', 'starts_at', 'ends_at', 'meeting_url', 'mode', 'location', 'status', 'cancellation_reason',
    ];

    /** Nilai bawaan juga untuk instance baru (sebelum diambil ulang dari database). */
    protected $attributes = [
        'mode' => self::MODE_ONLINE,
        'status' => self::STATUS_SCHEDULED,
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    /** Tipe sesi mengikuti jenis kursus: akademik = Kelas, pelatihan = Pelatihan, webinar = Webinar. */
    public function typeLabel(): string
    {
        return match ($this->course->type) {
            Course::TYPE_TRAINING => 'Pelatihan',
            Course::TYPE_WEBINAR => 'Webinar',
            default => 'Kelas',
        };
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? self::STATUS_LABELS[self::STATUS_SCHEDULED];
    }

    /** Sesi tatap muka tidak memakai tautan meeting. */
    public function isOffline(): bool
    {
        return $this->mode === self::MODE_OFFLINE;
    }

    /** upcoming = belum mulai, ongoing = sedang berlangsung, finished = sudah selesai. */
    public function timeStatus(): string
    {
        $now = now();

        return match (true) {
            $now->lt($this->starts_at) => 'upcoming',
            $now->gt($this->ends_at) => 'finished',
            default => 'ongoing',
        };
    }

    public function auditLabel(): string
    {
        return $this->title;
    }
}
