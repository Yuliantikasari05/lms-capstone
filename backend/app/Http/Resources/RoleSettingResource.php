<?php

namespace App\Http\Resources;

use App\Models\Role;
use App\Support\Rbac\Catalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Role pada layar Pengaturan > Role & Akses. Daftar slug izin ikut bila relasinya dimuat (detail);
 * matriks lengkap dikirim controller terpisah di kunci "matrix".
 *
 * @mixin \App\Models\Role
 */
class RoleSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $key = Catalog::keyOf($this->slug);
        $isSystem = $key !== Catalog::CUSTOM;

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            // Role bawaan (badge "System"): tidak dapat dihapus atau diganti namanya.
            'is_system' => $isSystem,
            'can_rename' => ! $isSystem,
            'can_delete' => ! $isSystem,
            'users_count' => $this->whenCounted('users'),
            'permissions_count' => $this->when(
                isset($this->permissions_count) || $this->relationLoaded('permissions'),
                fn () => $this->permissions_count ?? $this->permissions->count()
            ),
            // Berapa izin yang BISA dinyalakan untuk role ini (fitur yang sudah dibangun dan berlaku untuk role ini).
            'assignable_count' => count(Catalog::assignable($key)),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('slug')->sort()->values()->all()),
            'required_permissions' => Catalog::required($key),
        ];
    }
}
