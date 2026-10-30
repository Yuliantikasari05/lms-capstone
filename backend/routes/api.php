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
            // PENTING: rute statis `users/export` harus didaftarkan SEBELUM apiResource,
            // jika tidak kata "export" akan dibaca sebagai {user}.
            Route::get('users/export', [UserController::class, 'export'])->middleware('throttle:10,1');
            Route::post('users/{user}/restore', [UserController::class, 'restore'])->withTrashed();
            Route::apiResource('users', UserController::class)->withTrashed(['show']);
        });
    });
});
