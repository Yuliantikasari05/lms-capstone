<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class AdminSummaryController extends Controller
{
    /** Ringkasan dashboard Admin. Hanya data yang benar-benar ada di database. */
    public function __invoke(): JsonResponse
    {
        $byRole = Role::withCount('users')->orderBy('id')->get()
            ->map(fn (Role $role) => ['slug' => $role->slug, 'name' => $role->name, 'users_count' => $role->users_count])
            ->values();

        $recentLogins = User::with('roles')
            ->whereNotNull('last_login_at')
            ->orderByDesc('last_login_at')
            ->limit(8)
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->roles->first()?->name,
                'last_login_at' => $user->last_login_at->toIso8601String(),
            ])
            ->values();

        return response()->json(['data' => [
            'users_total' => User::count(),
            'users_active' => User::where('status', User::STATUS_ACTIVE)->count(),
            'mentors_total' => $byRole->firstWhere('slug', Role::MENTOR)['users_count'] ?? 0,
            // Modul kursus belum ada pada tahap ini.
            'courses_total' => null,
            'users_by_role' => $byRole,
            'recent_logins' => $recentLogins,
        ]]);
    }
}
