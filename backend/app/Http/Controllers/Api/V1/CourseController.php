<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignMentorRequest;
use App\Http\Requests\StoreCourseRequest;
use App\Http\Requests\UpdateCourseRequest;
use App\Http\Resources\CourseResource;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use App\Support\Like;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Course::class);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(Course::TYPES)],
            'status' => ['nullable', Rule::in(Course::STATUSES)],
            'mentor_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $courses = Course::query()
            ->visibleTo($request->user())
            ->with('mentor')
            ->withCount(['modules', 'sessions', 'activeEnrollments as participants_count'])
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(title) like ? escape '!'", [$like])
                    ->orWhereHas('mentor', fn (Builder $m) => $m->whereRaw("lower(name) like ? escape '!'", [$like])));
            })
            ->when($filters['type'] ?? null, fn (Builder $q, string $v) => $q->where('type', $v))
            ->when($filters['status'] ?? null, fn (Builder $q, string $v) => $q->where('status', $v))
            ->when($filters['mentor_id'] ?? null, fn (Builder $q, $v) => $q->where('mentor_id', $v))
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 12);

        return CourseResource::collection($courses);
    }

    public function store(StoreCourseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $actor = $request->user();

        $course = DB::transaction(function () use ($data, $actor, $request) {
            $course = new Course(collect($data)->only(['type', 'title', 'description'])->all());
            $course->status = $data['status'] ?? Course::STATUS_DRAFT;
            $course->created_by = $actor->id;
            $course->mentor_id = $actor->hasPermission('courses.assign_mentor')
                ? ($data['mentor_id'] ?? null)
                : ($actor->hasRole(Role::MENTOR) ? $actor->id : null);
            $course->save();

            AuditLog::record('course.created', $course, [
                'after' => ['type' => $course->type, 'title' => $course->title, 'status' => $course->status, 'mentor_id' => $course->mentor_id],
            ], $request);

            return $course;
        });

        return (new CourseResource($this->withSummary($course)))
            ->additional(['message' => 'Kursus berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Course $course): CourseResource
    {
        Gate::authorize('view', $course);

        return new CourseResource($this->withSummary($course));
    }

    public function update(UpdateCourseRequest $request, Course $course): CourseResource
    {
        $data = $request->validated();

        $before = $this->snapshot($course);

        DB::transaction(function () use ($course, $data, $before, $request) {
            $course->fill($data)->save();

            $after = $this->snapshot($course);
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                AuditLog::record('course.updated', $course, [
                    'before' => array_intersect_key($before, array_flip($changed)),
                    'after' => array_intersect_key($after, array_flip($changed)),
                ], $request);
            }
        });

        return (new CourseResource($this->withSummary($course)))->additional(['message' => 'Kursus berhasil diperbarui.']);
    }

    /** Menetapkan, mengganti, atau (untuk kursus yang belum aktif) mencabut Mentor. */
    public function assignMentor(AssignMentorRequest $request, Course $course): CourseResource
    {
        $mentorId = $request->validated('mentor_id');
        $previous = $course->mentor_id;

        DB::transaction(function () use ($course, $mentorId, $previous, $request) {
            $course->mentor_id = $mentorId;
            $course->save();

            if ($previous !== $course->mentor_id) {
                $name = fn (?int $id) => $id ? User::withTrashed()->whereKey($id)->value('name') : null;
                AuditLog::record('course.mentor_assigned', $course, [
                    'before' => ['mentor_id' => $previous, 'mentor' => $name($previous)],
                    'after' => ['mentor_id' => $mentorId, 'mentor' => $name($mentorId)],
                ], $request);
            }
        });

        return (new CourseResource($this->withSummary($course)))->additional(['message' => 'Mentor kursus berhasil diperbarui.']);
    }

    /** Soft delete. Kursus yang masih punya peserta aktif tidak dihapus, hanya dinonaktifkan. */
    public function destroy(Request $request, Course $course): JsonResponse
    {
        Gate::authorize('delete', $course);

        if ($course->activeEnrollments()->exists()) {
            throw ValidationException::withMessages([
                'course' => ['Kursus masih memiliki peserta aktif. Nonaktifkan kursus ini sebagai gantinya.'],
            ]);
        }

        DB::transaction(function () use ($course, $request) {
            $course->delete();
            AuditLog::record('course.deleted', $course, [], $request);
        });

        return response()->json(['message' => 'Kursus berhasil dihapus.']);
    }

    private function withSummary(Course $course): Course
    {
        return $course->load('mentor')->loadCount(['modules', 'sessions', 'activeEnrollments as participants_count']);
    }

    /** @return array<string,mixed> */
    private function snapshot(Course $course): array
    {
        return [
            'title' => $course->title,
            'description' => $course->description === null ? null : Str::limit($course->description, 200),
            'status' => $course->status,
        ];
    }
}
