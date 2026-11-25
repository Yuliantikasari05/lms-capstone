<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Rbac\Catalog;
use App\Support\Rbac\RoleMatrix;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Integritas katalog izin dan kesesuaiannya dengan rancangan hi-fi 3.18 (Manajemen Role & Akses).
 * Katalog adalah satu-satunya sumber untuk matriks, jadi kesalahan di sini = sakelar yang menyesatkan.
 */
class RbacCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_enforced_slug_is_seeded_and_every_seeded_permission_is_in_the_catalog(): void
    {
        $seeded = array_keys(RolePermissionSeeder::PERMISSIONS);
        $enforced = Catalog::enforcedSlugs();

        $this->assertSame([], array_values(array_diff($enforced, $seeded)), 'Izin di katalog yang belum ada di seeder.');
        $this->assertSame([], array_values(array_diff($seeded, $enforced)), 'Izin di seeder yang tidak muncul di matriks mana pun (tidak dapat diatur Admin).');
    }

    public function test_planned_cells_have_no_slug_and_active_cells_always_have_one(): void
    {
        foreach (Catalog::activities() as $activity) {
            foreach ($activity['cells'] as $column => $cell) {
                $this->assertContains($column, Catalog::COLUMNS, "{$activity['key']}: kolom {$column} tidak dikenal.");
                $this->assertNotEmpty($cell['roles'], "{$activity['key']}.{$column}: tidak ada role penerima.");

                if ($activity['status'] === Catalog::STATUS_PLANNED) {
                    $this->assertNull($cell['slug'], "{$activity['key']}.{$column}: fitur belum dibangun tidak boleh punya izin.");
                } else {
                    $this->assertIsString($cell['slug'], "{$activity['key']}.{$column}: sel aktif wajib punya izin.");
                }

                foreach ($cell['roles'] as $role) {
                    $this->assertContains($role, [...Catalog::SYSTEM_ROLES, Catalog::CUSTOM], "{$activity['key']}: role {$role} tidak dikenal.");
                }
            }
        }
    }

    public function test_every_activity_module_exists_and_keys_are_unique(): void
    {
        $keys = array_column(Catalog::activities(), 'key');
        $this->assertSame($keys, array_values(array_unique($keys)), 'Kunci aktivitas harus unik.');

        foreach (Catalog::activities() as $activity) {
            $this->assertArrayHasKey($activity['module'], Catalog::modules(), "{$activity['key']}: modul tidak terdaftar.");
        }
    }

    public function test_the_default_matrix_of_every_role_is_valid_under_the_catalog_rules(): void
    {
        $this->seedRbac();

        foreach (RolePermissionSeeder::MATRIX as $slug => $permissions) {
            // Tidak melempar ValidationException = dikenal, berlaku untuk role itu, dan memuat semua izin wajib.
            RoleMatrix::assertValid(Role::where('slug', $slug)->firstOrFail(), $permissions);
            $this->assertTrue(true);
        }
    }

    public function test_admin_can_be_given_every_feature_permission(): void
    {
        $adminCan = Catalog::assignable(Catalog::ADMIN);
        $notForAdmin = array_values(array_diff(Catalog::enforcedSlugs(), $adminCan));

        // Satu-satunya izin yang tidak berlaku untuk Admin adalah dashboard role lain.
        $this->assertEqualsCanonicalizing(['dashboard.mentor', 'dashboard.siswa', 'dashboard.karyawan', 'dashboard.lembaga'], $notForAdmin);
    }

    public function test_privilege_escalating_permissions_are_for_admin_only(): void
    {
        $escalating = ['users.view', 'users.create', 'users.update', 'users.delete', 'users.export', 'users.reset_password', 'audit.view', 'roles.view', 'roles.manage', 'dashboard.admin'];

        foreach ([Catalog::MENTOR, Catalog::SISWA, Catalog::KARYAWAN, Catalog::LEMBAGA, Catalog::CUSTOM] as $roleKey) {
            $this->assertSame([], array_values(array_intersect($escalating, Catalog::assignable($roleKey))), "Role {$roleKey} tidak boleh menerima izin kelola akun/role.");
        }
    }

    public function test_custom_roles_only_get_permissions_that_do_not_depend_on_data_ownership(): void
    {
        $custom = Catalog::assignable(Catalog::CUSTOM);

        foreach ($custom as $slug) {
            $this->assertMatchesRegularExpression('/^(coupons|gamification|institutions)\./', $slug, "{$slug} bergantung pada kepemilikan data; tidak boleh untuk role khusus.");
        }
        $this->assertNotEmpty($custom);
    }

    public function test_non_admin_roles_only_get_what_the_backend_can_scope_to_their_own_data(): void
    {
        $this->assertEqualsCanonicalizing(['dashboard.mentor', 'courses.view', 'courses.create', 'courses.update', 'content.manage'], Catalog::assignable(Catalog::MENTOR));
        $this->assertEqualsCanonicalizing(['dashboard.lembaga', 'courses.view', 'courses.update', 'content.manage'], Catalog::assignable(Catalog::LEMBAGA));
        // Siswa dan Karyawan: belum ada API untuk mereka, jadi hanya dashboard.
        $this->assertSame(['dashboard.siswa'], Catalog::assignable(Catalog::SISWA));
        $this->assertSame(['dashboard.karyawan'], Catalog::assignable(Catalog::KARYAWAN));
    }

    public function test_every_system_role_has_its_own_dashboard_as_a_required_permission(): void
    {
        foreach ([Catalog::ADMIN, Catalog::MENTOR, Catalog::SISWA, Catalog::KARYAWAN, Catalog::LEMBAGA] as $role) {
            $this->assertContains("dashboard.{$role}", Catalog::required($role));
            $this->assertContains("dashboard.{$role}", Catalog::assignable($role));
        }
        $this->assertEqualsCanonicalizing(['dashboard.admin', 'roles.view', 'roles.manage'], Catalog::required(Catalog::ADMIN));
        $this->assertSame([], Catalog::required(Catalog::CUSTOM));
    }

    // ------------------------------------------------------------------ kesesuaian dengan hi-fi 3.18 (matriks Admin)

    /** @return array<string, array<string, array<string,string>>> modul => aktivitas => kolom => state */
    private function adminMatrix(): array
    {
        $this->seedRbac();
        $granted = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug')->all();
        $out = [];

        foreach (RoleMatrix::forRole(Role::ADMIN, $granted) as $module) {
            foreach ($module['activities'] as $activity) {
                $out[$module['name']][$activity['label']] = collect($activity['cells'])->mapWithKeys(fn ($c) => [$c['action'] => $c['state']])->all();
            }
        }

        return $out;
    }

    public function test_the_admin_matrix_has_the_modules_of_the_hifi_in_order(): void
    {
        $this->seedRbac();
        $granted = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug')->all();
        $names = array_column(RoleMatrix::forRole(Role::ADMIN, $granted), 'name');

        // Urutan hi-fi: Dashboard, Manajemen Pengguna, Kurikulum dan Kursus, Gamifikasi & XP, Setting.
        // Kupon dan Lembaga Bimbingan ditambahkan karena keduanya menu Admin yang nyata (sidebar hi-fi).
        $this->assertSame(['Dashboard', 'Manajemen Pengguna', 'Kurikulum dan Kursus', 'Manajemen Kupon', 'Gamifikasi dan XP', 'Lembaga Bimbingan', 'Setting'], $names);
    }

    public function test_the_admin_matrix_has_the_activities_and_cr_u_d_columns_of_the_hifi(): void
    {
        $m = $this->adminMatrix();
        $on = RoleMatrix::STATE_ON;
        $locked = RoleMatrix::STATE_LOCKED;
        $na = RoleMatrix::STATE_NA;
        $unavailable = RoleMatrix::STATE_UNAVAILABLE;

        // Dashboard: hanya kolom R.
        $this->assertSame(['create' => $na, 'read' => $locked, 'update' => $na, 'delete' => $na], $m['Dashboard']['Lihat Dashboard Admin']);
        $this->assertSame(['create' => $na, 'read' => $locked, 'update' => $na, 'delete' => $na], $m['Dashboard']['Lihat Statistik Platform']);
        // Manajemen Pengguna: Data Pengguna C R U D.
        $this->assertSame(['create' => $on, 'read' => $on, 'update' => $on, 'delete' => $on], $m['Manajemen Pengguna']['Data Pengguna']);
        // Kurikulum dan Kursus: Data Kursus dan Kurikulum, Sesi dan Live, Kelola Diskusi dan Komentar (C R U D).
        $this->assertSame(['create' => $on, 'read' => $on, 'update' => $on, 'delete' => $on], $m['Kurikulum dan Kursus']['Data Kursus dan Kurikulum']);
        $this->assertSame(['create' => $on, 'read' => $on, 'update' => $on, 'delete' => $on], $m['Kurikulum dan Kursus']['Sesi dan Live']);
        $this->assertSame(array_fill_keys(Catalog::COLUMNS, $unavailable), $m['Kurikulum dan Kursus']['Kelola Diskusi dan Komentar']);
        // Gamifikasi & XP: Lihat Papan Peringkat (R), Kelola XP Pengguna (U, D), Kelola Achievement dan Misi Harian (C R U D).
        $this->assertSame(['create' => $na, 'read' => $on, 'update' => $na, 'delete' => $na], $m['Gamifikasi dan XP']['Lihat Papan Peringkat']);
        $this->assertSame(['create' => $na, 'read' => $na, 'update' => $on, 'delete' => $on], $m['Gamifikasi dan XP']['Kelola XP Pengguna']);
        $this->assertSame(array_fill_keys(Catalog::COLUMNS, $unavailable), $m['Gamifikasi dan XP']['Kelola Achievement']);
        $this->assertSame(array_fill_keys(Catalog::COLUMNS, $unavailable), $m['Gamifikasi dan XP']['Kelola Misi Harian']);
        // Setting: Pengaturan Sistem (R, U) dan Kelola Role dan Permission (C R U D).
        $this->assertSame(['create' => $na, 'read' => $unavailable, 'update' => $unavailable, 'delete' => $na], $m['Setting']['Pengaturan Sistem']);
        $this->assertSame(['create' => $locked, 'read' => $locked, 'update' => $locked, 'delete' => $locked], $m['Setting']['Kelola Role dan Permission']);
    }

    public function test_cells_that_share_one_backend_permission_are_marked_shared(): void
    {
        $this->seedRbac();
        $granted = Role::where('slug', Role::ADMIN)->firstOrFail()->permissions->pluck('slug')->all();
        $cells = [];
        foreach (RoleMatrix::forRole(Role::ADMIN, $granted) as $module) {
            foreach ($module['activities'] as $activity) {
                foreach ($activity['cells'] as $cell) {
                    if ($cell['slug'] !== null) {
                        $cells[$cell['slug']][] = $cell['shared'];
                    }
                }
            }
        }

        $this->assertNotContains(false, $cells['content.manage']);  // dipakai beberapa sel (modul, materi, sesi)
        $this->assertNotContains(false, $cells['dashboard.admin']); // dua baris dashboard
        $this->assertSame([false], $cells['users.create']);         // satu sel saja
    }

    public function test_the_matrix_differs_per_role_following_the_functional_requirements(): void
    {
        $this->seedRbac();
        $labels = function (string $role) {
            $granted = Role::where('slug', $role)->firstOrFail()->permissions->pluck('slug')->all();

            return collect(RoleMatrix::forRole($role, $granted))->flatMap(fn ($m) => collect($m['activities'])->pluck('label'))->all();
        };

        $mentor = $labels(Role::MENTOR);
        $this->assertContains('Kursus yang Saya Ampu', $mentor);      // FR-26 s.d. FR-29
        $this->assertContains('Master Tugas dan Ujian', $mentor);     // FR-33 (belum dibangun)
        $this->assertNotContains('Data Pengguna', $mentor);

        $lembaga = $labels(Role::LEMBAGA);
        $this->assertContains('Program Lembaga Saya', $lembaga);      // FR-18
        $this->assertContains('Voucher Lembaga', $lembaga);           // FR-24 (belum dibangun)
        $this->assertNotContains('Data Kupon', $lembaga);

        $this->assertContains('Papan Peringkat', $labels(Role::SISWA));      // FR-38
        $this->assertContains('Pengajuan Sertifikat', $labels(Role::KARYAWAN)); // FR-46
        $this->assertNotContains('Pengajuan Sertifikat', $labels(Role::SISWA));
    }

    public function test_the_module_all_toggle_reflects_whether_every_editable_permission_is_on(): void
    {
        $this->seedRbac();
        $matrix = fn (array $granted) => collect(RoleMatrix::forRole(Role::ADMIN, $granted))->keyBy('key');

        $all = $matrix(Catalog::assignable(Catalog::ADMIN));
        $this->assertTrue($all['users']['all_granted']);
        $this->assertTrue($all['curriculum']['all_granted']);

        $partial = $matrix(array_values(array_diff(Catalog::assignable(Catalog::ADMIN), ['users.update'])));
        $this->assertFalse($partial['users']['all_granted']);
        $this->assertSame($partial['users']['editable_count'] - 1, $partial['users']['granted_count']);
        $this->assertTrue($partial['curriculum']['all_granted']);
        // Modul yang seluruh sakelarnya wajib (Dashboard Admin) tidak punya sakelar yang dapat diubah.
        $this->assertSame(0, $partial['dashboard']['editable_count']);
    }

    public function test_the_catalog_endpoint_lists_every_activity_with_its_recipient_roles(): void
    {
        $this->seedRbac();
        $catalog = collect(RoleMatrix::catalog())->flatMap(fn ($m) => $m['activities'])->keyBy('key');

        $this->assertSame(['admin', 'mentor', 'lembaga'], collect($catalog['modules_materials']['cells'])->firstWhere('action', 'delete')['roles']);
        $this->assertTrue(collect($catalog['institution_payouts']['cells'])->firstWhere('action', 'create')['sensitive']);
        $this->assertSame('planned', $catalog['achievements']['status']);
        $this->assertSame(Permission::count(), count(Catalog::enforcedSlugs()));
    }
}
