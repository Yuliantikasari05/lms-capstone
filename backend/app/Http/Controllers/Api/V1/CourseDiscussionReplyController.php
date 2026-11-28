<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseDiscussionReplyResource;
use App\Models\Course;
use App\Models\CourseDiscussion;
use App\Models\CourseDiscussionReply;
use App\Models\Role;
use App\Models\User;
use App\Notifications\LearningNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** Balasan diskusi kursus. Semua peserta boleh membalas; penulis/pengelola kursus boleh mengubah atau menghapus. */
class CourseDiscussionReplyController extends Controller
{
    public function store(Request $request, CourseDiscussion $discussion): JsonResponse
    {
        Gate::authorize('viewContent', $discussion->course);

        $data = $this->validated($request);

        $reply = new CourseDiscussionReply($data);
        $reply->course_discussion_id = $discussion->id;
        $reply->user_id = $request->user()->id;
        $reply->save();

        $this->notifyDiscussionAuthor($discussion, $request->user());

        return (new CourseDiscussionReplyResource($reply->load('author.roles')))
            ->additional(['message' => 'Balasan berhasil dikirim.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, CourseDiscussionReply $reply): CourseDiscussionReplyResource
    {
        Gate::authorize('update', $reply);

        $reply->fill($this->validated($request))->save();

        return new CourseDiscussionReplyResource($reply->load('author.roles'));
    }

    public function destroy(CourseDiscussionReply $reply): JsonResponse
    {
        Gate::authorize('delete', $reply);

        $reply->delete();

        return response()->json(['message' => 'Balasan berhasil dihapus.']);
    }

    /**
     * Beri tahu penulis topik bahwa ada balasan baru (notifikasi dalam aplikasi).
     * Balasan pada tulisan sendiri dan penulis yang sudah nonaktif/dihapus tidak dikirimi.
     */
    private function notifyDiscussionAuthor(CourseDiscussion $discussion, User $actor): void
    {
        $discussion->loadMissing('author');
        $author = $discussion->author;

        if ($author === null || $author->is($actor) || $author->trashed() || ! $author->isActive()) {
            return;
        }

        $discussion->loadMissing('course');
        $course = $discussion->course;

        $author->notify(new LearningNotification(
            LearningNotification::CATEGORY_DISCUSSION,
            'Balasan baru: '.$discussion->title,
            $actor->name.' membalas diskusi Anda di '.$course->title.'.',
            $actor->name,
            $actor->roles->first()?->name ?? 'Peserta',
            'Lihat diskusi',
            $this->discussionHref($author, $course),
        ));
    }

    /** Halaman forum yang tersedia untuk role penerima (setiap role punya ruang sendiri). */
    private function discussionHref(User $user, Course $course): string
    {
        if ($user->hasRole(Role::LEMBAGA)) {
            return '/lembaga/modules';
        }

        if ($user->hasRole(Role::MENTOR)) {
            return '/mentor/courses/'.$course->id;
        }

        if ($user->hasRole(Role::SISWA)) {
            return '/siswa/materials/'.$course->id;
        }

        if ($user->hasRole(Role::KARYAWAN)) {
            return '/karyawan/notifications';
        }

        return '/admin/courses';
    }

    /** @return array{body: string} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ], [
            'body.required' => 'Isi balasan wajib diisi.',
            'body.max' => 'Isi balasan maksimal 5000 karakter.',
        ]);
    }
}
