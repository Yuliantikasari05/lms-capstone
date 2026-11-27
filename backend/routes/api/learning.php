<?php

use App\Http\Controllers\Api\V1\Student\MaterialProgressController;
use App\Http\Controllers\Api\V1\Student\SessionJoinController;
use App\Http\Controllers\Api\V1\Student\StudentAssignmentController;
use App\Http\Controllers\Api\V1\Student\StudentCourseController;
use App\Http\Controllers\Api\V1\Student\StudentLeaderboardController;
use App\Http\Controllers\Api\V1\Student\StudentReportController;
use App\Http\Controllers\Api\V1\Student\StudentScheduleController;
use App\Http\Controllers\Api\V1\Student\StudentSummaryController;
use Illuminate\Support\Facades\Route;

/*
 | Modul belajar Siswa. Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Otorisasi dua lapis: middleware permission:<slug> (matriks Pengaturan > Role & Akses) dan
 | pemeriksaan kepemilikan data di controller/service (enrollment aktif + role Siswa).
 | Endpoint hanya mengembalikan data milik peserta yang login.
 */

// Dashboard dan data belajar.
Route::get('siswa/summary', StudentSummaryController::class)->middleware('permission:learning.view');
Route::get('siswa/courses', [StudentCourseController::class, 'index'])->middleware('permission:learning.view');
Route::get('siswa/courses/{course}', [StudentCourseController::class, 'show'])->middleware('permission:learning.view');

// Progres materi dan waktu belajar (sinyal 1 menit).
Route::post('siswa/materials/{material}/complete', [MaterialProgressController::class, 'complete'])->middleware('permission:learning.progress');
Route::post('siswa/materials/{material}/study', [MaterialProgressController::class, 'study'])->middleware('permission:learning.progress');

// Tugas dan evaluasi.
Route::get('siswa/assignments', [StudentAssignmentController::class, 'index'])->middleware('permission:assignments.submit');
Route::get('siswa/assignments/{assignment}', [StudentAssignmentController::class, 'show'])->middleware('permission:assignments.submit');
Route::post('siswa/assignments/{assignment}/submissions', [StudentAssignmentController::class, 'submit'])
    ->middleware(['permission:assignments.submit', 'throttle:30,1']);

// Jadwal, sesi bimbingan, dan kehadiran.
Route::get('siswa/schedule', StudentScheduleController::class)->middleware('permission:schedule.view');
Route::post('siswa/sessions/{session}/join', SessionJoinController::class)->middleware('permission:schedule.join');

// Laporan dan papan peringkat.
Route::get('siswa/report', StudentReportController::class)->middleware('permission:reports.view');
Route::get('siswa/leaderboard', StudentLeaderboardController::class)->middleware('permission:leaderboard.view');
