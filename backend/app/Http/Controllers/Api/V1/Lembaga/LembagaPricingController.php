<?php

namespace App\Http\Controllers\Api\V1\Lembaga;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProgramPricingRequest;
use App\Http\Resources\LembagaProgramResource;
use App\Models\AuditLog;
use App\Models\Course;
use App\Support\Lembaga\LembagaContext;
use Illuminate\Http\Request;

/**
 * GET /lembaga/pricing — daftar harga program lembaga.
 * PATCH /lembaga/programs/{course}/pricing — atur harga normal dan harga diskon program milik sendiri.
 */
class LembagaPricingController extends Controller
{
    public function index(Request $request)
    {
        $programs = LembagaContext::programsQuery($request->user())
            ->orderBy('title')
            ->get();

        return response()->json(['data' => LembagaProgramResource::collection($programs)->resolve($request)]);
    }

    public function update(UpdateProgramPricingRequest $request, Course $course)
    {
        $program = LembagaContext::program($request->user(), $course);

        $before = ['price' => $program->price, 'discount_price' => $program->discount_price];

        $program->price = $request->validated('price');
        $program->discount_price = $request->validated('discount_price');
        $program->save();

        AuditLog::record('lembaga.pricing_updated', $program, [
            'before' => $before,
            'after' => ['price' => $program->price, 'discount_price' => $program->discount_price],
        ], $request);

        $program = LembagaContext::programsQuery($request->user())->findOrFail($program->id);

        return response()
            ->json([
                'data' => LembagaProgramResource::make($program)->resolve($request),
                'message' => 'Harga program berhasil diperbarui. Perubahan berlaku untuk transaksi berikutnya.',
            ])
            ->header('Cache-Control', 'private, no-store');
    }
}
