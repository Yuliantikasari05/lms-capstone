<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\InstitutionPayoutResource;
use App\Http\Resources\InstitutionResource;
use App\Models\Institution;
use App\Services\InstitutionDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** Halaman detail "Manajemen Lembaga Bimbingan": profil, kartu, grafik, keuangan, program terlaris, voucher. */
class InstitutionDashboardController extends Controller
{
    public function __invoke(Request $request, Institution $institution, InstitutionDashboardService $dashboard): JsonResponse
    {
        Gate::authorize('view', $institution);

        $filters = $request->validate([
            'period' => ['nullable', Rule::in(array_keys(InstitutionDashboardService::PERIODS))],
        ]);

        $data = $dashboard->build($institution, $filters['period'] ?? InstitutionDashboardService::DEFAULT_PERIOD);
        $data['recent_payouts'] = InstitutionPayoutResource::collection($data['recent_payouts'])->resolve($request);

        return response()->json([
            'data' => $data,
            'institution' => (new InstitutionResource($institution->load('user')))->resolve($request),
            // Pilihan rentang waktu untuk tab di atas kartu.
            'periods' => collect(InstitutionDashboardService::PERIODS)
                ->map(fn (array $p, string $key) => ['key' => $key, 'label' => $p['label']])->values(),
        ]);
    }
}
