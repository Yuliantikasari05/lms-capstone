<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEnrollmentsRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\AuditLog;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Support\Like;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EnrollmentController extends Controller
{
    /** Daftar peserta sebuah kursus. Bawaan: hanya pendaftaran aktif (status=cancelled/all untuk riwayat). */
    public function index(Request $request, Course $course)
    {
        Gate::authorize('manageEnrollments', $course);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in([Enrollment::STATUS_ACTIVE, Enrollment::STATUS_CANCELLED, 'all'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $status = $filters['status'] ?? Enrollment::STATUS_ACTIVE;

        $enrollments = $course->enrollments()
            ->with(['user', 'enrolledBy'])
            ->when($status !== 'all', fn (Builder $q) => $q->where('status', $status))
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->whereHas('user', fn (Builder $u) => $u
                    ->whereRaw("lower(name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(email) like ? escape '!'", [$like]));
            })
            ->orderByDesc('enrolled_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15);

        return EnrollmentResource::collection($enrollments);
    }

    /**
     * Pengguna yang layak didaftarkan: berrole sesuai jenis kursus, akun aktif, dan belum terdaftar aktif.
     * Aturan ini ditentukan server agar daftar pilihan di layar selalu konsisten dengan validasi pendaftaran.
     */
    public function candidates(Request $request, Course $course)
    {
        Gate::authorize('manageEnrollments', $course);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::query()
            ->where('status', User::STATUS_ACTIVE)
            ->whereHas('roles', fn (Builder $r) => $r->where('slug', $course->participantRole()))
            ->whereDoesntHave('enrollments', fn (Builder $e) => $e->where('course_id', $course->id)->where('status', Enrollment::STATUS_ACTIVE))
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(email) like ? escape '!'", [$like]));
            })
            ->orderBy('name')->orderBy('id')
            ->paginate($filters['per_page'] ?? 20, ['id', 'name', 'email']);

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function store(StoreEnrollmentsRequest $request, Course $course): JsonResponse
    {
        $ids = array_map('intval', $request->validated('user_ids'));
        $actor = $request->user();

        $created = DB::transaction(function () use ($ids, $course, $actor, $request) {
            $result = [];

            foreach ($ids as $userId) {
                // Pendaftaran yang pernah dibatalkan diaktifkan kembali (satu baris per pasangan kursus-pengguna).
                $enrollment = Enrollment::query()->where('course_id', $course->id)->where('user_id', $userId)->first();
                $reactivated = $enrollment !== null;

                $enrollment ??= new Enrollment;
                $enrollment->course_id = $course->id;
                $enrollment->user_id = $userId;
                $enrollment->status = Enrollment::STATUS_ACTIVE;
                $enrollment->source = Enrollment::SOURCE_ADMIN;
                $enrollment->enrolled_by = $actor->id;
                $enrollment->enrolled_at = now();
                $enrollment->cancelled_at = null;
                $enrollment->save();

                AuditLog::record('enrollment.created', $enrollment, [
                    'course_id' => $course->id,
                    'user_id' => $userId,
                    'reactivated' => $reactivated ?: null,
                ], $request);

                $result[] = $enrollment;
            }

            // Eloquent Collection (bukan collect()) agar relasi bisa di-load sekaligus di bawah.
            return new EloquentCollection($result);
        });

        return response()->json([
            'data' => EnrollmentResource::collection($created->load(['user', 'enrolledBy']))->resolve($request),
            'message' => $created->count() === 1 ? 'Peserta berhasil didaftarkan.' : "{$created->count()} peserta berhasil didaftarkan.",
        ], 201);
    }

    /** Membatalkan pendaftaran. Baris dipertahankan sebagai riwayat (status cancelled). */
    public function destroy(Request $request, Enrollment $enrollment): JsonResponse
    {
        $course = $enrollment->course;
        abort_if($course->trashed(), 404);
        Gate::authorize('manageEnrollments', $course);

        if ($enrollment->status === Enrollment::STATUS_CANCELLED) {
            throw ValidationException::withMessages(['enrollment' => ['Pendaftaran ini sudah dibatalkan.']]);
        }

        DB::transaction(function () use ($enrollment, $course, $request) {
            $enrollment->status = Enrollment::STATUS_CANCELLED;
            $enrollment->cancelled_at = now();
            $enrollment->save();

            AuditLog::record('enrollment.cancelled', $enrollment, [
                'course_id' => $course->id,
                'user_id' => $enrollment->user_id,
            ], $request);
        });

        return response()->json(['message' => 'Pendaftaran peserta dibatalkan.']);
    }
}
