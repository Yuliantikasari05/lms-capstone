<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pengguna yang masih memakai kata sandi sementara (dari Admin) hanya boleh membuka
 * /auth/me dan /auth/password (logout berada di luar grup ini). Selain itu ditolak 403.
 */
class EnsurePasswordIsChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password && ! $request->routeIs('auth.me', 'auth.password')) {
            return response()->json([
                'message' => 'Anda harus mengganti kata sandi sementara terlebih dahulu.',
                'code' => 'password_change_required',
            ], 403);
        }

        return $next($request);
    }
}
