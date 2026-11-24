<?php

namespace App\Policies;

use App\Models\Institution;
use App\Models\User;

/** Aturan akses Lembaga Bimbingan: permission umum per aksi. Pencairan dana punya izin tersendiri. */
class InstitutionPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('institutions.view');
    }

    public function view(User $actor, Institution $institution): bool
    {
        return $actor->hasPermission('institutions.view');
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission('institutions.create');
    }

    public function update(User $actor, Institution $institution): bool
    {
        return $actor->hasPermission('institutions.update');
    }

    public function delete(User $actor, Institution $institution): bool
    {
        return $actor->hasPermission('institutions.delete');
    }

    /** Memulihkan lembaga yang dihapus memakai izin yang sama dengan menghapus. */
    public function restore(User $actor, Institution $institution): bool
    {
        return $actor->hasPermission('institutions.delete');
    }

    /** Mengajukan dan memproses pencairan dana (uang keluar): izin terpisah dari mengubah profil. */
    public function managePayouts(User $actor, Institution $institution): bool
    {
        return $actor->hasPermission('institutions.payout');
    }
}
