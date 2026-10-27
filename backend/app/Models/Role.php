<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const ADMIN = 'admin';
    public const MENTOR = 'mentor';
    public const SISWA = 'siswa';
    public const KARYAWAN = 'karyawan';
    public const LEMBAGA = 'lembaga';

    public const ALL = [self::ADMIN, self::MENTOR, self::SISWA, self::KARYAWAN, self::LEMBAGA];

    protected $fillable = ['slug', 'name', 'description'];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'permission_role');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'role_user');
    }
}
