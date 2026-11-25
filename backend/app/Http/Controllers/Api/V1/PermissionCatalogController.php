<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\Rbac\Catalog;
use App\Support\Rbac\RoleMatrix;
use Illuminate\Http\JsonResponse;

/** Katalog aktivitas dan izin untuk matriks Role & Akses. Otorisasi: permission roles.view pada rute. */
class PermissionCatalogController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'data' => RoleMatrix::catalog(),
            'columns' => Catalog::COLUMNS,
        ]);
    }
}
