<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse|UserResource
    {
        // Sesi hanya tersedia jika request datang dari domain frontend "stateful" (Sanctum).
        if (! $request->hasSession()) {
            return response()->json([
                'message' => 'Login hanya dapat dilakukan dari aplikasi frontend yang terdaftar (periksa SANCTUM_STATEFUL_DOMAINS).',
            ], 400);
        }

        if (! Auth::guard('web')->attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Email atau kata sandi salah.'],
            ]);
        }

        /** @var User $user */
        $user = Auth::guard('web')->user();

        if (! $user->isActive()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => 'Akun Anda tidak aktif. Hubungi Admin.',
                'code' => 'account_inactive',
            ], 403);
        }

        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();
        $user->load('roles.permissions');

        return (new UserResource($user))->additional(['message' => 'Login berhasil.']);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logout berhasil.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('roles.permissions'));
    }

    /**
     * Ganti kata sandi milik sendiri. Dipakai juga untuk mengganti kata sandi sementara dari Admin
     * (menghapus penanda must_change_password). Perangkat lain dikeluarkan; sesi ini dipertahankan.
     */
    public function changePassword(ChangePasswordRequest $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        DB::transaction(function () use ($user, $request) {
            $user->forceFill([
                'password' => $request->validated('password'),
                'must_change_password' => false,
            ])->save();

            // Nilai kata sandi TIDAK dicatat.
            AuditLog::record('auth.password_changed', $user, [], $request);
        });

        // Perangkat lain dikeluarkan. Sesi ini dipertahankan (id baru setelah regenerate);
        // jika request tidak punya sesi, semua sesi dicabut.
        if ($request->hasSession()) {
            $request->session()->regenerate();
            $user->revokeSessions($request->session()->getId());
        } else {
            $user->revokeSessions();
        }

        return (new UserResource($user->fresh()->load('roles.permissions')))
            ->additional(['message' => 'Kata sandi berhasil diganti.']);
    }
}
