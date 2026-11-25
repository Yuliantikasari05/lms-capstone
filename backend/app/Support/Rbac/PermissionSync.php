<?php

namespace App\Support\Rbac;

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;

/**
 * Pengaman RBAC: mendeteksi izin yang belum tersinkron SEBELUM pengguna menemui 403.
 *
 * Kasus yang pernah terjadi: modul baru (kupon, gamifikasi, lembaga, pengaturan role) digabung
 * tetapi RolePermissionSeeder belum dijalankan ulang, sehingga baris permission-nya tidak ada di
 * database dan Admin kehilangan menu yang seharusnya tersedia.
 *
 * Dipakai oleh `php artisan lms:permissions:check` dan endpoint `GET /api/v1/health`.
 */
final class PermissionSync
{
    /**
     * @return array{
     *     ok: bool,
     *     expected_total: int,
     *     present_total: int,
     *     missing_permissions: array<int,string>,
     *     unseeded_permissions: array<int,string>,
     *     missing_roles: array<int,string>,
     *     required_gaps: array<string,array<int,string>>,
     *     role_gaps: array<string,array<int,string>>
     * }
     */
    public static function inspect(): array
    {
        $expected = array_keys(RolePermissionSeeder::PERMISSIONS);
        $present = Permission::pluck('slug')->all();
        $known = array_flip($present);

        $missingPermissions = array_values(array_filter($expected, fn (string $slug) => ! isset($known[$slug])));

        // Izin yang ditegakkan Catalog tetapi tidak pernah didefinisikan seeder = kode dan data tidak sejalan.
        $unseeded = array_values(array_filter(
            Catalog::enforcedSlugs(),
            fn (string $slug) => ! isset($known[$slug]) && ! in_array($slug, $expected, true),
        ));

        $missingRoles = [];
        $requiredGaps = [];
        $roleGaps = [];

        foreach (Catalog::SYSTEM_ROLES as $slug) {
            $role = Role::where('slug', $slug)->first();

            if ($role === null) {
                $missingRoles[] = $slug;

                continue;
            }

            $granted = $role->permissions()->pluck('slug')->all();

            $defaults = RolePermissionSeeder::MATRIX[$slug] ?? [];
            $gap = array_values(array_diff($defaults, $granted));
            if ($gap !== []) {
                // Bisa disengaja Admin lewat Pengaturan > Role & Akses: hanya peringatan.
                $roleGaps[$slug] = $gap;
            }

            $required = array_values(array_diff(Catalog::required($slug), $granted));
            if ($required !== []) {
                // Role terkunci dari halaman wajibnya sendiri: ini selalu kesalahan data.
                $requiredGaps[$slug] = $required;
            }
        }

        return [
            'ok' => $missingPermissions === []
                && $unseeded === []
                && $missingRoles === []
                && $requiredGaps === [],
            'expected_total' => count($expected),
            'present_total' => count($present),
            'missing_permissions' => $missingPermissions,
            'unseeded_permissions' => $unseeded,
            'missing_roles' => $missingRoles,
            'required_gaps' => $requiredGaps,
            'role_gaps' => $roleGaps,
        ];
    }
}
