<?php

use App\Http\Controllers\Api\V1\GamificationSummaryController;
use App\Http\Controllers\Api\V1\LeaderboardController;
use App\Http\Controllers\Api\V1\LevelController;
use App\Http\Controllers\Api\V1\XpController;
use Illuminate\Support\Facades\Route;

/*
 | Gamifikasi (Admin): papan peringkat, ringkasan, XP Siswa, dan level.
 | Dimuat dari routes/api.php di dalam grup auth:sanctum + active + password.changed.
 | Otorisasi lewat permission gamification.view (baca) dan gamification.manage (ubah).
 */

Route::prefix('gamification')->group(function () {
    Route::middleware('permission:gamification.view')->group(function () {
        Route::get('leaderboard', LeaderboardController::class);
        Route::get('summary', GamificationSummaryController::class);
        Route::get('users/{user}/xp', [XpController::class, 'index']);
        Route::get('levels', [LevelController::class, 'index']);
        Route::get('levels/{level}', [LevelController::class, 'show']);
    });

    Route::middleware('permission:gamification.manage')->group(function () {
        Route::post('users/{user}/xp-adjustments', [XpController::class, 'adjust']);
        Route::post('users/{user}/xp-reset', [XpController::class, 'reset']);
        Route::post('levels', [LevelController::class, 'store']);
        Route::patch('levels/{level}', [LevelController::class, 'update']);
        Route::delete('levels/{level}', [LevelController::class, 'destroy']);
    });
});
