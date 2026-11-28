<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\User;
use App\Support\Lembaga\LembagaContext;
use App\Support\Like;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * GET /lembaga/students dan /lembaga/students/{user}
 *
 * Hanya siswa yang punya pendaftaran aktif pada program milik lembaga ini. Siswa program lembaga lain
 * tidak pernah muncul (404 pada detail), sesuai prinsip "Lembaga hanya data miliknya".
 */
class LembagaStudentController extends Controller
{
    public function index(Request $request)
    {
        $programIds = LembagaContext::programIds($request->user());

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $students = LembagaContext::studentsQuery($programIds)
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(email) like ? escape '!'", [$like]));
            })
            ->orderBy('name')
            ->orderBy('id')
            ->paginate($filters['per_page'] ?? 15);

        $students->getCollection()->transform(fn (User $user) => $this->row($user));

        return response()->json([
            'data' => $students->items(),
            'links' => [
                'first' => $students->url(1),
                'last' => $students->url($students->lastPage()),
                'prev' => $students->previousPageUrl(),
                'next' => $students->nextPageUrl(),
            ],
            'meta' => [
                'current_page' => $students->currentPage(),
                'last_page' => $students->lastPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
            ],
        ]);
    }

    public function show(Request $request, User $user)
    {
        $programIds = LembagaContext::programIds($request->user());

        $student = LembagaContext::studentsQuery($programIds)->whereKey($user->id)->first();

        abort_if($student === null, 404, 'Data siswa tidak ditemukan pada program lembaga Anda.');

        $programs = $student->enrollments->map(fn (Enrollment $enrollment) => [
            'enrollment_id' => $enrollment->id,
            'course' => [
                'id' => $enrollment->course?->id,
                'title' => $enrollment->course?->title,
            ],
            'enrolled_at' => $enrollment->enrolled_at?->toIso8601String(),
            'status' => $enrollment->status,
            // Pencatatan progres materi belum ada; angka tidak dikarang (null = belum tersedia).
            'progress_percent' => null,
        ])->values();

        return response()->json([
            'data' => [
                ...$this->row($student),
                'programs' => $programs,
                'metrics' => [
                    'programs_count' => $programs->count(),
                    'progress_percent' => null,
                    'average_score' => null,
                    'certificates' => 0,
                ],
            ],
        ]);
    }

    /** @return array<string,mixed> */
    private function row(User $user): array
    {
        $enrollments = $user->relationLoaded('enrollments') ? $user->enrollments : collect();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'status_label' => $user->isActive() ? 'Aktif' : 'Nonaktif',
            'initials' => $this->initials($user->name),
            'enrolled_at' => $enrollments->first()?->enrolled_at?->toIso8601String(),
            'programs' => $enrollments->map(fn (Enrollment $e) => [
                'id' => $e->course?->id,
                'title' => $e->course?->title,
            ])->filter(fn ($program) => $program['id'] !== null)->values(),
        ];
    }

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];

        return strtoupper(implode('', array_map(fn ($part) => mb_substr($part, 0, 1), array_slice($parts, 0, 2))));
    }
}
