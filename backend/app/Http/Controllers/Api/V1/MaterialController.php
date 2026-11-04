<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReorderRequest;
use App\Http\Requests\StoreMaterialRequest;
use App\Http\Requests\UpdateMaterialRequest;
use App\Http\Resources\MaterialResource;
use App\Models\AuditLog;
use App\Models\CourseModule;
use App\Models\Material;
use App\Support\MaterialFiles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class MaterialController extends Controller
{
    public function __construct(private MaterialFiles $files) {}

    public function store(StoreMaterialRequest $request, CourseModule $module): JsonResponse
    {
        $data = $request->validated();
        $course = $module->course;
        $stored = $request->hasFile('file') ? $this->files->store($request->file('file'), $course) : null;

        try {
            $material = DB::transaction(function () use ($data, $module, $stored, $request) {
                $material = new Material(collect($data)->only(['title', 'description', 'type', 'external_url', 'duration_minutes'])->all());
                $material->course_module_id = $module->id;
                $material->xp_points = (int) ($data['xp_points'] ?? 0);
                $material->position = ((int) $module->materials()->max('position')) + 1;

                if ($stored) {
                    $material->forceFill($stored);
                }

                $material->save();

                AuditLog::record('material.created', $material, [
                    'course_id' => $module->course_id,
                    'after' => ['type' => $material->type, 'title' => $material->title, 'xp_points' => $material->xp_points],
                ], $request);

                return $material;
            });
        } catch (\Throwable $e) {
            // Jangan meninggalkan file yatim bila penyimpanan data gagal.
            $this->files->delete($stored['file_path'] ?? null);
            throw $e;
        }

        return (new MaterialResource($material))
            ->additional(['message' => 'Materi berhasil ditambahkan.'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateMaterialRequest $request, Material $material): MaterialResource
    {
        $data = $request->validated();
        $course = $material->module->course;

        $before = $material->only(['title', 'description', 'external_url', 'duration_minutes', 'xp_points']);
        $oldPath = $material->file_path;
        $stored = $request->hasFile('file') ? $this->files->store($request->file('file'), $course) : null;

        try {
            DB::transaction(function () use ($material, $data, $stored, $before, $request) {
                $material->fill(collect($data)->only(['title', 'description', 'external_url', 'duration_minutes'])->all());

                if (array_key_exists('xp_points', $data)) {
                    $material->xp_points = (int) ($data['xp_points'] ?? 0);
                }

                if ($stored) {
                    // File baru menggantikan file lama (dan tautan video bila ada).
                    $material->forceFill($stored);
                    $material->external_url = null;
                } elseif ($material->type === Material::TYPE_VIDEO && filled($data['external_url'] ?? null)) {
                    // Beralih dari file ke tautan.
                    $material->forceFill(['file_path' => null, 'file_name' => null, 'file_size' => null, 'mime_type' => null]);
                }

                $material->save();

                $after = $material->only(array_keys($before));
                $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));
                $fileChanged = $stored !== null || $material->wasChanged('file_path');

                if ($changed !== [] || $fileChanged) {
                    AuditLog::record('material.updated', $material, array_filter([
                        'course_id' => $material->module->course_id,
                        'before' => array_intersect_key($before, array_flip($changed)) ?: null,
                        'after' => array_intersect_key($after, array_flip($changed)) ?: null,
                        'file_replaced' => $fileChanged ?: null,
                    ], fn ($v) => $v !== null), $request);
                }
            });
        } catch (\Throwable $e) {
            $this->files->delete($stored['file_path'] ?? null);
            throw $e;
        }

        // File lama dihapus hanya setelah data berhasil disimpan.
        if ($oldPath !== null && $oldPath !== $material->file_path) {
            $this->files->delete($oldPath);
        }

        return (new MaterialResource($material->fresh()))->additional(['message' => 'Materi berhasil diperbarui.']);
    }

    /** Soft delete. File fisik dipertahankan (riwayat) dan dibersihkan berkala oleh lms:purge-material-files. */
    public function destroy(Request $request, Material $material): JsonResponse
    {
        $course = $material->module->course;
        abort_if($course->trashed(), 404);
        Gate::authorize('manageContent', $course);

        DB::transaction(function () use ($request, $material, $course) {
            $material->delete();
            AuditLog::record('material.deleted', $material, ['course_id' => $course->id], $request);
        });

        return response()->json(['message' => 'Materi berhasil dihapus.']);
    }

    public function reorder(ReorderRequest $request, CourseModule $module): JsonResponse
    {
        $ids = array_map('intval', $request->validated('ids'));

        DB::transaction(function () use ($request, $module, $ids) {
            foreach ($ids as $index => $id) {
                $module->materials()->whereKey($id)->update(['position' => $index + 1]);
            }

            AuditLog::record('material.reordered', $module, ['course_id' => $module->course_id, 'order' => $ids], $request);
        });

        return response()->json([
            'data' => MaterialResource::collection($module->materials()->get())->resolve($request),
            'message' => 'Urutan materi berhasil disimpan.',
        ]);
    }

    /**
     * Unduh/tampilkan file materi. Hanya untuk yang berhak (CoursePolicy::viewContent); file tidak pernah
     * tersedia lewat URL publik. PDF dan video tampil inline (mendukung seek video), selebihnya diunduh.
     */
    public function file(Material $material): Response
    {
        $course = $material->module->course;
        abort_if($course->trashed(), 404);
        Gate::authorize('viewContent', $course);

        $disk = MaterialFiles::disk();
        abort_unless($material->hasFile() && $disk->exists($material->file_path), 404, 'Berkas tidak ditemukan.');

        $inline = in_array($material->type, [Material::TYPE_PDF, Material::TYPE_VIDEO], true);
        $headers = [
            'Content-Type' => $material->mime_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ];

        $response = response()->file($disk->path($material->file_path), $headers);
        // BinaryFileResponse bawaannya "public": file privat tidak boleh disimpan cache bersama.
        $response->setPrivate();
        $response->headers->set('Cache-Control', 'private, max-age=0, must-revalidate');
        $response->setContentDisposition($inline ? 'inline' : 'attachment', $material->file_name ?: 'berkas');

        return $response;
    }
}
