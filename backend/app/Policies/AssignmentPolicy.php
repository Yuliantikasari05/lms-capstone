<?php

namespace App\Policies;

use App\Models\Assignment;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;

/**
 * Aturan akses tugas/kuis/ujian. Satu izin = satu aksi, ditambah batas kepemilikan kursus
 * (Mentor hanya kursus yang diampu; Admin semua; Lembaga program miliknya).
 */
class AssignmentPolicy
{
    public function view(User $actor, Assignment $assignment): bool
    {
        return $actor->hasPermission('assignments.view') && $this->canSee($actor, $assignment->course);
    }

    public function create(User $actor, Course $course): bool
    {
        return $actor->hasPermission('assignments.manage') && $this->canSee($actor, $course);
    }

    public function manage(User $actor, Assignment $assignment): bool
    {
        return $actor->hasPermission('assignments.manage') && $this->canSee($actor, $assignment->course);
    }

    public function grade(User $actor, Assignment $assignment): bool
    {
        return $actor->hasPermission('assignments.grade') && $this->canSee($actor, $assignment->course);
    }

    /** Review hanya untuk yang punya izin khusus (Admin); Mentor tidak menyetujui ujiannya sendiri. */
    public function review(User $actor, Assignment $assignment): bool
    {
        return $actor->hasPermission('assignments.review') && $this->canSee($actor, $assignment->course);
    }

    private function canSee(User $actor, ?Course $course): bool
    {
        if ($course === null || $course->trashed()) {
            return false;
        }

        return $actor->hasRole(Role::ADMIN) || $course->isOwnedBy($actor);
    }
}
