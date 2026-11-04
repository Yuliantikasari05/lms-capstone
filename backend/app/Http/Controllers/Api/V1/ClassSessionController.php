<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SessionRequest;
use App\Http\Resources\ClassSessionResource;
use App\Models\AuditLog;
use App\Models\ClassSession;
use App\Models\Course;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ClassSessionController extends Controller
{
    public function index(Course $course)
    {
        Gate::authorize('viewContent', $course);

        return ClassSessionResource::collection($course->sessions()->with('course.mentor')->get());
    }

    public function show(ClassSession $session): ClassSessionResource
    {
        $course = $this->courseOf($session);
        Gate::authorize('viewContent', $course);

        return new ClassSessionResource($session->load('course.mentor'));
    }

    public function store(SessionRequest $request, Course $course): JsonResponse
    {
        $data = $request->validated();

        $session = DB::transaction(function () use ($data, $course, $request) {
            $session = new ClassSession($data);
            $session->course_id = $course->id;
            $session->save();

            AuditLog::record('session.created', $session, [
                'course_id' => $course->id,
                'after' => $this->snapshot($session),
            ], $request);

            return $session;
        });

        return (new ClassSessionResource($session->load('course.mentor')))
            ->additional(['message' => 'Sesi berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(SessionRequest $request, ClassSession $session): ClassSessionResource
    {
        $data = $request->validated();
        $before = $this->snapshot($session);
        $oldUrl = $session->meeting_url;

        DB::transaction(function () use ($session, $data, $before, $oldUrl, $request) {
            $session->fill($data)->save();

            $after = $this->snapshot($session);
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));
            $urlChanged = $oldUrl !== $session->meeting_url;

            if ($changed !== [] || $urlChanged) {
                // Isi link meeting TIDAK dicatat (bisa memuat kode/passcode); hanya bahwa link berubah.
                AuditLog::record('session.updated', $session, array_filter([
                    'course_id' => $session->course_id,
                    'before' => array_intersect_key($before, array_flip($changed)) ?: null,
                    'after' => array_intersect_key($after, array_flip($changed)) ?: null,
                    'meeting_url_changed' => $urlChanged ?: null,
                ], fn ($v) => $v !== null), $request);
            }
        });

        return (new ClassSessionResource($session->load('course.mentor')))->additional(['message' => 'Sesi berhasil diperbarui.']);
    }

    public function destroy(Request $request, ClassSession $session): JsonResponse
    {
        $course = $this->courseOf($session);
        Gate::authorize('manageContent', $course);

        DB::transaction(function () use ($session, $course, $request) {
            $session->delete();
            AuditLog::record('session.deleted', $session, ['course_id' => $course->id], $request);
        });

        return response()->json(['message' => 'Sesi berhasil dihapus.']);
    }

    /**
     * Link meeting (Zoom/Google Meet) diambil lewat endpoint tersendiri, bukan ikut di daftar sesi.
     * Saat ini hanya untuk yang berhak mengelola kursus; aturan jendela waktu untuk peserta
     * ("aktif 15 menit sebelum sesi") dan pencatatan kehadiran ditambahkan di tahap 2b.
     */
    public function meetingLink(ClassSession $session): JsonResponse
    {
        $course = $this->courseOf($session);
        Gate::authorize('manageContent', $course);

        return response()->json(['data' => ['meeting_url' => $session->meeting_url]])
            ->header('Cache-Control', 'private, no-store');
    }

    private function courseOf(ClassSession $session): Course
    {
        $course = $session->course;
        abort_if($course->trashed(), 404);

        return $course;
    }

    /** @return array<string,mixed> */
    private function snapshot(ClassSession $session): array
    {
        return [
            'title' => $session->title,
            'starts_at' => $session->starts_at?->toIso8601String(),
            'ends_at' => $session->ends_at?->toIso8601String(),
        ];
    }
}
