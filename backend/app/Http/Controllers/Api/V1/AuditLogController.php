<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;

/** Daftar catatan audit (hanya baca). Otorisasi: middleware permission:audit.view pada rute. */
class AuditLogController extends Controller
{
    public function __invoke(Request $request)
    {
        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:64'],
            'actor_id' => ['nullable', 'integer'],
            'target_type' => ['nullable', 'string', 'max:64'],
            'target_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $logs = AuditLog::query()
            ->when($filters['action'] ?? null, fn ($q, $v) => $q->where('action', $v))
            ->when($filters['actor_id'] ?? null, fn ($q, $v) => $q->where('actor_id', $v))
            ->when($filters['target_type'] ?? null, fn ($q, $v) => $q->where('target_type', $v))
            ->when($filters['target_id'] ?? null, fn ($q, $v) => $q->where('target_id', $v))
            ->when($filters['from'] ?? null, fn ($q, $v) => $q->where('created_at', '>=', $v))
            ->when($filters['to'] ?? null, fn ($q, $v) => $q->where('created_at', '<=', date('Y-m-d 23:59:59', strtotime($v))))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);

        return AuditLogResource::collection($logs);
    }
}
