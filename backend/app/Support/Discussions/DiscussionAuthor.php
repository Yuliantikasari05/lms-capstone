<?php

namespace App\Support\Discussions;

use App\Models\User;

/** Bentuk data penulis diskusi yang dipakai semua resource forum. */
final class DiscussionAuthor
{
    /** @return array{id: int, name: string, role: string, initials: string}|null */
    public static function payload(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->roles->first()?->name ?? 'Pengguna',
            'initials' => self::initials($user->name),
        ];
    }

    private static function initials(string $name): string
    {
        $words = preg_split('/\s+/', trim($name)) ?: [];
        $initials = mb_substr($words[0] ?? '', 0, 1).mb_substr($words[1] ?? '', 0, 1);

        return mb_strtoupper($initials !== '' ? $initials : mb_substr($name, 0, 2));
    }
}
