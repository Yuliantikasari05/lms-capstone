<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Jadwal Siswa (FR-37): sesi bimbingan kursus yang diikuti dan tenggat tugas. */
class StudentScheduleController extends Controller
{
    public function __invoke(Request $request, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        return response()->json(['data' => $learning->schedule($student)]);
    }
}
