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

    protected $fillable = ['title', 'starts_at', 'ends_at', 'meeting_url'];

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
