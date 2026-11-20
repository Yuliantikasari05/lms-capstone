<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\XpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustXpRequest;
use App\Http\Requests\ResetXpRequest;
use App\Http\Resources\XpTransactionResource;
use App\Models\AuditLog;
use App\Models\Level;
use App\Models\Role;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\XpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * XP satu Siswa: riwayat, koreksi, dan reset. Semua perubahan lewat XpService (buku besar tidak dapat
 * diubah) dan tercatat di audit log dalam transaksi yang sama.
 */
class XpController extends Controller
{
    public function __construct(private readonly XpService $xp) {}

    public function index(Request $request, User $user)
    {
        $this->ensureStudent($user);

        $request->validate(['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        $transactions = XpTransaction::query()
            ->where('user_id', $user->id)
            ->with('creator')
            ->orderByDesc('id')
            ->paginate((int) $request->input('per_page', 20));

        return XpTransactionResource::collection($transactions)->additional($this->state($user));
    }

    public function adjust(AdjustXpRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();
        $before = $this->xp->balanceOf($user);

        $transaction = $this->attempt(fn () => DB::transaction(function () use ($user, $data, $request, $before) {
            $transaction = $this->xp->adjust($user, (int) $data['amount'], $data['reason'], $request->user());

            AuditLog::record('xp.adjusted', $user, [
                'amount' => (int) $data['amount'], 'reason' => $data['reason'],
                'before' => $before, 'after' => $before + (int) $data['amount'],
            ], $request);

            return $transaction;
        }));

        return (new XpTransactionResource($transaction->load('creator')))
            ->additional($this->state($user) + ['message' => 'XP berhasil dikoreksi.'])
            ->response()
            ->setStatusCode(201);
    }

    public function reset(ResetXpRequest $request, User $user): JsonResponse
    {
        $reason = $request->validated('reason');
        $before = $this->xp->balanceOf($user);

        $transaction = $this->attempt(fn () => DB::transaction(function () use ($user, $reason, $request, $before) {
            $transaction = $this->xp->reset($user, $reason, $request->user());

            AuditLog::record('xp.reset', $user, ['reason' => $reason, 'before' => $before, 'after' => 0], $request);

            return $transaction;
        }));

        return response()->json([
            'data' => (new XpTransactionResource($transaction->load('creator')))->resolve($request),
            'message' => 'XP berhasil direset ke 0.',
        ] + $this->state($user));
    }

    /** Menerjemahkan penolakan layanan XP menjadi galat validasi 422 per kolom. */
    private function attempt(callable $action): XpTransaction
    {
        try {
            return $action();
        } catch (XpException $e) {
            $field = match ($e->reason) {
                XpException::BELOW_ZERO, XpException::INVALID_AMOUNT => 'amount',
                default => 'user',
            };

            throw ValidationException::withMessages([$field => [$e->getMessage()]]);
        }
    }

    private function ensureStudent(User $user): void
    {
        abort_unless($user->hasRole(Role::SISWA), 404);
    }

    /** @return array{xp:int, level:array{id:int,name:string}|null} */
    private function state(User $user): array
    {
        $xp = $this->xp->balanceOf($user);
        $level = Level::resolve(Level::all(), $xp);

        return ['xp' => $xp, 'level' => $level ? ['id' => $level->id, 'name' => $level->name] : null];
    }
}
