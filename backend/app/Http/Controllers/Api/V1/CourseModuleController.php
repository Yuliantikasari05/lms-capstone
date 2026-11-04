<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ModuleRequest;
use App\Http\Requests\ReorderRequest;
use App\Http\Resources\CourseModuleResource;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\CourseModule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CourseModuleController extends Controller
{
    /** Daftar modul beserta materinya, berurutan. */
    public function index(Course $course)
    {
        Gate::authorize('viewContent', $course);

        $modules = $course->modules()->with('materials')->get();

        return CourseModuleResource::collection($modules);
    }

    public function store(ModuleRequest $request, Course $course): JsonResponse
    {
        $module = DB::transaction(function () use ($request, $course) {
            $module = new CourseModule(['title' => $request->validated('title')]);
            $module->course_id = $course->id;
            $module->position = ((int) $course->modules()->max('position')) + 1;
            $module->save();

            AuditLog::record('module.created', $module, ['course_id' => $course->id], $request);

            return $module;
        });

        return (new CourseModuleResource($module->load('materials')))
            ->additional(['message' => 'Modul berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(ModuleRequest $request, CourseModule $module): CourseModuleResource
    {
        $before = $module->title;

        DB::transaction(function () use ($request, $module, $before) {
            $module->title = $request->validated('title');
            $module->save();

            if ($before !== $module->title) {
                AuditLog::record('module.updated', $module, [
                    'course_id' => $module->course_id,
                    'before' => ['title' => $before],
                    'after' => ['title' => $module->title],
                ], $request);
            }
        });

        return (new CourseModuleResource($module->load('materials')))->additional(['message' => 'Modul berhasil diperbarui.']);
    }

    /** Soft delete modul beserta materinya. File fisik tetap ada sampai dibersihkan (lms:purge-material-files). */
    public function destroy(Request $request, CourseModule $module): JsonResponse
    {
        $course = $module->course;
        abort_if($course->trashed(), 404);
        Gate::authorize('manageContent', $course);

        DB::transaction(function () use ($request, $module) {
            $module->materials()->delete();
            $module->delete();
            AuditLog::record('module.deleted', $module, ['course_id' => $module->course_id], $request);
        });

        return response()->json(['message' => 'Modul berhasil dihapus.']);
    }

    public function reorder(ReorderRequest $request, Course $course): JsonResponse
    {
        $ids = array_map('intval', $request->validated('ids'));

        DB::transaction(function () use ($request, $course, $ids) {
            foreach ($ids as $index => $id) {
                $course->modules()->whereKey($id)->update(['position' => $index + 1]);
            }

            AuditLog::record('module.reordered', $course, ['order' => $ids], $request);
        });

        return response()->json([
            'data' => CourseModuleResource::collection($course->modules()->with('materials')->get())->resolve($request),
            'message' => 'Urutan modul berhasil disimpan.',
        ]);
    }
}
