<?php

use App\Http\Controllers\Api\V1\NotificationController;
use Illuminate\Support\Facades\Route;

/*
 | Notifikasi pengguna (self-service). Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Tidak memakai middleware permission: setiap akun hanya mengakses notifikasinya sendiri.
 | Rute statis didaftarkan sebelum rute {notification} agar tidak tertukar.
 */

Route::get('notifications', [NotificationController::class, 'index']);
Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
Route::delete('notifications', [NotificationController::class, 'clear']);
Route::patch('notifications/{notification}/read', [NotificationController::class, 'read']);
Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
