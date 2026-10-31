<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use LogicException;

/**
 * Catatan audit yang tidak dapat diubah atau dihapus lewat aplikasi (append-only).
 */
class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_id', 'actor_name', 'actor_email', 'action',
        'target_type', 'target_id', 'target_label',
        'changes', 'ip_address', 'user_agent', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Catatan audit tidak boleh diubah.'));
        static::deleting(fn () => throw new LogicException('Catatan audit tidak boleh dihapus.'));
    }

    /**
     * Mencatat satu aktivitas. Pelaku, IP, dan user agent diambil dari request.
     *
     * @param  array<string,mixed>  $changes  Hanya data non-rahasia. Kunci yang mengandung "password" selalu dibuang.
     */
    public static function record(string $action, ?Model $target = null, array $changes = [], ?Request $request = null): self
    {
        $request ??= request();
        $actor = $request?->user();

        return self::create([
            'actor_id' => $actor?->getKey(),
            'actor_name' => $actor?->name,
            'actor_email' => $actor?->email,
            'action' => $action,
            'target_type' => $target ? Str::snake(class_basename($target)) : null,
            'target_id' => $target?->getKey(),
            'target_label' => $target instanceof User ? "{$target->name} ({$target->email})" : null,
            'changes' => $changes === [] ? null : self::stripSecrets($changes),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent() ? mb_substr($request->userAgent(), 0, 255) : null,
            'created_at' => now(),
        ]);
    }

    /** Pengaman berlapis: buang kunci berbau rahasia di kedalaman mana pun. */
    private static function stripSecrets(array $data): array
    {
        $clean = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && str_contains(mb_strtolower($key), 'password')) {
                continue;
            }
            $clean[$key] = is_array($value) ? self::stripSecrets($value) : $value;
        }

        return $clean;
    }
}
