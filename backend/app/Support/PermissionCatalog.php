<?php

namespace App\Support;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Support\Collection;

/**
 * Katalog izin untuk layar Pengaturan > Role & Akses: mengelompokkan permission per modul dan menandai
 * aksinya (lihat, tambah, ubah, hapus, lainnya) sehingga frontend dapat menggambar matriks C/R/U/D.
 * Pengelompokan berdasarkan awalan slug; permission baru tanpa pemetaan masuk kelompok "Lainnya".
 */
final class PermissionCatalog
{
    /** Awalan slug => nama modul (urutan tampil). */
    public const MODULES = [
        'dashboard' => 'Dashboard',
        'users' => 'Manajemen Pengguna',
        'audit' => 'Manajemen Pengguna',
        'courses' => 'Kurikulum dan Kursus',
        'content' => 'Kurikulum dan Kursus',
        'enrollments' => 'Kurikulum dan Kursus',
        'coupons' => 'Kupon',
        'gamification' => 'Gamifikasi dan XP',
        'institutions' => 'Lembaga Bimbingan',
        'roles' => 'Pengaturan',
    ];

    /** Hanya boleh dimiliki role Admin: kendali akun, riwayat aktivitas, dan hak akses itu sendiri. */
    public const ADMIN_ONLY = ['roles.view', 'roles.manage', 'audit.view', 'users.reset_password', 'dashboard.admin'];

    private const ACTIONS = ['view' => 'read', 'create' => 'create', 'update' => 'update', 'delete' => 'delete'];

    /** Izin dashboard milik role itu sendiri tidak boleh dicabut dari role sistem (agar halaman utamanya tetap bisa dibuka). */
    public static function requiredFor(Role $role): array
    {
        return in_array($role->slug, Role::ALL, true) ? ["dashboard.{$role->slug}"] : [];
    }

    public static function isAdminOnly(string $slug): bool
    {
        return in_array($slug, self::ADMIN_ONLY, true);
    }

    public static function moduleOf(string $slug): string
    {
        return self::MODULES[explode('.', $slug)[0]] ?? 'Lainnya';
    }

    /** "read" untuk .view dan dashboard.*, "create"/"update"/"delete" menurut akhiran, selain itu "other". */
    public static function actionOf(string $slug): string
    {
        [$prefix, $suffix] = array_pad(explode('.', $slug, 2), 2, '');

        return $prefix === 'dashboard' ? 'read' : (self::ACTIONS[$suffix] ?? 'other');
    }

    /** @return Collection<int, array{module: string, permissions: array<int, array<string,mixed>>}> */
    public static function grouped(): Collection
    {
        $order = array_values(array_unique(array_values(self::MODULES)));

        return Permission::query()->orderBy('slug')->get()
            ->map(fn (Permission $p) => [
                'slug' => $p->slug,
                'name' => $p->name,
                'module' => self::moduleOf($p->slug),
                'action' => self::actionOf($p->slug),
                'admin_only' => self::isAdminOnly($p->slug),
            ])
            ->groupBy('module')
            ->map(fn (Collection $items, string $module) => ['module' => $module, 'permissions' => $items->values()->all()])
            ->sortBy(fn (array $group) => ($i = array_search($group['module'], $order, true)) === false ? PHP_INT_MAX : $i)
            ->values();
    }
}
