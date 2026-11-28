<?php

namespace App\Policies;

use App\Models\CourseDiscussion;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Ubah/hapus topik diskusi: penulis sendiri, atau pengelola isi kursus
 * (Mentor pengampu, Lembaga pemilik program, Admin).
 */
class CourseDiscussionPolicy
{
    public function update(User $actor, CourseDiscussion $discussion): bool
    {
        return $this->owns($actor, $discussion) || $this->moderates($actor, $discussion);
    }

    public function delete(User $actor, CourseDiscussion $discussion): bool
    {
        return $this->owns($actor, $discussion) || $this->moderates($actor, $discussion);
    }

    private function owns(User $actor, CourseDiscussion $discussion): bool
    {
        return $discussion->user_id === $actor->id;
    }

    /**
     * Admin tetap boleh memoderasi forum Program Lembaga walau CoursePolicy melarangnya
     * mengubah konten program (blueprint: Admin dapat menghapus semua diskusi/balasan).
     */
    private function moderates(User $actor, CourseDiscussion $discussion): bool
    {
        if (! $actor->hasPermission('content.manage')) {
            return false;
        }

        return $actor->hasRole(Role::ADMIN)
            || Gate::forUser($actor)->allows('manageContent', $discussion->course);
    }
}
