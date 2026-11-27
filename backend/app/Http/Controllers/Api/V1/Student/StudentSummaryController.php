<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Ringkasan dashboard Siswa (FR-37, FR-39, FR-42): progres, streak, level, sesi, peringkat. */
class StudentSummaryController extends Controller
{
    public function __invoke(Request $request, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        // Login dianggap hari aktif; dashboard dibuka setelah login sehingga aman dicatat di sini juga.
        $learning->recordActiveDay($student);

        return response()->json(['data' => $learning->summary($student)]);
    }
}
