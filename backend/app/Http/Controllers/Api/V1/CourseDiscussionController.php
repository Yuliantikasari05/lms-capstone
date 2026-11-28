<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseDiscussionResource;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\CourseDiscussion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Forum diskusi kursus. Siapa pun yang boleh melihat isi kursus (peserta terdaftar, Mentor,
 * Lembaga pemilik program, Admin) boleh membaca dan membalas; penulis atau pengelola isi
 * kursus boleh mengubah/menghapus.
 */
class CourseDiscussionController extends Controller
{
    public function index(Request $request, Course $course)
    {
        Gate::authorize('viewContent', $course);

        $discussions = $course->discussions()
            ->with('author.roles')
            ->withCount('replies')
            ->latest('id')
            ->paginate(min(50, max(1, $request->integer('per_page', 20))));

        return CourseDiscussionResource::collection($discussions);
    }

    public function show(CourseDiscussion $discussion): CourseDiscussionResource
    {
        Gate::authorize('viewContent', $discussion->course);

        $discussion->increment('views');

        return new CourseDiscussionResource(
            $discussion->load(['author.roles', 'replies.author.roles'])->loadCount('replies'),
        );
    }

    public function store(Request $request, Course $course): JsonResponse
    {
        Gate::authorize('viewContent', $course);

        $data = $this->validated($request);

        $discussion = DB::transaction(function () use ($data, $course, $request) {
            $discussion = new CourseDiscussion($data);
            $discussion->course_id = $course->id;
            $discussion->user_id = $request->user()->id;
            $discussion->save();

            AuditLog::record('discussion.created', $discussion, ['course_id' => $course->id], $request);

            return $discussion;
        });

        return (new CourseDiscussionResource($discussion->load('author.roles')->loadCount('replies')))
            ->additional(['message' => 'Diskusi berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, CourseDiscussion $discussion): CourseDiscussionResource
    {
        Gate::authorize('update', $discussion);

        $discussion->fill($this->validated($request))->save();

        AuditLog::record('discussion.updated', $discussion, ['course_id' => $discussion->course_id], $request);

        return new CourseDiscussionResource($discussion->load('author.roles')->loadCount('replies'));
    }

    public function destroy(Request $request, CourseDiscussion $discussion): JsonResponse
    {
        Gate::authorize('delete', $discussion);

        DB::transaction(function () use ($discussion, $request) {
            $discussion->delete();
            AuditLog::record('discussion.deleted', $discussion, ['course_id' => $discussion->course_id], $request);
        });

        return response()->json(['message' => 'Diskusi berhasil dihapus.']);
    }

    /** @return array{title: string, body: string} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:5000'],
        ], [
            'title.required' => 'Judul diskusi wajib diisi.',
            'title.max' => 'Judul diskusi maksimal 150 karakter.',
            'body.required' => 'Isi diskusi wajib diisi.',
            'body.max' => 'Isi diskusi maksimal 5000 karakter.',
        ]);
    }
}
