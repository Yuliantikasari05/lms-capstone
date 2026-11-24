<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RoleSettingRequest;
use App\Http\Resources\RoleSettingResource;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Pengaturan > Role & Akses (FR-14): daftar role, matriks izin, role khusus.
 * Baca: permission roles.view. Ubah: roles.manage (diperiksa pada RoleSettingRequest dan rute).
 *
 * Pengaman: role Admin dikunci; role bawaan tidak dihapus/diganti nama dan tetap memegang izin dashboard-nya;
 * izin yang hanya untuk Admin (PermissionCatalog::ADMIN_ONLY) tidak bisa diberikan ke role lain.
 */
class RoleSettingsController extends Controller
{
    public function index()
    {
        $roles = Role::query()->withCount('users')->withCount('permissions')->orderBy('id')->get();

        return RoleSettingResource::collection($roles)->additional(['summary' => [
            'total_roles' => $roles->count(),
            'total_users' => User::count(),
            'custom_roles' => $roles->filter(fn (Role $r) => ! in_array($r->slug, Role::ALL, true))->count(),
        ]]);
    }

    public function show(Role $role): RoleSettingResource
    {
        return new RoleSettingResource($role->loadCount('users')->load('permissions'));
    }

    public function store(RoleSettingRequest $request): JsonResponse
    {
        $data = $request->validated();
        $permissions = array_values($data['permissions'] ?? []);
        $this->assertGrantable(null, $permissions);

        $role = DB::transaction(function () use ($data, $permissions, $request) {
            $role = Role::create(['slug' => $this->uniqueSlug($data['name']), 'name' => $data['name'], 'description' => $data['description'] ?? null]);
            $role->permissions()->sync(Permission::whereIn('slug', $permissions)->pluck('id'));

            AuditLog::record('role.created', $role, ['role' => $role->name, 'after' => ['name' => $role->name, 'permissions' => collect($permissions)->sort()->values()->all()]], $request);

            return $role;
        });

        return (new RoleSettingResource($role->loadCount('users')->load('permissions')))
            ->additional(['message' => 'Role berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(RoleSettingRequest $request, Role $role): RoleSettingResource
    {
        $data = $request->validated();
        $isSystem = in_array($role->slug, Role::ALL, true);

        if ($role->slug === Role::ADMIN) {
            throw ValidationException::withMessages(['role' => ['Role Admin dikunci dan tidak dapat diubah agar Admin tidak kehilangan aksesnya.']]);
        }
        if ($isSystem && isset($data['name']) && $data['name'] !== $role->name) {
            throw ValidationException::withMessages(['name' => ['Nama role bawaan tidak dapat diubah.']]);
        }

        $before = ['name' => $role->name, 'description' => $role->description, 'permissions' => $role->permissions()->pluck('slug')->sort()->values()->all()];
        $permissions = array_key_exists('permissions', $data) ? array_values($data['permissions'] ?? []) : null;

        if ($permissions !== null) {
            $this->assertGrantable($role, $permissions);
        }

        DB::transaction(function () use ($role, $data, $permissions, $before, $request) {
            $role->fill(collect($data)->only(['name', 'description'])->all())->save();

            if ($permissions !== null) {
                $role->permissions()->sync(Permission::whereIn('slug', $permissions)->pluck('id'));
            }

            $after = ['name' => $role->name, 'description' => $role->description, 'permissions' => $role->permissions()->pluck('slug')->sort()->values()->all()];
            $changes = $this->diff($before, $after);

            if ($changes !== []) {
                AuditLog::record('role.updated', $role, ['role' => $role->name] + $changes, $request);
            }
        });

        return (new RoleSettingResource($role->loadCount('users')->load('permissions')))->additional(['message' => 'Role berhasil diperbarui.']);
    }

    /** Hanya role khusus yang tidak lagi dipakai pengguna mana pun. */
    public function destroy(Request $request, Role $role): JsonResponse
    {
        abort_unless($request->user()?->hasPermission('roles.manage'), 403, 'Anda tidak memiliki izin untuk mengakses sumber daya ini.');

        if (in_array($role->slug, Role::ALL, true)) {
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

    /**
     * Memeriksa daftar izin yang akan dipasang ($role null = role baru).
     *
     * @param  array<int,string>  $permissions
     */
    private function assertGrantable(?Role $role, array $permissions): void
    {
        $adminOnly = array_values(array_filter($permissions, [PermissionCatalog::class, 'isAdminOnly']));
        if ($adminOnly !== []) {
            throw ValidationException::withMessages(['permissions' => ['Izin berikut hanya untuk Admin dan tidak dapat diberikan ke role lain: '.implode(', ', $adminOnly).'.']]);
        }

        $missing = $role ? array_values(array_diff(PermissionCatalog::requiredFor($role), $permissions)) : [];
        if ($missing !== []) {
            throw ValidationException::withMessages(['permissions' => ['Izin berikut wajib tetap dimiliki role bawaan ini: '.implode(', ', $missing).'.']]);
        }
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $base = mb_substr($base, 0, 40);
        $slug = $base;

        for ($i = 2; in_array($slug, Role::ALL, true) || Role::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
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
