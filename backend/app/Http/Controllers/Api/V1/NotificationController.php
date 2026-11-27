<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Notifikasi milik pengguna yang login (self-service, tidak diatur matriks role).
 *
 * Semua query lewat relasi `$user->notifications()`, sehingga satu pengguna tidak mungkin
 * membaca atau menghapus notifikasi pengguna lain. Daftar dibatasi 100 terbaru; halaman
 * menyaring dan memilih sendiri dari daftar itu.
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => NotificationResource::collection(
                $user->notifications()->latest()->limit(100)->get(),
            )->resolve(),
            'meta' => ['unread_count' => $user->unreadNotifications()->count()],
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $record = $request->user()->notifications()->whereKey($notification)->firstOrFail();
        $record->markAsRead();

        return response()->json([
            'data' => (new NotificationResource($record->refresh()))->resolve(),
            'meta' => ['unread_count' => $request->user()->unreadNotifications()->count()],
        ]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json([
            'message' => 'Semua notifikasi ditandai sudah dibaca.',
            'meta' => ['unread_count' => 0],
        ]);
    }

    public function destroy(Request $request, string $notification): JsonResponse
    {
        $request->user()->notifications()->whereKey($notification)->firstOrFail()->delete();

        return response()->json([
            'message' => 'Notifikasi dihapus.',
            'meta' => ['unread_count' => $request->user()->unreadNotifications()->count()],
        ]);
    }

    public function clear(Request $request): JsonResponse
    {
        $request->user()->notifications()->delete();

        return response()->json(['message' => 'Semua notifikasi dihapus.']);
    }
}
