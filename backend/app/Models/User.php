<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SoftDeletes;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_SUSPENDED = 'suspended';

    public const STATUSES = [self::STATUS_ACTIVE, self::STATUS_INACTIVE, self::STATUS_SUSPENDED];

    /** Label status untuk tampilan/ekspor. Samakan dengan STATUS_LABEL di frontend (lib/format.ts). */
    public const STATUS_LABELS = [
        self::STATUS_ACTIVE => 'Aktif',
        self::STATUS_INACTIVE => 'Nonaktif',
        self::STATUS_SUSPENDED => 'Ditangguhkan',
    ];

    protected $fillable = ['name', 'email', 'password', 'status'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'must_change_password' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /**
     * Mengeluarkan pengguna dari semua perangkat (SESSION_DRIVER=database).
     * $exceptSessionId: sesi yang dipertahankan (mis. sesi yang baru saja mengganti kata sandi).
     */
    public function revokeSessions(?string $exceptSessionId = null): void
    {
        DB::table(config('session.table', 'sessions'))
            ->where('user_id', $this->getKey())
            ->when($exceptSessionId, fn ($query, $id) => $query->where('id', '!=', $id))
            ->delete();
    }

    /** @param string|array<int,string> $roles */
    public function hasRole(string|array $roles): bool
    {
        $this->loadMissing('roles');

        return $this->roles->pluck('slug')->intersect((array) $roles)->isNotEmpty();
    }

    /** @return array<int,string> */
    public function permissionSlugs(): array
    {
        $this->loadMissing('roles.permissions');

        return $this->roles
            ->flatMap(fn (Role $role) => $role->permissions->pluck('slug'))
            ->unique()
            ->values()
            ->all();
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissionSlugs(), true);
    }

    public function primaryRoleSlug(): ?string
    {
        $this->loadMissing('roles');

        return $this->roles->first()?->slug;
    }
}
