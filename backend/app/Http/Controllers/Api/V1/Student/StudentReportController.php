<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Services\StudentReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Laporan belajar Siswa bulanan (FR-42, FR-47). */
class StudentReportController extends Controller
{
    public function __invoke(Request $request, StudentReportService $report): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        return response()->json(['data' => $report->build($student, $validated['month'] ?? null)]);
    }
}
