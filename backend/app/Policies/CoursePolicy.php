<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Aturan akses kursus (dua lapis, sesuai docs): permission umum + kepemilikan data.
 *
 * - Admin: semua kursus, KECUALI Program Lembaga yang hanya dibaca (diubah oleh lembaganya; persetujuan XP di tahap 4).
 * - Mentor: hanya kursus yang diampunya (permission diberikan saat halaman Mentor dikerjakan).
 * - Lembaga: hanya program miliknya (tahap 4).
 * - Siswa/Karyawan: akses baca konten untuk kursus yang diikuti, diatur di tahap 2b (belum di sini).
 */
class CoursePolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('courses.view');
    }

    public function view(User $actor, Course $course): bool
    {
        return $actor->hasPermission('courses.view') && $this->canSee($actor, $course);
    }

    /** Melihat isi kursus (modul, materi, unduh file). Aturan peserta ditambahkan di tahap 2b. */
    public function viewContent(User $actor, Course $course): bool
    {
        return $this->view($actor, $course);
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission('courses.create');
    }

    public function update(User $actor, Course $course): Response
    {
        return $this->allow($actor, $course, 'courses.update');
    }

    public function delete(User $actor, Course $course): Response
    {
        return $this->allow($actor, $course, 'courses.delete');
    }

    /** Mengganti/menetapkan Mentor: khusus yang punya izin (Admin). */
    public function assignMentor(User $actor, Course $course): Response
    {
        return $this->allow($actor, $course, 'courses.assign_mentor');
    }

    /** Modul, materi, dan sesi. */
    public function manageContent(User $actor, Course $course): Response
    {
        return $this->allow($actor, $course, 'content.manage');
    }

    /** Pendaftaran peserta (Admin). */
    public function manageEnrollments(User $actor, Course $course): Response
    {
        return $this->allow($actor, $course, 'enrollments.manage');
    }

    // ------------------------------------------------------------------ pembantu

    private function canSee(User $actor, Course $course): bool
    {
        return $actor->hasRole(Role::ADMIN) || $course->isOwnedBy($actor);
    }

    private function allow(User $actor, Course $course, string $permission): Response
    {
        if (! $actor->hasPermission($permission)) {
            return Response::deny();
        }

        if ($course->isInstitutionProgram()) {
            return $course->isOwnedBy($actor)
                ? Response::allow()
                : Response::deny('Program Lembaga hanya dapat diubah oleh lembaganya.');
        }

        return $actor->hasRole(Role::ADMIN) || $course->isOwnedBy($actor)
            ? Response::allow()
            : Response::deny('Anda hanya dapat mengelola kursus yang Anda ampu.');
    }
}
