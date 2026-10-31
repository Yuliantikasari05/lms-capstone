<?php

use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureHasPermission;
use App\Http\Middleware\EnsurePasswordIsChanged;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

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
    })
    ->create();
