<?php

namespace App\Support\Notifications;

use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Penentu penerima notifikasi.
 *
 * Penerima selalu ditentukan dari IZIN dan KEPEMILIKAN data, bukan dari daftar role yang ditulis
 * tetap: mematikan izin di Pengaturan > Role & Akses otomatis menghentikan notifikasi terkait,
 * dan notifikasi kursus hanya sampai ke Mentor yang benar-benar mengampu kursus itu.
 */
final class NotificationRecipients
{
    /**
     * Akun aktif yang memegang izin tertentu (mis. hanya pemegang `assignments.review` yang
     * diberi tahu soal ujian menunggu review). Aktor tidak pernah menerima notifikasinya sendiri.
     *
     * $roleSlugs mempersempit penerima ke role tertentu: izin yang sama bisa dimiliki beberapa role,
     * sedangkan notifikasinya hanya relevan untuk satu role (mis. kursus baru untuk Admin saja).
     *
     * @param  array<int,string>  $roleSlugs
     * @return Collection<int,User>
     */
    public static function withPermission(string $permission, ?User $except = null, array $roleSlugs = []): Collection
    {
        return User::query()
            ->where('status', User::STATUS_ACTIVE)
            ->whereHas('roles.permissions', fn ($query) => $query->where('slug', $permission))
            ->when($roleSlugs !== [], fn ($query) => $query->whereHas('roles', fn ($roles) => $roles->whereIn('slug', $roleSlugs)))
            ->when($except !== null, fn ($query) => $query->whereKeyNot($except->getKey()))
            ->get();
    }

    /** Mentor pengampu kursus yang berhak atas aksi terkait; null bila tidak ada atau izinnya mati. */
    public static function courseMentor(Course $course, string $permission, ?User $except = null): ?User
    {
        $mentor = $course->mentor;

        if ($mentor === null
            || ! $mentor->isActive()
            || ($except !== null && $mentor->is($except))
            || ! $mentor->hasPermission($permission)) {
            return null;
        }

        return $mentor;
    }

    /**
     * Pemilik Program Lembaga (akun Lembaga pembuat program) bila masih aktif dan berhak.
     * Dipakai mis. saat peserta baru didaftarkan ke program miliknya.
     */
    public static function institutionOwner(Course $course, string $permission, ?User $except = null): ?User
    {
        if (! $course->isInstitutionProgram()) {
            return null;
        }

        $owner = $course->creator;

        if ($owner === null
            || ! $owner->isActive()
            || ! $owner->hasRole(Role::LEMBAGA)
            || ($except !== null && $owner->is($except))
            || ! $owner->hasPermission($permission)) {
            return null;
        }

        return $owner;
    }
}
