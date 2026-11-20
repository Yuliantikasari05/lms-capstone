<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\LeaderboardService;
use Illuminate\Http\JsonResponse;

/** Kartu ringkasan: rata-rata XP per pengguna, XP tertinggi, total XP. */
class GamificationSummaryController extends Controller
{
    public function __invoke(LeaderboardService $leaderboard): JsonResponse
    {
        return response()->json(['data' => $leaderboard->summary()]);
    }
}
