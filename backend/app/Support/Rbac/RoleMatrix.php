<?php

namespace App\Support\Rbac;

use App\Models\Role;
use Illuminate\Validation\ValidationException;

/**
 * Mengubah katalog menjadi matriks siap tampil untuk SATU role (modul, aktivitas, sel C/R/U/D beserta statusnya)
 * dan memeriksa apakah daftar izin yang diajukan boleh dipasang pada role itu.
 */
final class RoleMatrix
{
    public const STATE_ON = 'on';
    public const STATE_OFF = 'off';
    /** Menyala dan tidak dapat dimatikan (izin wajib role). */
    public const STATE_LOCKED = 'locked';
    /** Ada di desain tetapi fiturnya belum dibangun: tidak dapat dinyalakan. */
    public const STATE_UNAVAILABLE = 'unavailable';
    /** Kolom ini tidak ada untuk aktivitas/role tersebut (sel kosong di hi-fi). */
    public const STATE_NA = 'na';

    /**
     * @param  array<int,string>  $granted  slug izin yang sedang dimiliki role
     * @return array<int, array<string,mixed>>
     */
    public static function forRole(string $roleSlug, array $granted): array
    {
        $roleKey = Catalog::keyOf($roleSlug);
        $required = Catalog::required($roleKey);
        $modules = [];

        // Slug yang dipakai lebih dari satu sel pada role ini (sel itu bergerak bersama).
        $usage = [];
        foreach (Catalog::activities() as $activity) {
            foreach ($activity['cells'] as $cell) {
                if ($cell['slug'] !== null && in_array($roleKey, $cell['roles'], true)) {
                    $usage[$cell['slug']] = ($usage[$cell['slug']] ?? 0) + 1;
                }
            }
        }

        foreach (Catalog::activities() as $activity) {
            if (! self::appliesTo($activity, $roleKey)) {
                continue;
            }

            [$label, $description] = $activity['labels'][$roleKey] ?? [$activity['label'], $activity['description']];
            $cells = [];
            foreach (Catalog::COLUMNS as $column) {
                $cells[] = self::cell($activity, $column, $roleKey, $granted, $required, $usage);
            }

            $modules[$activity['module']]['activities'][] = [
                'key' => $activity['key'],
                'label' => $label,
                'description' => $description,
                'status' => $activity['status'],
                'note' => $activity['note'],
                // "own" = hanya data milik sendiri (kursus yang diampu, program lembaga sendiri).
                'scope' => in_array($roleKey, $activity['own'], true) ? 'own' : 'all',
                'cells' => $cells,
            ];
        }

        $out = [];
        foreach (Catalog::modules() as $key => $name) {
            if (! isset($modules[$key])) {
                continue;
            }

            $editable = [];
            foreach ($modules[$key]['activities'] as $activity) {
                foreach ($activity['cells'] as $cell) {
                    if ($cell['editable']) {
                        $editable[$cell['slug']] = $cell['granted'];
                    }
                }
            }

            $out[] = [
                'key' => $key,
                'name' => $name,
                // Untuk sakelar "Semua": hidup bila SEMUA izin yang dapat diubah di modul ini sudah menyala.
                'editable_count' => count($editable),
                'granted_count' => count(array_filter($editable)),
                'all_granted' => $editable !== [] && ! in_array(false, $editable, true),
                'activities' => $modules[$key]['activities'],
            ];
        }

        return $out;
    }

