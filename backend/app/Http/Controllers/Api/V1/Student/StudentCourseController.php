<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Http\Controllers\Controller;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Material;
use App\Models\Role;
use App\Services\StudentLearningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Kursus dan kurikulum yang diikuti Siswa (FR-39, FR-44).
 * Hanya kursus dengan enrollment aktif milik pengguna sendiri (dijamin Course::visibleTo).
 */
class StudentCourseController extends Controller
{
    public function index(Request $request, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');

        $courses = $learning->courses($student)->map(function (Course $course) use ($student, $learning) {
            $progress = $learning->progress($student, $course);
            $completed = $learning->completedMaterialIds($student, $course->modules->flatMap(fn ($module) => $module->materials->pluck('id')));

            return [
                'id' => $course->id,
                'title' => $course->title,
                'description' => $course->description,
                'type' => $course->type,
                'type_label' => $course->typeLabel(),
                'source' => $course->isInstitutionProgram() ? 'lembaga' : 'reguler',
                'owner' => $course->isInstitutionProgram()
                    ? ($course->creator?->name ?? 'Lembaga Bimbingan')
                    : ($course->mentor?->name ?? 'Mentor'),
                'modules_count' => $course->modules->count(),
                'materials_count' => $progress['total'],
                'materials_done' => $progress['done'],
                'progress' => $progress['percent'],
                'sessions_count' => $course->sessions_count,
                'total_xp' => (int) $course->modules->flatMap(fn ($module) => $module->materials)->sum('xp_points'),
                'earned_xp' => $learning->materialXp($student, $course),
                'study_minutes_this_month' => $learning->studyMinutesThisMonth($student, $course),
                'published_at' => $course->created_at?->toDateString(),
                'modules' => $course->modules->map(fn ($module) => [
                    'id' => $module->id,
                    'title' => $module->title,
                    'materials_count' => $module->materials->count(),
                    'completed' => $module->materials->isNotEmpty()
                        && $module->materials->every(fn (Material $material) => isset($completed[$material->id])),
                ])->values(),
            ];
        })->values();

        return response()->json(['data' => $courses, 'meta' => ['total' => $courses->count()]]);
    }

    public function show(Request $request, Course $course, StudentLearningService $learning): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->hasRole(Role::SISWA), 403, 'Halaman ini hanya untuk Siswa.');
        abort_unless($learning->isEnrolled($student, $course), 403, 'Anda tidak terdaftar pada kursus ini.');

        $course->load(['mentor', 'creator', 'modules.materials']);
        $progress = $learning->progress($student, $course);
        $completed = $learning->completedMaterialIds($student, $course->modules->flatMap(fn ($module) => $module->materials->pluck('id')));

        $modules = $course->modules->map(fn ($module) => [
            'id' => $module->id,
            'title' => $module->title,
            'description' => $module->description,
            'materials' => $module->materials->map(fn (Material $material) => [
                'id' => $material->id,
                'title' => $material->title,
                'description' => $material->description,
                'type' => $material->type,
                'type_label' => Material::TYPE_LABELS[$material->type] ?? $material->type,
                'duration_minutes' => $material->duration_minutes,
                'xp_points' => (int) $material->xp_points,
                'completed' => isset($completed[$material->id]),
                'completed_at' => isset($completed[$material->id])
                    ? \App\Models\MaterialCompletion::query()
                        ->where('user_id', $student->id)->where('material_id', $material->id)->value('completed_at')
                    : null,
                'has_file' => $material->hasFile(),
                'external_url' => $material->external_url,
            ])->values(),
            'completed' => $module->materials->isNotEmpty()
                && $module->materials->every(fn (Material $material) => isset($completed[$material->id])),
        ])->values();

        $sessions = ClassSession::query()
            ->where('course_id', $course->id)
            ->where('status', '!=', ClassSession::STATUS_CANCELLED)
            ->orderBy('starts_at')
            ->get()
            ->map(fn (ClassSession $session) => [
                'id' => $session->id,
                'title' => $session->title,
                'starts_at' => $session->starts_at?->toIso8601String(),
                'ends_at' => $session->ends_at?->toIso8601String(),
                'mode' => $session->mode,
                'location' => $session->location,
                'time_status' => $session->timeStatus(),
                'can_join' => $learning->canJoin($session),
            ]);

        return response()->json(['data' => [
            'id' => $course->id,
            'title' => $course->title,
            'description' => $course->description,
            'type' => $course->type,
            'type_label' => $course->typeLabel(),
            'source' => $course->isInstitutionProgram() ? 'lembaga' : 'reguler',
            'owner' => $course->isInstitutionProgram()
                ? ($course->creator?->name ?? 'Lembaga Bimbingan')
                : ($course->mentor?->name ?? 'Mentor'),
            'progress' => $progress['percent'],
            'materials_done' => $progress['done'],
            'materials_total' => $progress['total'],
            'modules_done' => $progress['modules_done'],
            'modules_total' => $progress['modules_total'],
            'total_xp' => (int) $course->modules->flatMap(fn ($module) => $module->materials)->sum('xp_points'),
            'earned_xp' => $learning->materialXp($student, $course),
            'study_minutes_this_month' => $learning->studyMinutesThisMonth($student, $course),
            'modules' => $modules,
            'sessions' => $sessions,
        ]]);
    }
}
