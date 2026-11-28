<?php

namespace App\Policies;

use App\Models\CourseDiscussionReply;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/** Balasan: penulis sendiri, atau pengelola isi kursus (Mentor, Lembaga, Admin). */
class CourseDiscussionReplyPolicy
{
    public function update(User $actor, CourseDiscussionReply $reply): bool
    {
        return $this->owns($actor, $reply) || $this->moderates($actor, $reply);
    }

    public function delete(User $actor, CourseDiscussionReply $reply): bool
    {
        return $this->owns($actor, $reply) || $this->moderates($actor, $reply);
    }

    private function owns(User $actor, CourseDiscussionReply $reply): bool
    {
        return $reply->user_id === $actor->id;
    }

    /** Admin tetap boleh memoderasi balasan Program Lembaga (lihat CourseDiscussionPolicy). */
    private function moderates(User $actor, CourseDiscussionReply $reply): bool
    {
        if (! $actor->hasPermission('content.manage')) {
            return false;
        }

        return $actor->hasRole(Role::ADMIN)
            || Gate::forUser($actor)->allows('manageContent', $reply->discussion->course);
    }
}
