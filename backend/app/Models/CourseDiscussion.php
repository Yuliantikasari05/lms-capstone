<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Satu topik diskusi pada forum kursus. */
class CourseDiscussion extends Model
{
    protected $fillable = ['title', 'body'];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    /** withTrashed: nama penulis tetap tampil walaupun akunnya sudah dihapus. */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function replies(): HasMany
    {
        return $this->hasMany(CourseDiscussionReply::class)->orderBy('id');
    }

    public function auditLabel(): string
    {
        return $this->title;
    }
}
