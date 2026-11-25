<?php

namespace App\Console\Commands;

use App\Support\Rbac\PermissionSync;
use Illuminate\Console\Command;

/**
 * Pemeriksaan cepat sebelum mencoba fitur: memastikan izin di database sudah sinkron dengan
 * RolePermissionSeeder dan katalog RBAC, sehingga tidak berujung pada 403 yang membingungkan.
 *
 *   php artisan lms:permissions:check
 */
class CheckPermissionsCommand extends Command
{
    protected $signature = 'lms:permissions:check';

    protected $description = 'Memeriksa apakah izin di database sudah sinkron dengan RolePermissionSeeder dan katalog RBAC.';

    public function handle(): int
    {
        $report = PermissionSync::inspect();

        $this->line('Izin dikenal seeder  : '.$report['expected_total']);
        $this->line('Izin ada di database : '.$report['present_total']);

        foreach ($report['role_gaps'] as $role => $slugs) {
            $this->warn("Role {$role} tidak memakai izin bawaan: ".implode(', ', $slugs).' (bisa disengaja lewat Pengaturan).');
        }

        $errors = [];

        if ($report['missing_permissions'] !== []) {
            $errors[] = 'Izin belum ada di database: '.implode(', ', $report['missing_permissions']);
        }

        if ($report['unseeded_permissions'] !== []) {
            $errors[] = 'Izin ditegakkan kode tetapi tidak didefinisikan seeder: '.implode(', ', $report['unseeded_permissions']);
        }

        if ($report['missing_roles'] !== []) {
            $errors[] = 'Role belum ada di database: '.implode(', ', $report['missing_roles']);
        }

        foreach ($report['required_gaps'] as $role => $slugs) {
            $errors[] = "Role {$role} kehilangan izin wajibnya: ".implode(', ', $slugs);
        }

        if ($errors === []) {
            $this->info('Izin tersinkron.');

            return self::SUCCESS;
        }

        foreach ($errors as $error) {
            $this->error($error);
        }

        $this->newLine();
        $this->line('Perbaiki dengan:');
        $this->line('  php artisan db:seed --class=RolePermissionSeeder --force');
        $this->line('  php artisan lms:reset-role-permissions --role=all --force   # hanya bila izin bawaan ikut hilang');
        $this->line('Setelah itu pengguna cukup refresh halaman (izin dibaca ulang dari database tiap request).');

        return self::FAILURE;
    }
}
