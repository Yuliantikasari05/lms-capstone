<?php

use App\Http\Controllers\Api\V1\ClassSessionController;
use App\Http\Controllers\Api\V1\CourseController;
use App\Http\Controllers\Api\V1\CourseModuleController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\MaterialController;
use Illuminate\Support\Facades\Route;

/*
 | Modul kursus. Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed,
 | sehingga semua rute di sini sudah terlindungi login. Otorisasi per aksi ditangani CoursePolicy.
 | (File terpisah agar perubahan modul ini tidak bentrok dengan rute modul lain.)
 */

Route::apiResource('courses', CourseController::class);
Route::put('courses/{course}/mentor', [CourseController::class, 'assignMentor']);

// Modul (isi kursus). "order" didaftarkan sebelum rute {module} agar tidak tertukar.
Route::get('courses/{course}/modules', [CourseModuleController::class, 'index']);
Route::post('courses/{course}/modules', [CourseModuleController::class, 'store']);
Route::put('courses/{course}/modules/order', [CourseModuleController::class, 'reorder']);
Route::patch('modules/{module}', [CourseModuleController::class, 'update']);
Route::delete('modules/{module}', [CourseModuleController::class, 'destroy']);

// Materi. Mengubah materi DENGAN file: kirim POST + field _method=PATCH (PHP tidak membaca multipart pada PATCH).
Route::post('modules/{module}/materials', [MaterialController::class, 'store']);
Route::put('modules/{module}/materials/order', [MaterialController::class, 'reorder']);
Route::patch('materials/{material}', [MaterialController::class, 'update']);
Route::delete('materials/{material}', [MaterialController::class, 'destroy']);
Route::get('materials/{material}/file', [MaterialController::class, 'file']);

// Sesi belajar online. Link meeting hanya lewat endpoint meeting-link (tidak ikut di daftar untuk yang tak berhak).
Route::get('courses/{course}/sessions', [ClassSessionController::class, 'index']);
Route::post('courses/{course}/sessions', [ClassSessionController::class, 'store']);
Route::get('sessions/{session}', [ClassSessionController::class, 'show']);
Route::patch('sessions/{session}', [ClassSessionController::class, 'update']);
Route::delete('sessions/{session}', [ClassSessionController::class, 'destroy']);
Route::get('sessions/{session}/meeting-link', [ClassSessionController::class, 'meetingLink']);

// Peserta kursus (didaftarkan Admin). "candidates" = pengguna yang layak didaftarkan (ditentukan server).
Route::get('courses/{course}/enrollments', [EnrollmentController::class, 'index']);
Route::post('courses/{course}/enrollments', [EnrollmentController::class, 'store']);
Route::get('courses/{course}/enrollment-candidates', [EnrollmentController::class, 'candidates']);
Route::delete('enrollments/{enrollment}', [EnrollmentController::class, 'destroy']);
