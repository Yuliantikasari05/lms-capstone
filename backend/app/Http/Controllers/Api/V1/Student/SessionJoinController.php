<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\Role;
use App\Models\SessionAttendance;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * "Gabung sesi" (aturan bisnis 2 Nov 2026): tombol aktif 15 menit sebelum sesi sampai sesi selesai.
 * Kehadiran dicatat saat peserta menekan tombol, lalu tautan meeting (sesi online) dikembalikan.
 */
class SessionJoinController extends Controller
{
    public function __invoke(Request $request, ClassSession $session, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $course = $session->course;
        abort_if($course === null, 404, 'Sesi tidak ditemukan.');
        abort_unless($learning->isEnrolled($student, $course), 403, 'Anda tidak terdaftar pada kursus ini.');

        if (($session->status ?? ClassSession::STATUS_SCHEDULED) === ClassSession::STATUS_CANCELLED) {
            abort(422, 'Sesi ini dibatalkan.');
        }
        if (! $learning->canJoin($session)) {
            abort(422, 'Sesi dapat diikuti mulai 15 menit sebelum jadwal sampai sesi selesai.');
        }

        $attendance = SessionAttendance::query()->firstOrCreate(
            ['class_session_id' => $session->id, 'user_id' => $student->id],
            ['joined_at' => now()],
        );

        return response()->json([
            'data' => [
                'session_id' => $session->id,
                'mode' => $session->mode,
                'location' => $session->location,
                // Sesi offline tidak punya tautan; peserta diarahkan ke lokasi.
                'meeting_url' => $session->isOffline() ? null : $session->meeting_url,
                'joined_at' => $attendance->joined_at?->toIso8601String(),
            ],
            'message' => $attendance->wasRecentlyCreated ? 'Kehadiran tercatat.' : 'Anda sudah tercatat pada sesi ini.',
        ]);
    }
}
