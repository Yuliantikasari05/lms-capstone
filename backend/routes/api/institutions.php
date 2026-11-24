<?php

use App\Http\Controllers\Api\V1\InstitutionController;
use App\Http\Controllers\Api\V1\InstitutionDashboardController;
use App\Http\Controllers\Api\V1\InstitutionPayoutController;
use Illuminate\Support\Facades\Route;

/*
 | Manajemen Lembaga Bimbingan (Admin). Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Otorisasi per aksi ditangani InstitutionPolicy (permission institutions.*). File terpisah agar tidak bentrok dengan modul lain.
 |
 | PENTING: rute dengan segmen statis ({institution}/restore, /dashboard, /payouts) tidak bentrok dengan apiResource
 | karena metode atau jumlah segmennya berbeda.
 */

Route::post('institutions/{institution}/restore', [InstitutionController::class, 'restore'])->withTrashed();
Route::get('institutions/{institution}/dashboard', InstitutionDashboardController::class);
Route::get('institutions/{institution}/payouts', [InstitutionPayoutController::class, 'index']);
Route::post('institutions/{institution}/payouts', [InstitutionPayoutController::class, 'store']);
Route::patch('institutions/{institution}/payouts/{payout}', [InstitutionPayoutController::class, 'update']);

Route::apiResource('institutions', InstitutionController::class);
