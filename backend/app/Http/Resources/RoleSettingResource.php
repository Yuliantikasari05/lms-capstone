<?php

namespace App\Http\Resources;

use App\Support\PermissionCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Role pada layar Pengaturan > Role & Akses. Daftar slug permission hanya ikut bila relasinya dimuat (detail).
 *
 * @mixin \App\Models\Role
 */
class RoleSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isSystem = in_array($this->slug, \App\Models\Role::ALL, true);

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            // Role bawaan: tidak dapat dihapus atau diganti namanya (badge "System").
            'is_system' => $isSystem,
            // Role Admin dikunci agar Admin tidak mengunci dirinya sendiri.
            'is_locked' => $this->slug === \App\Models\Role::ADMIN,
            'users_count' => $this->whenCounted('users'),
            'permissions_count' => $this->when(
                isset($this->permissions_count) || $this->relationLoaded('permissions'),
                fn () => $this->permissions_count ?? $this->permissions->count()
            ),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('slug')->sort()->values()->all()),
            'required_permissions' => PermissionCatalog::requiredFor($this->resource),
        ];
    }
}
