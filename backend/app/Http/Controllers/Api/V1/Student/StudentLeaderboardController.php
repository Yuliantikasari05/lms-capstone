<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Papan peringkat Siswa (FR-38). Peringkat dibagi dengan aturan kompetisi (XP sama = nomor sama).
 * Admin memakai papan peringkat global di /gamification; endpoint ini khusus peserta.
 */
class StudentLeaderboardController extends Controller
{
    public function __invoke(Request $request, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $validated = $request->validate([
            'period' => ['nullable', Rule::in(['week', 'month', 'all'])],
        ]);

        $period = $validated['period'] ?? 'week';
        $rows = $learning->leaderboard($student, $period);

        return response()->json([
            'data' => $rows,
            'meta' => [
                'period' => $period,
                'me' => collect($rows)->firstWhere('user_id', $student->id),
            ],
        ]);
    }
}
