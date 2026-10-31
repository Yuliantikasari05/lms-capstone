<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $permissionsLoaded = $this->relationLoaded('roles')
            && $this->roles->every(fn ($role) => $role->relationLoaded('permissions'));

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'status' => $this->status,
            'primary_role' => $this->when($this->relationLoaded('roles'), fn () => $this->roles->first()?->slug),
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            // Permission hanya disertakan bila sudah di-load (endpoint login & /auth/me).
            'permissions' => $this->when($permissionsLoaded, fn () => $this->permissionSlugs()),
            // true = masih memakai kata sandi sementara dari Admin dan wajib menggantinya.
            'must_change_password' => (bool) $this->must_change_password,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            // Terisi bila akun sudah dihapus (soft delete); null untuk akun biasa.
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
