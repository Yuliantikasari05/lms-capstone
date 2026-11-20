<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeaderboardEntryResource;
use App\Services\LeaderboardService;
use Illuminate\Http\Request;

/** Papan peringkat Siswa (Admin). Otorisasi: middleware permission:gamification.view pada rute. */
class LeaderboardController extends Controller
{
    public function __invoke(Request $request, LeaderboardService $leaderboard)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        return LeaderboardEntryResource::collection($leaderboard->paginate($filters['q'] ?? null, $filters['per_page'] ?? 15));
    }
}
