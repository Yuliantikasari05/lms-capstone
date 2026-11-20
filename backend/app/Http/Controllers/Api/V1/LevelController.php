<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LevelRequest;
use App\Http\Resources\LevelResource;
use App\Models\AuditLog;
use App\Models\Level;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Level yang diatur Admin (nama + batas XP minimal). Tanpa nilai bawaan: batas level belum diputuskan.
 * Otorisasi: middleware permission:gamification.view/manage pada rute.
 */
class LevelController extends Controller
{
    public function index()
    {
        return LevelResource::collection(Level::query()->orderBy('min_xp')->get());
    }

    public function show(Level $level): LevelResource
    {
        return new LevelResource($level);
    }

    public function store(LevelRequest $request): JsonResponse
    {
        $level = DB::transaction(function () use ($request) {
            $level = Level::create($request->validated());
            AuditLog::record('level.created', $level, ['after' => $level->only(['name', 'min_xp'])], $request);

            return $level;
        });

        return (new LevelResource($level))->additional(['message' => 'Level berhasil dibuat.'])->response()->setStatusCode(201);
    }

    public function update(LevelRequest $request, Level $level): LevelResource
    {
        $before = $level->only(['name', 'min_xp']);

        DB::transaction(function () use ($request, $level, $before) {
            $level->fill($request->validated())->save();

            $after = $level->only(['name', 'min_xp']);
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                AuditLog::record('level.updated', $level, [
                    'before' => array_intersect_key($before, array_flip($changed)),
                    'after' => array_intersect_key($after, array_flip($changed)),
                ], $request);
            }
        });

        return (new LevelResource($level))->additional(['message' => 'Level berhasil diperbarui.']);
    }

    public function destroy(Request $request, Level $level): JsonResponse
    {
        DB::transaction(function () use ($level, $request) {
            $level->delete();
            AuditLog::record('level.deleted', $level, ['before' => $level->only(['name', 'min_xp'])], $request);
        });

        return response()->json(['message' => 'Level berhasil dihapus.']);
    }
}
