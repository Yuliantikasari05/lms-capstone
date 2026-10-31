<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Notifications\EmailAddressChanged;
use App\Support\TemporaryPassword;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UserController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', User::class);

        $filters = $this->validatedFilters($request);

        $users = $this->filteredQuery($filters)
            ->orderBy('name')
            ->orderBy('id') // urutan tetap stabil antar halaman
            ->paginate($filters['per_page'] ?? 15);

        return UserResource::collection($users);
    }

    /**
     * Admin TIDAK memilih kata sandi. Sistem membuat kata sandi sementara yang ditampilkan sekali
     * di response ini; pengguna wajib menggantinya saat login pertama.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $temporaryPassword = TemporaryPassword::generate();

        $user = DB::transaction(function () use ($data, $temporaryPassword, $request) {
            $user = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $temporaryPassword,
                'status' => $data['status'] ?? User::STATUS_ACTIVE,
            ]);
            $user->must_change_password = true;
            $user->save();

            $user->roles()->sync([Role::where('slug', $data['role'])->firstOrFail()->id]);

            AuditLog::record('user.created', $user, [
                'after' => ['name' => $user->name, 'email' => $user->email, 'role' => $data['role'], 'status' => $user->status],
            ], $request);

            return $user;
        });

        return (new UserResource($user->load('roles')))
            ->additional([
                'message' => 'Pengguna berhasil dibuat. Kata sandi sementara hanya ditampilkan sekali.',
                'temporary_password' => $temporaryPassword,
            ])
            ->response()
            ->setStatusCode(201)
            ->header('Cache-Control', 'no-store');
    }

    public function show(User $user): UserResource
    {
        Gate::authorize('view', $user);

        return new UserResource($user->load('roles'));
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $data = $request->validated();

        // Cegah Admin mengunci dirinya sendiri.
        if ($user->is($request->user())) {
            $currentRole = $user->roles()->value('slug');
            if ((isset($data['status']) && $data['status'] !== User::STATUS_ACTIVE)
                || (isset($data['role']) && $data['role'] !== $currentRole)) {
                throw ValidationException::withMessages([
                    'status' => ['Anda tidak dapat menonaktifkan atau mengubah role akun sendiri.'],
                ]);
            }
        }

        $user->loadMissing('roles');
        $before = [
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'role' => $user->roles->first()?->slug,
        ];

        DB::transaction(function () use ($user, $data, $before, $request) {
            $user->fill(collect($data)->only(['name', 'email', 'status'])->all());
            $user->save();

            if (isset($data['role'])) {
                $user->roles()->sync([Role::where('slug', $data['role'])->firstOrFail()->id]);
            }

            $user->load('roles');
            $after = [
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'role' => $user->roles->first()?->slug,
            ];

            // Hanya catat bidang yang benar-benar berubah.
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));
            if ($changed !== []) {
                AuditLog::record('user.updated', $user, [
                    'before' => array_intersect_key($before, array_flip($changed)),
                    'after' => array_intersect_key($after, array_flip($changed)),
                ], $request);
            }
        });

        // Pemilik akun diberi tahu di email LAMA (kegagalan kirim tidak menggagalkan perubahan).
        if ($before['email'] !== $user->email) {
            try {
                Notification::route('mail', $before['email'])->notify(new EmailAddressChanged($user->email, now()));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return (new UserResource($user->load('roles')))->additional(['message' => 'Pengguna berhasil diperbarui.']);
    }

    /** Soft delete: akun disembunyikan dan tidak bisa login, tetapi bisa dipulihkan. */
    public function destroy(Request $request, User $user): JsonResponse
    {
        Gate::authorize('delete', $user);

        DB::transaction(function () use ($user, $request) {
            $user->revokeSessions();
            $user->delete();
            AuditLog::record('user.deleted', $user, [], $request);
        });

        return response()->json(['message' => 'Pengguna berhasil dihapus.']);
    }

    public function restore(Request $request, User $user): UserResource
    {
        Gate::authorize('restore', $user);

        if (! $user->trashed()) {
            throw ValidationException::withMessages([
                'user' => ['Pengguna ini tidak dalam kondisi dihapus.'],
            ]);
        }

        DB::transaction(function () use ($user, $request) {
            $user->restore();
            AuditLog::record('user.restored', $user, [], $request);
        });

        return (new UserResource($user->load('roles')))->additional(['message' => 'Pengguna berhasil dipulihkan.']);
    }

    /**
     * Reset kata sandi oleh Admin: membuat kata sandi sementara baru (tampil sekali), mewajibkan
     * pengguna menggantinya, dan mengeluarkan pengguna dari semua perangkat.
     */
    public function resetPassword(Request $request, User $user): JsonResponse
    {
        Gate::authorize('resetPassword', $user);

        $temporaryPassword = TemporaryPassword::generate();

        DB::transaction(function () use ($user, $temporaryPassword, $request) {
            $user->password = $temporaryPassword;
            $user->must_change_password = true;
            $user->save();
            $user->revokeSessions();

            // Nilai kata sandi TIDAK dicatat.
            AuditLog::record('user.password_reset', $user, [], $request);
        });

        return response()->json([
            'data' => (new UserResource($user->load('roles')))->resolve($request),
            'message' => 'Kata sandi sementara dibuat. Pengguna wajib menggantinya saat login berikutnya.',
            'temporary_password' => $temporaryPassword,
        ])->header('Cache-Control', 'no-store');
    }

    /** Ekspor CSV memakai filter yang sama dengan daftar pengguna. Pengunduhan dicatat di audit log. */
    public function export(Request $request): StreamedResponse
    {
        Gate::authorize('export', User::class);

        $filters = $this->validatedFilters($request);
        $query = $this->filteredQuery($filters);
        $filename = 'pengguna-'.now()->format('Ymd-His').'.csv';

        AuditLog::record('user.exported', null, [
            'filters' => array_filter(
                array_intersect_key($filters, array_flip(['q', 'role', 'status', 'trashed'])),
                fn ($value) => $value !== null && $value !== ''
            ),
            'rows' => (clone $query)->count(),
        ], $request);

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');

            fwrite($out, "\xEF\xBB\xBF"); // BOM UTF-8 agar Excel membaca karakter Indonesia dengan benar
            fputcsv($out, ['ID', 'Nama', 'Email', 'Role', 'Status', 'Login Terakhir', 'Bergabung', 'Dihapus']);

            // lazyById membaca bertahap (500 baris), aman untuk jumlah pengguna besar.
            foreach ($query->lazyById(500) as $user) {
                fputcsv($out, array_map([self::class, 'csvSafe'], [
                    $user->id,
                    $user->name,
                    $user->email,
                    $user->roles->pluck('name')->implode(', '),
                    $user->statusLabel(),
                    $user->last_login_at?->format('Y-m-d H:i:s'),
                    $user->created_at?->format('Y-m-d H:i:s'),
                    $user->deleted_at?->format('Y-m-d H:i:s'),
                ]));
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array<string,mixed> */
    private function validatedFilters(Request $request): array
    {
        return $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'exists:roles,slug'],
            'status' => ['nullable', Rule::in(User::STATUSES)],
            // only = hanya akun yang dihapus, with = semuanya; kosong = hanya akun yang belum dihapus.
            'trashed' => ['nullable', Rule::in(['only', 'with'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
    }

    /** @param array<string,mixed> $filters */
    private function filteredQuery(array $filters): Builder
    {
        $trashed = $filters['trashed'] ?? null;

        return User::query()
            ->with('roles')
            ->when($trashed === 'only', fn (Builder $query) => $query->onlyTrashed())
            ->when($trashed === 'with', fn (Builder $query) => $query->withTrashed())
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                // Karakter % dan _ dari pengguna diperlakukan sebagai teks biasa, bukan wildcard.
                $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower((string) $filters['q']));
                $like = '%'.$escaped.'%';

                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(email) like ? escape '!'", [$like]));
            })
            ->when($filters['role'] ?? null, fn (Builder $query, string $role) => $query->whereHas('roles', fn ($q) => $q->where('slug', $role)))
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status));
    }

    /**
     * Mencegah CSV injection: sel yang diawali = + - @ (atau tab/enter) bisa dibaca Excel sebagai rumus.
     */
    public static function csvSafe(mixed $value): string
    {
        $text = (string) ($value ?? '');

        return $text !== '' && in_array($text[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$text : $text;
    }
}
