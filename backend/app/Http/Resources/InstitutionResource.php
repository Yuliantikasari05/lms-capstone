<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * Lembaga Bimbingan. Nomor rekening TIDAK pernah dikirim utuh: hanya 4 digit terakhir dan label tampil.
 * Saldo dan jumlah program muncul bila withCount/withSum dimuat controller (loadFinancials).
 *
 * @mixin \App\Models\Institution
 */
class InstitutionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $account = $this->relationLoaded('user') ? $this->user : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'phone' => $this->phone,
            'address' => $this->address,
            'email' => $account?->email,
            // Status akun (sumber kebenaran: tabel users): active, inactive, suspended.
            'status' => $account?->status,
            'status_label' => $account?->statusLabel(),
            'account' => $account ? [
                'id' => $account->id,
                'last_login_at' => $account->last_login_at?->toIso8601String(),
                // true bila akunnya dihapus lewat menu Pengguna (profil lembaga tetap ada untuk riwayat keuangan).
                'deleted' => $account->trashed(),
            ] : null,
            'revenue_share_percent' => $this->revenue_share_percent,
            // true bila bagi hasil belum diatur (mis. akun lama): penjualan belum bisa dicatat.
            'needs_revenue_share' => ! $this->hasRevenueShare(),
            'bank' => [
                'configured' => $this->hasBankAccount(),
                'name' => $this->bank_name,
                'account_holder' => $this->bank_account_holder,
                'account_last4' => $this->bankAccountLast4(),
                'label' => $this->bankLabel(),
            ],
            'programs_count' => $this->whenCounted('programs'),
            'balance' => $this->when(array_key_exists('earned_total', $this->resource->getAttributes()), fn () => [
                'earned' => (int) $this->earned_total,
                'held' => (int) ($this->held_total ?? 0),
                'available' => max(0, (int) $this->earned_total - (int) ($this->held_total ?? 0)),
            ]),
            'joined_at' => $this->created_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
            'abilities' => $user ? [
                'update' => Gate::forUser($user)->allows('update', $this->resource),
                'delete' => Gate::forUser($user)->allows('delete', $this->resource),
                'manage_payouts' => Gate::forUser($user)->allows('managePayouts', $this->resource),
            ] : null,
        ];
    }
}
