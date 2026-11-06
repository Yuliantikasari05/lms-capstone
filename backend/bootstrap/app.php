<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureHasPermission;
use App\Http\Middleware\EnsurePasswordIsChanged;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withCommands([__DIR__.'/../app/Console/Commands'])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum SPA: sesi + CSRF berbasis cookie untuk request dari domain frontend (stateful).
        $middleware->statefulApi();

        $middleware->alias([
            'permission' => EnsureHasPermission::class,
            'active' => EnsureAccountIsActive::class,
            'password.changed' => EnsurePasswordIsChanged::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Semua error di bawah /api selalu dikembalikan sebagai JSON (401, 403, 404, 422, dst).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $e) => $request->is('api/*') || $request->expectsJson()
        );

        // Bentuk galat HTTP (403, 404, 405, 429, dst.) di bawah /api selalu sama: {"message": "..."} dengan kode status dan
        // header aslinya (mis. Allow pada 405, Retry-After pada 429). Tanpa ini, 404 "data tidak ada" menyebut nama model
        // internal (mis. "No query results for model [App\Models\Course]"), dan saat APP_DEBUG=true semua galat HTTP
        // membocorkan jejak (trace) beserta path file server. Pesan buatan sendiri lewat abort(404, '...') tetap dipakai.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();
            $message = $e->getMessage();

            if ($e instanceof NotFoundHttpException) {
                if ($e->getPrevious() instanceof ModelNotFoundException || $message === '') {
                    $message = 'Data tidak ditemukan.';
                } elseif (str_starts_with($message, 'The route ')) {
                    $message = 'Endpoint tidak ditemukan.';
                }
            }

            return response()->json(
                ['message' => $message !== '' ? $message : (Response::$statusTexts[$status] ?? 'Terjadi kesalahan.')],
                $status,
                $e->getHeaders(),
            );
        });
    })
    ->create();
