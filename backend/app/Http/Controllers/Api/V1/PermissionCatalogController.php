<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;

/** Daftar izin per modul (dasar matriks Role & Akses). Otorisasi: permission roles.view pada rute. */
class PermissionCatalogController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => PermissionCatalog::grouped()]);
    }
}
