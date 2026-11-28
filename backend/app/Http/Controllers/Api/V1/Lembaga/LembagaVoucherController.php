<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLembagaVoucherRequest;
use App\Http\Requests\UpdateLembagaVoucherRequest;
use App\Models\AuditLog;
use App\Models\Coupon;
use App\Support\Lembaga\LembagaContext;
use App\Support\Like;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Voucher promosi milik Lembaga (tabel kupon dengan owner_type = institution).
 * Kode voucher unik di seluruh platform, termasuk kupon Admin, agar tidak ada dua arti untuk satu kode.
 */
class LembagaVoucherController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(Coupon::STATUSES)],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = $this->owned($request)->with('course:id,title')->withCount('redemptions');

        if ($filters['status'] ?? null) {
            $query->withStatus($filters['status']);
        }

        $vouchers = $query
            ->when(filled($filters['q'] ?? null), function (Builder $q) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $q->where(fn (Builder $inner) => $inner
                    ->whereRaw("lower(name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(code) like ? escape '!'", [$like]));
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 50);

        return response()->json([
            'data' => $vouchers->getCollection()->map(fn (Coupon $coupon) => $this->item($coupon))->values(),
            'meta' => [
                'current_page' => $vouchers->currentPage(),
                'last_page' => $vouchers->lastPage(),
                'per_page' => $vouchers->perPage(),
                'total' => $vouchers->total(),
            ],
            'summary' => LembagaContext::voucherMetrics($this->owned($request)->withCount('redemptions')->get()),
        ]);
    }

    public function show(Request $request, Coupon $coupon)
    {
        return response()->json(['data' => $this->item($this->own($request, $coupon)->loadCount('redemptions')->load('course:id,title'))]);
    }

    public function store(StoreLembagaVoucherRequest $request): JsonResponse
    {
        $data = $request->validated();

        $coupon = new Coupon;
        $coupon->fill($this->payload($data));
        $coupon->owner_type = Coupon::OWNER_INSTITUTION;
        $coupon->owner_id = $request->user()->id;
        $coupon->created_by = $request->user()->id;
        $coupon->save();

        AuditLog::record('lembaga.voucher_created', $coupon, ['code' => $coupon->code], $request);

        return response()->json([
            'data' => $this->item($coupon->loadCount('redemptions')->load('course:id,title')),
            'message' => 'Voucher berhasil dibuat.',
        ], 201);
    }

    public function update(UpdateLembagaVoucherRequest $request, Coupon $coupon): JsonResponse
    {
        $coupon = $this->own($request, $coupon);
        $coupon->fill($this->payload($request->validated(), updating: true))->save();

        AuditLog::record('lembaga.voucher_updated', $coupon, ['code' => $coupon->code], $request);

        return response()->json([
            'data' => $this->item($coupon->loadCount('redemptions')->load('course:id,title')),
            'message' => 'Voucher berhasil diperbarui.',
        ]);
    }

    public function destroy(Request $request, Coupon $coupon): JsonResponse
    {
        $coupon = $this->own($request, $coupon);
        $coupon->delete();

        AuditLog::record('lembaga.voucher_deleted', $coupon, ['code' => $coupon->code], $request);

        return response()->json(['message' => 'Voucher berhasil dihapus.']);
    }

    /** @return \Illuminate\Database\Eloquent\Builder<Coupon> */
    private function owned(Request $request): Builder
    {
        return Coupon::query()
            ->where('coupons.owner_type', Coupon::OWNER_INSTITUTION)
            ->where('coupons.owner_id', $request->user()->id);
    }

    private function own(Request $request, Coupon $coupon): Coupon
    {
        abort_unless(
            $coupon->owner_type === Coupon::OWNER_INSTITUTION && $coupon->owner_id === $request->user()->id,
            404,
            'Voucher tidak ditemukan.',
        );

        return $coupon;
    }

    /**
     * @param  array<string,mixed>  $data
     * @return array<string,mixed>
     */
    private function payload(array $data, bool $updating = false): array
    {
        $payload = collect($data)->only(['name', 'code', 'discount_type', 'discount_value', 'usage_limit', 'course_id', 'is_active'])->all();

        if (array_key_exists('expires_at', $data)) {
            $payload['expires_at'] = $data['expires_at'] === null
                ? null
                : Carbon::parse($data['expires_at'])->endOfDay();
        }

        if (! $updating && ! array_key_exists('is_active', $payload)) {
            $payload['is_active'] = true;
        }

        return $payload;
    }

    /** @return array<string,mixed> */
    private function item(Coupon $coupon): array
    {
        return [
            'id' => $coupon->id,
            'name' => $coupon->name,
            'code' => $coupon->code,
            'discount_type' => $coupon->discount_type,
            'discount_value' => $coupon->discount_value,
            'discount_label' => $coupon->discountLabel(),
            'usage_limit' => $coupon->usage_limit,
            'used_count' => $coupon->usedCount(),
            'status' => $coupon->status(),
            'status_label' => $coupon->statusLabel(),
            'is_active' => (bool) $coupon->is_active,
            'expires_at' => $coupon->expires_at?->toDateString(),
            'course' => $coupon->course ? ['id' => $coupon->course->id, 'title' => $coupon->course->title] : null,
            'created_at' => $coupon->created_at?->toIso8601String(),
        ];
    }
}
