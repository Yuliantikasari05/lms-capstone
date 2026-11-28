<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Balasan pada sebuah topik diskusi kursus. */
class CourseDiscussionReply extends Model
{
    protected $fillable = ['body'];

    public function discussion(): BelongsTo
    {
        return $this->belongsTo(CourseDiscussion::class, 'course_discussion_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }
}
