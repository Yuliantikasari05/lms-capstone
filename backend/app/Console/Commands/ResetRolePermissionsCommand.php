<?php

namespace App\Console\Commands;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Rbac\Catalog;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Pemulihan hak akses lewat terminal (cadangan bila Pengaturan di web tidak bisa dipakai).
 *
 *   php artisan lms:reset-role-permissions --role=admin     kembalikan satu role bawaan ke pengaturan awal
 *   php artisan lms:reset-role-permissions --role=all       kembalikan kelima role bawaan
 *   php artisan lms:reset-role-permissions --prune          cabut izin yang tidak boleh dimiliki role (tidak dikenal,
 *                                                           belum tersedia, atau tidak berlaku untuk role itu)
 */
class ResetRolePermissionsCommand extends Command
{
    protected $signature = 'lms:reset-role-permissions {--role= : Slug role bawaan, atau "all"} {--prune : Cabut izin yang tidak sah} {--force : Lewati konfirmasi}';

    protected $description = 'Mengembalikan izin role bawaan ke pengaturan awal dan/atau mencabut izin yang tidak sah.';

    public function handle(): int
    {
        $role = $this->option('role');
        $prune = (bool) $this->option('prune');

        if ($role === null && ! $prune) {
            $this->error('Tentukan --role=<slug|all> dan/atau --prune.');

            return self::FAILURE;
        }

        if ($role !== null && $role !== 'all' && ! in_array($role, Catalog::SYSTEM_ROLES, true)) {
            $this->error('Role bawaan tidak dikenal: '.$role.'. Pilihan: '.implode(', ', Catalog::SYSTEM_ROLES).', all.');

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm('Perubahan ini langsung berlaku untuk semua akun pada role terkait. Lanjutkan?')) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($role, $prune) {
            if ($role !== null) {
                foreach ($role === 'all' ? Catalog::SYSTEM_ROLES : [$role] as $slug) {
                    $model = Role::where('slug', $slug)->first();
                    if ($model === null) {
                        $this->warn("Role {$slug} belum ada; jalankan RolePermissionSeeder lebih dulu.");

                        continue;
                    }

                    $model->permissions()->sync(Permission::whereIn('slug', RolePermissionSeeder::MATRIX[$slug])->pluck('id'));
                    $this->info("Role {$slug}: izin dikembalikan ke pengaturan awal.");
                }
            }

            if ($prune) {
                $removed = 0;
                foreach (Role::with('permissions')->get() as $model) {
                    $allowed = Catalog::assignable(Catalog::keyOf($model->slug));
                    $invalid = $model->permissions->whereNotIn('slug', $allowed);

                    if ($invalid->isNotEmpty()) {
                        $model->permissions()->detach($invalid->pluck('id'));
                        $removed += $invalid->count();
                        $this->line("Role {$model->slug}: dicabut ".$invalid->pluck('slug')->implode(', '));
                    }
                }
                $this->info($removed === 0 ? 'Tidak ada izin tidak sah.' : "{$removed} izin tidak sah dicabut.");
            }
        });

        return self::SUCCESS;
    }
}
