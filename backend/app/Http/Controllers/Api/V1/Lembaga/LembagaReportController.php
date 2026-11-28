<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Http\Resources\LembagaProgramResource;
use App\Support\Lembaga\LembagaContext;
use Illuminate\Http\Request;

/** GET /lembaga/reports — ringkasan pendapatan, pendaftar, dan harga tiap program lembaga. */
class LembagaReportController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        $programs = LembagaContext::programsQuery($user)
            ->orderByDesc('revenue')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => [
                'summary' => LembagaContext::summary($user),
                'programs' => LembagaProgramResource::collection($programs)->resolve($request),
            ],
        ]);
    }
}
