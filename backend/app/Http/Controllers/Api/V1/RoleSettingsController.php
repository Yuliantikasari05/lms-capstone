<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RoleSettingRequest;
use App\Http\Resources\RoleSettingResource;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\Rbac\Catalog;
use App\Support\Rbac\RoleMatrix;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Pengaturan > Role & Akses (FR-14, hi-fi 3.18).
 * Baca: permission roles.view. Ubah: roles.manage (diperiksa pada rute dan RoleSettingRequest).
 *
 * Prinsip: sakelar di matriks = permission yang benar-benar ditegakkan backend (lihat App\Support\Rbac\Catalog).
 * Perubahan berlaku seketika (izin dibaca dari database pada tiap request) dan semua akun ber-role itu ikut berubah.
 *
 * Pengaman: izin hanya dapat dipasang pada role yang berhak menerimanya; fitur yang belum dibangun tidak dapat dinyalakan;
 * tiap role wajib mempertahankan izin dasarnya (Admin: dashboard dan pengaturan role, agar tidak terkunci); role bawaan
 * tidak dapat dihapus atau diganti namanya; role khusus hanya dihapus bila tidak dipakai.
 */
class RoleSettingsController extends Controller
{
    public function index()
    {
        $roles = Role::query()->withCount(['users', 'permissions'])->orderBy('id')->get();

        return RoleSettingResource::collection($roles)->additional(['summary' => [
            'total_roles' => $roles->count(),
            'total_users' => User::count(),
            'custom_roles' => $roles->filter(fn (Role $r) => Catalog::keyOf($r->slug) === Catalog::CUSTOM)->count(),
        ]]);
    }

    /** Detail role + matriks C/R/U/D lengkap dengan status tiap sakelar. */
    public function show(Role $role): JsonResponse
    {
        return $this->detail($role);
    }

    public function store(RoleSettingRequest $request): JsonResponse
    {
        $data = $request->validated();
        $permissions = array_values($data['permissions'] ?? []);

        // Role baru selalu "custom": hanya menerima izin yang tidak bergantung pada kepemilikan data.
        RoleMatrix::assertValid(new Role(['slug' => 'custom-baru', 'name' => $data['name']]), $permissions);

        $role = DB::transaction(function () use ($data, $permissions, $request) {
            $role = Role::create(['slug' => $this->uniqueSlug($data['name']), 'name' => $data['name'], 'description' => $data['description'] ?? null]);
            $role->permissions()->sync(Permission::whereIn('slug', $permissions)->pluck('id'));

            AuditLog::record('role.created', $role, ['role' => $role->name, 'after' => ['name' => $role->name, 'permissions' => collect($permissions)->sort()->values()->all()]], $request);

            return $role;
        });

        return $this->detail($role, 201, 'Role berhasil dibuat.');
    }

    public function update(RoleSettingRequest $request, Role $role): JsonResponse
    {
        $data = $request->validated();
        $isSystem = Catalog::keyOf($role->slug) !== Catalog::CUSTOM;

        if ($isSystem && isset($data['name']) && $data['name'] !== $role->name) {
            throw ValidationException::withMessages(['name' => ['Nama role bawaan tidak dapat diubah.']]);
        }

        $before = $this->snapshot($role);
        $permissions = array_key_exists('permissions', $data) ? array_values($data['permissions'] ?? []) : null;

        if ($permissions !== null) {
            RoleMatrix::assertValid($role, $permissions);
        }

        DB::transaction(function () use ($role, $data, $permissions, $before, $request) {
            $role->fill(collect($data)->only(['name', 'description'])->all())->save();

            if ($permissions !== null) {
                $role->permissions()->sync(Permission::whereIn('slug', $permissions)->pluck('id'));
            }

            $changes = $this->diff($before, $this->snapshot($role));

            if ($changes !== []) {
                AuditLog::record('role.updated', $role, ['role' => $role->name] + $changes, $request);
            }
        });

        return $this->detail($role->refresh(), 200, 'Role berhasil diperbarui.');
    }

    /** Mengembalikan izin role bawaan ke pengaturan awal sistem (tombol "Atur ulang ke bawaan"). */
    public function reset(Request $request, Role $role): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('roles.manage'), 403, 'Anda tidak memiliki izin untuk mengakses sumber daya ini.');

        if (Catalog::keyOf($role->slug) === Catalog::CUSTOM) {
            throw ValidationException::withMessages(['role' => ['Hanya role bawaan yang dapat diatur ulang ke pengaturan awal.']]);
        }

        $before = $this->snapshot($role);

        DB::transaction(function () use ($role, $before, $request) {
            $role->permissions()->sync(Permission::whereIn('slug', RolePermissionSeeder::MATRIX[$role->slug])->pluck('id'));

            $changes = $this->diff($before, $this->snapshot($role));
            AuditLog::record('role.reset', $role, ['role' => $role->name] + $changes, $request);
        });

        return $this->detail($role->refresh(), 200, 'Izin role dikembalikan ke pengaturan awal.');
    }

    /** Hanya role khusus yang tidak lagi dipakai pengguna mana pun. */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('roles.manage'), 403, 'Anda tidak memiliki izin untuk mengakses sumber daya ini.');

        if (Catalog::keyOf($role->slug) !== Catalog::CUSTOM) {
            throw ValidationException::withMessages(['role' => ['Role bawaan tidak dapat dihapus.']]);
        }

        $users = $role->users()->count();
        if ($users > 0) {
            throw ValidationException::withMessages(['role' => ["Role masih dipakai {$users} pengguna. Pindahkan penggunanya ke role lain terlebih dahulu."]]);
        }

        DB::transaction(function () use ($role, $request) {
            AuditLog::record('role.deleted', $role, ['role' => $role->name, 'before' => ['name' => $role->name]], $request);
            $role->permissions()->detach();
            $role->delete();
        });

        return response()->json(['message' => 'Role berhasil dihapus.']);
    }

    // ------------------------------------------------------------------ pembantu

    private function detail(Role $role, int $status = 200, ?string $message = null): JsonResponse
    {
        $role->loadCount('users')->load('permissions');

        $body = [
            'data' => (new RoleSettingResource($role))->resolve(),
            'matrix' => RoleMatrix::forRole($role->slug, $role->permissions->pluck('slug')->all()),
            'columns' => Catalog::COLUMNS,
        ];
        if ($message !== null) {
            $body['message'] = $message;
        }

        return response()->json($body, $status);
    }

    private function uniqueSlug(string $name): string
    {
        $base = mb_substr(Str::slug($name) ?: 'role', 0, 40);
        $slug = $base;

        for ($i = 2; in_array($slug, Role::ALL, true) || Role::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    /** @return array{name:string,description:?string,permissions:array<int,string>} */
    private function snapshot(Role $role): array
    {
        return ['name' => $role->name, 'description' => $role->description, 'permissions' => $role->permissions()->pluck('slug')->sort()->values()->all()];
    }

    /**
     * @param  array<string,mixed>  $before
     * @param  array<string,mixed>  $after
     * @return array<string,mixed>
     */
    private function diff(array $before, array $after): array
    {
        $changes = [];
        foreach (['name', 'description'] as $field) {
            if ($before[$field] !== $after[$field]) {
                $changes['before'][$field] = $before[$field];
                $changes['after'][$field] = $after[$field];
            }
        }

        $added = array_values(array_diff($after['permissions'], $before['permissions']));
        $removed = array_values(array_diff($before['permissions'], $after['permissions']));
        if ($added !== [] || $removed !== []) {
            $changes['permissions_added'] = $added;
            $changes['permissions_removed'] = $removed;
        }

        return $changes;
    }
}
