<?php

namespace App\Policies;

use App\Models\Coupon;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Aturan akses kupon: permission umum + kepemilikan. Kupon Admin dikelola Admin; voucher Lembaga
 * (owner_type=institution, tahap pembayaran) dikelola lembaganya dan tidak dapat diubah Admin lewat menu ini.
 */
class CouponPolicy
{
    private const NOT_ADMIN_OWNED = 'Voucher Lembaga dikelola oleh lembaganya.';

    public function viewAny(User $actor): bool
    {
        return $actor->hasPermission('coupons.view');
    }

    public function view(User $actor, Coupon $coupon): Response
    {
        return $this->allow($actor, $coupon, 'coupons.view');
    }

    public function create(User $actor): bool
    {
        return $actor->hasPermission('coupons.create');
    }

    public function update(User $actor, Coupon $coupon): Response
    {
        return $this->allow($actor, $coupon, 'coupons.update');
    }

    public function delete(User $actor, Coupon $coupon): Response
    {
        return $this->allow($actor, $coupon, 'coupons.delete');
    }

    private function allow(User $actor, Coupon $coupon, string $permission): Response
    {
        if (! $actor->hasPermission($permission)) {
            return Response::deny();
        }

        return $coupon->isOwnedByAdmin() ? Response::allow() : Response::deny(self::NOT_ADMIN_OWNED);
    }
}
