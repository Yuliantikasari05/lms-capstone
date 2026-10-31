<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('users.view');
    }

    public function view(User $actor, User $target): bool
    {
        return $actor->hasPermission('users.view');
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission('users.create');
    }

    public function update(User $actor, User $target): bool
    {
        return $actor->hasPermission('users.update');
    }

    public function delete(User $actor, User $target): bool
    {
        // Tidak boleh menghapus akun sendiri.
        return $actor->hasPermission('users.delete') && ! $actor->is($target);
    }

    /** Memulihkan akun yang dihapus memakai permission yang sama dengan menghapus. */
    public function restore(User $actor, User $target): bool
    {
        return $actor->hasPermission('users.delete');
    }

    /** Reset kata sandi: izin khusus, dan tidak untuk akun sendiri (pakai "ganti kata sandi"). */
    public function resetPassword(User $actor, User $target): bool
    {
        return $actor->hasPermission('users.reset_password') && ! $actor->is($target);
    }

    public function export(User $actor): bool
    {
        return $actor->hasPermission('users.export');
    }
}
