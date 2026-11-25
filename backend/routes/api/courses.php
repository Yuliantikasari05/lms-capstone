<?php

use App\Http\Controllers\Api\V1\AssignmentController;
use App\Http\Controllers\Api\V1\AssignmentSubmissionController;
use App\Http\Controllers\Api\V1\ClassSessionController;
use App\Http\Controllers\Api\V1\CourseController;
use App\Http\Controllers\Api\V1\CourseModuleController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\MaterialController;
use App\Http\Controllers\Api\V1\MentorSummaryController;
use Illuminate\Support\Facades\Route;

/*
 | Modul kursus. Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed,
 | sehingga semua rute di sini sudah terlindungi login. Otorisasi per aksi ditangani CoursePolicy.
 | (File terpisah agar perubahan modul ini tidak bentrok dengan rute modul lain.)
 */

Route::get('mentor/summary', MentorSummaryController::class)->middleware('permission:courses.view');

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

// Tugas, kuis, dan ujian. "activation" dan "review" didaftarkan sebelum rute {assignment} agar tidak tertukar.
Route::get('assignments', [AssignmentController::class, 'index'])->middleware('permission:assignments.view');
Route::post('courses/{course}/assignments', [AssignmentController::class, 'store']);
Route::patch('assignments/{assignment}/activation', [AssignmentController::class, 'activation']);
Route::post('assignments/{assignment}/review', [AssignmentController::class, 'review'])->middleware('permission:assignments.review');
Route::get('assignments/{assignment}/submissions', [AssignmentSubmissionController::class, 'index'])->middleware('permission:assignments.grade');
Route::get('assignments/{assignment}', [AssignmentController::class, 'show'])->middleware('permission:assignments.view');
Route::patch('assignments/{assignment}', [AssignmentController::class, 'update']);
Route::delete('assignments/{assignment}', [AssignmentController::class, 'destroy']);
Route::get('submissions/{submission}', [AssignmentSubmissionController::class, 'show'])->middleware('permission:assignments.grade');
Route::patch('submissions/{submission}', [AssignmentSubmissionController::class, 'grade'])->middleware('permission:assignments.grade');

// Sesi belajar online. Link meeting hanya lewat endpoint meeting-link (tidak ikut di daftar untuk yang tak berhak).
// Sesi Offline tidak memakai link meeting; sesi Online wajib memilikinya (divalidasi SessionRequest).
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