    /**
     * Katalog umum (tanpa status role): untuk layar yang butuh seluruh daftar aktivitas dan role penerimanya.
     *
     * @return array<int, array<string,mixed>>
     */
    public static function catalog(): array
    {
        $names = \App\Models\Permission::query()->pluck('name', 'slug');
        $modules = [];

        foreach (Catalog::activities() as $activity) {
            $cells = [];
            foreach (Catalog::COLUMNS as $column) {
                $cell = $activity['cells'][$column] ?? null;
                $cells[] = [
                    'action' => $column,
                    'slug' => $cell['slug'] ?? null,
                    'name' => isset($cell['slug']) ? ($names[$cell['slug']] ?? null) : null,
                    'roles' => $cell['roles'] ?? [],
                    'sensitive' => isset($cell['slug']) && Catalog::isSensitive($cell['slug']),
                ];
            }

            $modules[$activity['module']][] = [
                'key' => $activity['key'], 'label' => $activity['label'], 'description' => $activity['description'],
                'status' => $activity['status'], 'note' => $activity['note'], 'cells' => $cells,
            ];
        }

        $out = [];
        foreach (Catalog::modules() as $key => $name) {
            if (isset($modules[$key])) {
                $out[] = ['key' => $key, 'name' => $name, 'activities' => $modules[$key]];
            }
        }

        return $out;
    }

    /**
     * Memeriksa daftar izin yang akan dipasang pada role. Melempar ValidationException (422) dengan pesan yang
     * menyebut izin dan alasannya. Daftar yang lolos dijamin: dikenal, ditegakkan backend, berlaku untuk role ini,
     * dan memuat semua izin wajib.
     *
     * @param  array<int,string>  $slugs
     */
    public static function assertValid(Role $role, array $slugs): void
    {
        $roleKey = Catalog::keyOf($role->slug);
        $errors = [];

        $unknown = array_values(array_diff($slugs, Catalog::enforcedSlugs()));
        if ($unknown !== []) {
            $errors[] = 'Izin berikut tidak dikenal atau fiturnya belum tersedia: '.implode(', ', $unknown).'.';
        }

        $notApplicable = array_values(array_diff(array_intersect($slugs, Catalog::enforcedSlugs()), Catalog::assignable($roleKey)));
        if ($notApplicable !== []) {
            $errors[] = "Izin berikut tidak berlaku untuk role {$role->name}: ".implode(', ', $notApplicable).'.';
        }

        $missing = array_values(array_diff(Catalog::required($roleKey), $slugs));
        if ($missing !== []) {
            $errors[] = "Izin berikut wajib tetap dimiliki role {$role->name}: ".implode(', ', $missing).'.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages(['permissions' => $errors]);
        }
    }

    // ------------------------------------------------------------------ pembantu

    private static function appliesTo(array $activity, string $roleKey): bool
    {
        foreach ($activity['cells'] as $cell) {
            if (in_array($roleKey, $cell['roles'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int,string>  $granted
     * @param  array<int,string>  $required
     * @param  array<string,int>  $usage
     * @return array<string,mixed>
     */
    private static function cell(array $activity, string $column, string $roleKey, array $granted, array $required, array $usage): array
    {
        $def = $activity['cells'][$column] ?? null;
        $blank = ['action' => $column, 'slug' => null, 'state' => self::STATE_NA, 'granted' => false, 'editable' => false, 'shared' => false, 'sensitive' => false, 'reason' => null];

        if ($def === null || ! in_array($roleKey, $def['roles'], true)) {
            return $blank;
        }

        if ($activity['status'] === Catalog::STATUS_PLANNED) {
            return ['state' => self::STATE_UNAVAILABLE, 'reason' => $activity['note']] + $blank;
        }

        $slug = $def['slug'];
        $isRequired = in_array($slug, $required, true);
        $isGranted = in_array($slug, $granted, true);

        return [
            'action' => $column,
            'slug' => $slug,
            'state' => $isRequired ? self::STATE_LOCKED : ($isGranted ? self::STATE_ON : self::STATE_OFF),
            'granted' => $isGranted || $isRequired,
            'editable' => ! $isRequired,
            'shared' => ($usage[$slug] ?? 0) > 1,
            'sensitive' => Catalog::isSensitive($slug),
            'reason' => $isRequired ? 'Izin wajib role ini; tidak dapat dimatikan.' : null,
        ];
    }
}
