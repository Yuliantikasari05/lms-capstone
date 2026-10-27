<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', User::class);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'exists:roles,slug'],
            'status' => ['nullable', Rule::in(User::STATUSES)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::query()
            ->with('roles')
            ->when($filters['q'] ?? null, function ($query, string $term) {
                $like = '%'.mb_strtolower($term).'%';
                $query->where(fn ($q) => $q
                    ->whereRaw('lower(name) like ?', [$like])
                    ->orWhereRaw('lower(email) like ?', [$like]));
            })
            ->when($filters['role'] ?? null, fn ($query, string $role) => $query->whereHas('roles', fn ($q) => $q->where('slug', $role)))
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->orderBy('name')
            ->paginate($filters['per_page'] ?? 15);

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'status' => $data['status'] ?? User::STATUS_ACTIVE,
        ]);
        $user->roles()->sync([Role::where('slug', $data['role'])->firstOrFail()->id]);

        return (new UserResource($user->load('roles')))
            ->additional(['message' => 'Pengguna berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
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

        $user->fill(collect($data)->only(['name', 'email', 'status'])->all());

        if (! empty($data['password'])) {
            $user->password = $data['password'];
        }

        $user->save();

        if (isset($data['role'])) {
            $user->roles()->sync([Role::where('slug', $data['role'])->firstOrFail()->id]);
        }

        return (new UserResource($user->load('roles')))->additional(['message' => 'Pengguna berhasil diperbarui.']);
    }

    public function destroy(User $user): JsonResponse
    {
        Gate::authorize('delete', $user);

        $user->delete();

        return response()->json(['message' => 'Pengguna berhasil dihapus.']);
    }
}
