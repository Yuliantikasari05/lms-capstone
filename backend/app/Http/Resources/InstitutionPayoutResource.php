<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\InstitutionPayout */
class InstitutionPayoutResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'amount' => $this->amount,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            // "Rekening Tujuan": nomor utuh tidak pernah dikirim.
            'destination' => [
                'label' => $this->destinationLabel(),
                'bank_name' => $this->bank_name,
                'account_holder' => $this->bank_account_holder,
                'account_last4' => $this->bank_account_last4,
            ],
            'note' => $this->note,
            'requested_by' => $this->whenLoaded('requester', fn () => $this->requester ? ['id' => $this->requester->id, 'name' => $this->requester->name] : null),
            'processed_by' => $this->whenLoaded('processor', fn () => $this->processor ? ['id' => $this->processor->id, 'name' => $this->processor->name] : null),
            'institution' => $this->whenLoaded('institution', fn () => ['id' => $this->institution->id, 'name' => $this->institution->name]),
            // "Tanggal Pencairan" = saat diajukan; "Diproses" = saat diselesaikan/dibatalkan.
            'requested_at' => $this->created_at?->toIso8601String(),
            'processed_at' => $this->processed_at?->toIso8601String(),
        ];
    }
}
