<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateLembagaProfileRequest;
use App\Support\Lembaga\LembagaContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GET/PATCH /lembaga/profile — profil lembaga milik akun yang login.
 * Nama lembaga disimpan pada profil DAN akun agar tampilan header dan dokumen konsisten.
 */
class LembagaProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $institution = LembagaContext::institution($user);
        $summary = LembagaContext::summary($user);

        return response()->json([
            'data' => [
                'id' => $institution->id,
                'name' => $institution->name,
                'description' => $institution->description,
                'phone' => $institution->phone,
                'address' => $institution->address,
                'revenue_share_percent' => $institution->revenue_share_percent,
                'bank' => [
                    'configured' => $institution->hasBankAccount(),
                    'name' => $institution->bank_name,
                    'account_holder' => $institution->bank_account_holder,
                    'account_last4' => $institution->bankAccountLast4(),
                    'label' => $institution->bankLabel(),
                ],
                'account' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'status' => $user->status,
                    'last_login_at' => $user->last_login_at?->toIso8601String(),
                ],
                'stats' => [
                    'total_programs' => $summary['active_programs'],
                    'total_students' => $summary['total_students'],
                    'total_enrollments' => $summary['total_enrollments'],
                    'rating' => null,
                ],
            ],
        ]);
    }

    public function update(UpdateLembagaProfileRequest $request)
    {
        $user = $request->user();
        $institution = LembagaContext::institution($user);

        $data = $request->validated();

        DB::transaction(function () use ($institution, $user, $data) {
            $institution->fill($data)->save();

            if (array_key_exists('name', $data)) {
                $user->name = $data['name'];
                $user->save();
            }
        });

        return response()
            ->json(['data' => ['id' => $institution->id, 'name' => $institution->name], 'message' => 'Profil lembaga berhasil diperbarui.'])
            ->header('Cache-Control', 'private, no-store');
    }
}
