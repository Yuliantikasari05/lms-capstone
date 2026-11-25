<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\Rbac\PermissionSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('select 1');
            $database = true;
        } catch (Throwable) {
            $database = false;
        }

        // Pengaman RBAC: izin yang belum tersinkron dilaporkan di sini sebelum pengguna menemui 403.
        try {
            $sync = PermissionSync::inspect();
            $permissions = [
                'ok' => $sync['ok'],
                'missing' => count($sync['missing_permissions']) + count($sync['unseeded_permissions']),
                'roles_missing_required' => array_keys($sync['required_gaps']),
            ];
        } catch (Throwable) {
            $permissions = ['ok' => null, 'missing' => null, 'roles_missing_required' => []];
        }

        return response()->json([
            'status' => $database ? 'ok' : 'degraded',
            'app' => config('app.name'),
            'database' => $database ? 'connected' : 'unavailable',
            'permissions' => $permissions,
            'timestamp' => now()->toIso8601String(),
        ], $database ? 200 : 503);
    }
}
