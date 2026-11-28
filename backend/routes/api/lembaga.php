<?php

use App\Http\Controllers\Api\V1\Lembaga\LembagaPricingController;
use App\Http\Controllers\Api\V1\Lembaga\LembagaProfileController;
use App\Http\Controllers\Api\V1\Lembaga\LembagaReportController;
use App\Http\Controllers\Api\V1\Lembaga\LembagaStudentController;
use App\Http\Controllers\Api\V1\Lembaga\LembagaSummaryController;
use App\Http\Controllers\Api\V1\Lembaga\LembagaVoucherController;
use Illuminate\Support\Facades\Route;

/*
 | Lembaga Bimbingan (swa-layan). Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 |
 | Semua data diambil dari kepemilikan akun yang login (profil lewat user_id, program lewat created_by + jenis
 | "institution"), sehingga tidak ada id lembaga yang dikirim klien. Setiap rute dijaga izinnya agar sakelar di
 | Pengaturan > Role & Akses benar-benar mengendalikan fiturnya.
 |
 | Program (kursus jenis institution), modul, materi, dan sesi memakai endpoint /courses yang sudah ada;
 | CoursePolicy membatasi Lembaga hanya pada program miliknya.
 */

Route::get('lembaga/summary', LembagaSummaryController::class)->middleware('permission:dashboard.lembaga');

Route::get('lembaga/profile', [LembagaProfileController::class, 'show'])->middleware('permission:lembaga.profile.view');
Route::patch('lembaga/profile', [LembagaProfileController::class, 'update'])->middleware('permission:lembaga.profile.update');

Route::get('lembaga/students', [LembagaStudentController::class, 'index'])->middleware('permission:lembaga.students.view');
Route::get('lembaga/students/{user}', [LembagaStudentController::class, 'show'])->middleware('permission:lembaga.students.view');

Route::get('lembaga/vouchers', [LembagaVoucherController::class, 'index'])->middleware('permission:lembaga.vouchers.view');
Route::post('lembaga/vouchers', [LembagaVoucherController::class, 'store'])->middleware('permission:lembaga.vouchers.create');
Route::get('lembaga/vouchers/{coupon}', [LembagaVoucherController::class, 'show'])->middleware('permission:lembaga.vouchers.view');
Route::patch('lembaga/vouchers/{coupon}', [LembagaVoucherController::class, 'update'])->middleware('permission:lembaga.vouchers.update');
Route::delete('lembaga/vouchers/{coupon}', [LembagaVoucherController::class, 'destroy'])->middleware('permission:lembaga.vouchers.delete');

Route::get('lembaga/pricing', [LembagaPricingController::class, 'index'])->middleware('permission:lembaga.pricing.view');
Route::patch('lembaga/programs/{course}/pricing', [LembagaPricingController::class, 'update'])->middleware('permission:lembaga.pricing.update');

Route::get('lembaga/reports', LembagaReportController::class)->middleware('permission:lembaga.report.view');
