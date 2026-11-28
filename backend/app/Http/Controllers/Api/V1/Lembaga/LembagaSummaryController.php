<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Http\Resources\LembagaProgramResource;
use App\Support\Lembaga\LembagaContext;
use Illuminate\Http\Request;

/** GET /lembaga/summary — kartu ringkasan dan program terbaru untuk dashboard Lembaga. */
class LembagaSummaryController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        $institution = LembagaContext::institution($user);

        $programs = LembagaContext::programsQuery($user)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(3)
            ->get();

        return response()->json([
            'data' => [
                'institution' => [
                    'id' => $institution->id,
                    'name' => $institution->name,
                    'description' => $institution->description,
                    'phone' => $institution->phone,
                    'address' => $institution->address,
                    'revenue_share_percent' => $institution->revenue_share_percent,
                    'bank' => [
                        'configured' => $institution->hasBankAccount(),
                        'label' => $institution->bankLabel(),
                    ],
                ],
                'cards' => LembagaContext::summary($user),
                'programs' => LembagaProgramResource::collection($programs)->resolve($request),
            ],
        ]);
    }
}
