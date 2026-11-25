<?php

use App\Http\Controllers\Api\V1\PermissionCatalogController;
use App\Http\Controllers\Api\V1\RoleSettingsController;
use Illuminate\Support\Facades\Route;

/*
 | Pengaturan > Role dan Akses (Admin). Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Baca memakai permission roles.view; ubah memakai roles.manage (diperiksa lagi di RoleSettingRequest/controller).
 */

Route::prefix('settings')->group(function () {
    Route::middleware('permission:roles.view')->group(function () {
        Route::get('permissions', PermissionCatalogController::class);
        Route::get('roles', [RoleSettingsController::class, 'index']);
        Route::get('roles/{role}', [RoleSettingsController::class, 'show']);
    });

    Route::middleware('permission:roles.manage')->group(function () {
        Route::post('roles', [RoleSettingsController::class, 'store']);
        Route::patch('roles/{role}', [RoleSettingsController::class, 'update']);
        Route::post('roles/{role}/reset', [RoleSettingsController::class, 'reset']);
        Route::delete('roles/{role}', [RoleSettingsController::class, 'destroy']);
    });
});
