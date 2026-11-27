<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Menit belajar satu peserta pada satu kursus per tanggal (dari sinyal 1 menit). */
class StudyLog extends Model
{
    protected $fillable = ['user_id', 'course_id', 'studied_on', 'minutes'];

    protected function casts(): array
    {
        return [
            'studied_on' => 'date',
            'minutes' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}
