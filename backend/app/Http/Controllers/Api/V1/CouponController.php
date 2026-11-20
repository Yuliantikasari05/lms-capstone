<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCouponRequest;
use App\Http\Requests\UpdateCouponRequest;
use App\Http\Resources\CouponResource;
use App\Models\AuditLog;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Support\Like;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Manajemen Kupon (Admin): CRUD, pencarian, dan ringkasan (total kupon, kupon aktif, total penggunaan). */
class CouponController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewAny', Coupon::class);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(Coupon::STATUSES)],
            'course_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $coupons = Coupon::query()
            ->ownedByAdmin()
            ->with('course')
            ->withCount('redemptions')
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(coupons.code) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(coupons.name) like ? escape '!'", [$like]));
            })
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->withStatus($status))
            ->when($filters['course_id'] ?? null, fn (Builder $q, $id) => $q->where('coupons.course_id', $id))
            ->orderByDesc('coupons.created_at')
            ->orderByDesc('coupons.id')
            ->paginate($filters['per_page'] ?? 15);

        return CouponResource::collection($coupons)->additional(['summary' => $this->summary()]);
    }

    public function store(StoreCouponRequest $request): JsonResponse
    {
        $data = $request->validated();

        $coupon = DB::transaction(function () use ($data, $request) {
            $coupon = new Coupon($data);
            $coupon->owner_type = Coupon::OWNER_ADMIN;
            $coupon->created_by = $request->user()->id;
            $coupon->save();

            AuditLog::record('coupon.created', $coupon, ['after' => $this->snapshot($coupon)], $request);

            return $coupon;
        });

        return (new CouponResource($this->loaded($coupon)))
            ->additional(['message' => 'Kupon berhasil dibuat.'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Coupon $coupon): CouponResource
    {
        Gate::authorize('view', $coupon);

        return new CouponResource($this->loaded($coupon));
    }

    public function update(UpdateCouponRequest $request, Coupon $coupon): CouponResource
    {
        $before = $this->snapshot($coupon);

        DB::transaction(function () use ($coupon, $request, $before) {
            $coupon->fill($request->validated())->save();

            $after = $this->snapshot($coupon);
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                AuditLog::record('coupon.updated', $coupon, [
                    'before' => array_intersect_key($before, array_flip($changed)),
                    'after' => array_intersect_key($after, array_flip($changed)),
                ], $request);
            }
        });

        return (new CouponResource($this->loaded($coupon)))->additional(['message' => 'Kupon berhasil diperbarui.']);
    }

    /** Soft delete. Kupon yang sudah pernah dipakai tidak dihapus (riwayat pemakaian), cukup dinonaktifkan. */
    public function destroy(Request $request, Coupon $coupon): JsonResponse
    {
        Gate::authorize('delete', $coupon);

        if ($coupon->redemptions()->exists()) {
            throw ValidationException::withMessages([
                'coupon' => ['Kupon sudah pernah dipakai. Nonaktifkan kupon ini sebagai gantinya.'],
            ]);
        }

        DB::transaction(function () use ($coupon, $request) {
            $coupon->delete();
            AuditLog::record('coupon.deleted', $coupon, [], $request);
        });

        return response()->json(['message' => 'Kupon berhasil dihapus.']);
    }

    /** Kartu ringkasan di halaman: tidak terpengaruh filter pencarian. */
    private function summary(): array
    {
        return [
            'total' => Coupon::ownedByAdmin()->count(),
            'active' => Coupon::ownedByAdmin()->withStatus(Coupon::STATUS_ACTIVE)->count(),
            'total_redemptions' => CouponRedemption::query()
                ->whereIn('coupon_id', Coupon::ownedByAdmin()->withTrashed()->select('coupons.id'))
                ->count(),
        ];
    }

    private function loaded(Coupon $coupon): Coupon
    {
        return $coupon->load('course')->loadCount('redemptions');
    }

    /** @return array<string,mixed> */
    private function snapshot(Coupon $coupon): array
    {
        return [
            'code' => $coupon->code,
            'name' => $coupon->name,
            'discount_type' => $coupon->discount_type,
            'discount_value' => $coupon->discount_value,
            'usage_limit' => $coupon->usage_limit,
            'course_id' => $coupon->course_id,
            'expires_at' => $coupon->expires_at?->toIso8601String(),
            'is_active' => $coupon->is_active,
        ];
    }
}
