<?php

use App\Http\Controllers\Api\V1\CouponController;
use Illuminate\Support\Facades\Route;

/*
 | Manajemen Kupon (Admin). Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Otorisasi per aksi ditangani CouponPolicy. (File terpisah agar tidak bentrok dengan rute modul lain.)
 */

Route::apiResource('coupons', CouponController::class);
