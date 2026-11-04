<?php

namespace App\Console\Commands;

use App\Support\MaterialFiles;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Membersihkan file fisik materi yang sudah lama dihapus (materi, modul, atau kursusnya dihapus).
 * Baris di database tetap ada (riwayat); hanya file dan kolom file_path yang dibersihkan.
 * Jadwalkan berkala di server (cron), mis. harian:  php artisan lms:purge-material-files
 */
class PurgeMaterialFilesCommand extends Command
{
    protected $signature = 'lms:purge-material-files {--days=30 : Hapus file yang dihapus lebih dari N hari lalu} {--dry-run : Hanya tampilkan, jangan menghapus}';

    protected $description = 'Hapus file fisik materi yang sudah lama dihapus';

    public function handle(MaterialFiles $files): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $rows = DB::table('materials')
            ->join('course_modules', 'course_modules.id', '=', 'materials.course_module_id')
            ->join('courses', 'courses.id', '=', 'course_modules.course_id')
            ->whereNotNull('materials.file_path')
            ->where(fn ($q) => $q
                ->where('materials.deleted_at', '<', $cutoff)
                ->orWhere('course_modules.deleted_at', '<', $cutoff)
                ->orWhere('courses.deleted_at', '<', $cutoff))
            ->get(['materials.id', 'materials.file_path']);

        if ($rows->isEmpty()) {
            $this->info('Tidak ada file yang perlu dibersihkan.');

            return self::SUCCESS;
        }

        if ($this->option('dry-run')) {
            $this->info("{$rows->count()} file akan dibersihkan (dry-run, tidak ada yang dihapus).");

            return self::SUCCESS;
        }

        foreach ($rows as $row) {
            $files->delete($row->file_path);
            DB::table('materials')->where('id', $row->id)->update(['file_path' => null]);
        }

        $this->info("{$rows->count()} file dibersihkan.");

        return self::SUCCESS;
    }
}
