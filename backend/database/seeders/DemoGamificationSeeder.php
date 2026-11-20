<?php

namespace Database\Seeders;

use App\Models\Level;
use App\Models\Role;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\XpService;
use Illuminate\Database\Seeder;

/**
 * Level dan XP contoh untuk development (mengisi halaman Gamifikasi: papan peringkat, skor kembar, dan ringkasan).
 *
 * Jalankan manual (setelah DemoUserSeeder):   php artisan db:seed --class=DemoGamificationSeeder
 * Sengaja TIDAK dimasukkan ke DatabaseSeeder agar `db:seed` biasa tidak pernah membuat data demo.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - NAMA dan BATAS level di sini hanyalah CONTOH. Level yang sebenarnya diatur Admin (belum diputuskan);
 *   karena itu level contoh hanya dibuat bila belum ada level sama sekali, dan tidak pernah menimpa yang sudah ada.
 * - XP contoh dicatat lewat XpService sebagai koreksi dengan alasan "Data demo"; aman diulang (Siswa yang
 *   sudah punya data demo dilewati).
 */
class DemoGamificationSeeder extends Seeder
{
    public const REASON = 'Data demo';

    /** Nama => batas XP minimal (contoh saja). */
    private const SAMPLE_LEVELS = ['Pemula' => 0, 'Menengah' => 500, 'Mahir' => 1500, 'Ahli' => 3000];

    /** XP contoh per Siswa (urut id); sengaja memuat skor kembar dan nol untuk menguji peringkat. */
    private const SAMPLE_XP = [3200, 1700, 1700, 1200, 800, 800, 450, 120, 40, 0];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoGamificationSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('slug', Role::ADMIN))->oldest('id')->first();
        $students = User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', Role::SISWA))
            ->where('status', User::STATUS_ACTIVE)->orderBy('id')->get();

        if ($admin === null || $students->isEmpty()) {
            $this->command?->error('Butuh Admin dan Siswa demo. Jalankan `lms:create-admin` dan `db:seed --class=DemoUserSeeder` dulu. Dibatalkan.');

            return;
        }

        $this->seedLevels();

        $xp = app(XpService::class);
        $given = 0;
        foreach ($students->take(count(self::SAMPLE_XP)) as $index => $student) {
            $amount = self::SAMPLE_XP[$index];
            $alreadySeeded = XpTransaction::query()->where('user_id', $student->id)->where('reason', self::REASON)->exists();

            if ($amount > 0 && ! $alreadySeeded) {
                $xp->adjust($student, $amount, self::REASON, $admin);
                $given++;
            }
        }

        $this->command?->info("XP contoh diberikan ke {$given} Siswa.");
    }

    private function seedLevels(): void
    {
        if (Level::query()->exists()) {
            $this->command?->line('Level sudah ada, level contoh tidak dibuat (tidak menimpa pengaturan Admin).');

            return;
        }

        foreach (self::SAMPLE_LEVELS as $name => $minXp) {
            Level::create(['name' => $name, 'min_xp' => $minXp]);
        }

        $this->command?->info(count(self::SAMPLE_LEVELS).' level contoh dibuat (hanya contoh; atur level sebenarnya lewat menu Gamifikasi).');
    }
}
