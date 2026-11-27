<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Material;
use App\Models\Role;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Progres materi Siswa: tandai selesai (XP sekali) dan sinyal waktu belajar 1 menit. */
class MaterialProgressController extends Controller
{
    public function complete(Request $request, Material $material, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $course = $material->module?->course;
        abort_if($course === null, 404, 'Materi tidak ditemukan.');
        abort_unless($learning->isEnrolled($student, $course), 403, 'Anda tidak terdaftar pada kursus ini.');

        $result = $learning->completeMaterial($student, $material);

        return response()->json([
            'data' => $result,
            'message' => $result['xp_awarded'] > 0
                ? "Materi selesai. Anda mendapat {$result['xp_awarded']} XP."
                : 'Materi sudah pernah diselesaikan.',
        ]);
    }

    public function study(Request $request, Material $material, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $course = $material->module?->course;
        abort_if($course === null, 404, 'Materi tidak ditemukan.');
        abort_unless($learning->isEnrolled($student, $course), 403, 'Anda tidak terdaftar pada kursus ini.');

        return response()->json([
            'data' => ['minutes_today' => $learning->recordStudyMinute($student, $course)],
            'message' => 'Waktu belajar tercatat.',
        ]);
    }
}
