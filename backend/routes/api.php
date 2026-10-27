<?php

use App\Http\Controllers\Api\V1\AdminSummaryController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::get('health', HealthController::class);

    Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        // Logout selalu boleh, bahkan untuk akun yang sudah dinonaktifkan.
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::middleware('active')->group(function () {
            Route::get('auth/me', [AuthController::class, 'me']);

            Route::get('roles', RoleController::class)->middleware('permission:roles.view');
            Route::get('admin/summary', AdminSummaryController::class)->middleware('permission:dashboard.admin');

            // Otorisasi per aksi ditangani oleh UserPolicy.
            Route::apiResource('users', UserController::class);
        });
    });
});
