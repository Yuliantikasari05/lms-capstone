<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ringkasan dashboard Mentor. Hanya kursus yang diampu pengguna ini yang dihitung, dan
 * semua angka berasal dari database (tidak ada data contoh).
 */
class MentorSummaryController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $courses = Course::query()
            ->where('mentor_id', $user->id)
            ->withCount(['modules', 'sessions', 'activeEnrollments as participants_count'])
            ->orderBy('title')
            ->get();

        $courseIds = $courses->pluck('id');

        $activeEnrollments = Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', Enrollment::STATUS_ACTIVE);

        $upcoming = ClassSession::query()
            ->whereIn('course_id', $courseIds)
            ->where('ends_at', '>=', now())
            ->with('course:id,title')
            ->orderBy('starts_at')
            ->limit(5)
            ->get();

        return response()->json(['data' => [
            'courses_total' => $courses->count(),
            'courses_active' => $courses->where('status', Course::STATUS_ACTIVE)->count(),
            'students_total' => (clone $activeEnrollments)->distinct()->count('user_id'),
            'students_active' => (clone $activeEnrollments)
                ->whereHas('user', fn ($query) => $query->where('status', User::STATUS_ACTIVE))
                ->distinct()
                ->count('user_id'),
            'new_students_this_month' => (clone $activeEnrollments)
                ->where('enrolled_at', '>=', now()->startOfMonth())
                ->distinct()
                ->count('user_id'),
            'upcoming_sessions_total' => ClassSession::query()
                ->whereIn('course_id', $courseIds)
                ->where('ends_at', '>=', now())
                ->count(),
            'upcoming_sessions' => $upcoming->map(fn (ClassSession $session) => [
                'id' => $session->id,
                'course_id' => $session->course_id,
                'course_title' => $session->course?->title,
                'title' => $session->title,
                'starts_at' => $session->starts_at?->toIso8601String(),
                'ends_at' => $session->ends_at?->toIso8601String(),
            ])->values(),
            'courses' => $courses->map(fn (Course $course) => [
                'id' => $course->id,
                'title' => $course->title,
                'type' => $course->type,
                'status' => $course->status,
                'modules_count' => $course->modules_count,
                'sessions_count' => $course->sessions_count,
                'participants_count' => $course->participants_count,
            ])->values(),
        ]]);
    }
}
