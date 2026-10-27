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
}
