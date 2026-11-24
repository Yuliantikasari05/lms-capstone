<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InstitutionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePayoutRequest;
use App\Http\Requests\UpdatePayoutRequest;
use App\Http\Resources\InstitutionPayoutResource;
use App\Models\AuditLog;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Services\InstitutionPayoutService;
use App\Services\InstitutionRevenueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Riwayat dan proses pencairan dana Lembaga (tombol "Proses Pencairan Dana"). */
class InstitutionPayoutController extends Controller
{
    public function index(Request $request, Institution $institution, InstitutionRevenueService $revenue)
    {
        Gate::authorize('view', $institution);

        $filters = $request->validate([
            'status' => ['nullable', Rule::in(InstitutionPayout::STATUSES)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $payouts = $institution->payouts()
            ->with(['requester', 'processor'])
            ->when($filters['status'] ?? null, fn ($q, string $status) => $q->where('status', $status))
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 10);

        $balance = $revenue->balance($institution);

        return InstitutionPayoutResource::collection($payouts)->additional(['summary' => [
            'available_balance' => $balance['available'],
            'pending_total' => $balance['pending'],
            'completed_total' => $balance['completed'],
        ]]);
    }

    public function store(StorePayoutRequest $request, Institution $institution, InstitutionPayoutService $payouts): JsonResponse
    {
        $data = $request->validated();

        $payout = $this->guard(fn () => DB::transaction(function () use ($payouts, $institution, $data, $request) {
            $payout = $payouts->request($institution, $data['amount'] ?? null, $data['note'] ?? null, $request->user());

            AuditLog::record('institution.payout_requested', $payout, [
                'institution' => $institution->name,
                'amount' => $payout->amount,
                'destination' => $payout->destinationLabel(),
            ], $request);

            return $payout;
        }), 'amount');

        return (new InstitutionPayoutResource($payout->load(['requester', 'processor'])))
            ->additional(['message' => 'Pencairan dana diajukan dengan status Menunggu.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdatePayoutRequest $request, Institution $institution, InstitutionPayout $payout, InstitutionPayoutService $payouts): InstitutionPayoutResource
    {
        // Pencairan harus milik lembaga pada URL (mencegah mengubah pencairan lembaga lain).
        abort_unless($payout->institution_id === $institution->id, 404);

        $data = $request->validated();
        $completed = $data['status'] === InstitutionPayout::STATUS_COMPLETED;

        $payout = $this->guard(fn () => DB::transaction(function () use ($payouts, $payout, $data, $completed, $request, $institution) {
            $updated = $completed
                ? $payouts->complete($payout, $request->user(), $data['note'] ?? null)
                : $payouts->cancel($payout, $request->user(), $data['note'] ?? null);

            AuditLog::record($completed ? 'institution.payout_completed' : 'institution.payout_cancelled', $updated, [
                'institution' => $institution->name,
                'amount' => $updated->amount,
            ], $request);

            return $updated;
        }), 'status');

        return (new InstitutionPayoutResource($payout->load(['requester', 'processor'])))
            ->additional(['message' => $completed ? 'Pencairan dana ditandai selesai.' : 'Pencairan dana dibatalkan. Dana kembali ke saldo.']);
    }

    /** Pelanggaran aturan uang dari layanan menjadi galat validasi 422 yang bisa ditampilkan ke Admin. */
    private function guard(callable $callback, string $field): InstitutionPayout
    {
        try {
            return $callback();
        } catch (InstitutionException $e) {
            throw ValidationException::withMessages([$field => [$e->getMessage()]]);
        }
    }
}
