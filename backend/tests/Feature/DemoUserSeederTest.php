<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DemoUserSeederTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'KataSandiDemo123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        config(['lms.demo_password' => self::PASSWORD]);
    }

    private function demoUsers()
    {
        return User::withTrashed()->where('email', 'like', '%@'.DemoUserSeeder::DOMAIN);
    }

    public function test_creates_varied_users_each_with_exactly_one_role(): void
    {
        $this->seed(DemoUserSeeder::class);

        $users = $this->demoUsers()->with('roles')->get();
        $this->assertGreaterThan(15, $users->count(), 'Cukup banyak untuk menguji paginasi (15 per halaman).');

        foreach ($users as $user) {
            $this->assertCount(1, $user->roles, "{$user->email} harus punya tepat satu role.");
        }

        $this->assertEqualsCanonicalizing(
            ['mentor', 'siswa', 'karyawan', 'lembaga'],
            $users->flatMap->roles->pluck('slug')->unique()->values()->all(),
            'Admin tidak dibuat oleh seeder ini.'
        );
        $this->assertEqualsCanonicalizing(['active', 'inactive', 'suspended'], $users->pluck('status')->unique()->values()->all());
        $this->assertGreaterThan(0, $users->filter->trashed()->count(), 'Harus ada akun terhapus untuk tab Dihapus.');
        $this->assertGreaterThan(0, $users->whereNull('last_login_at')->count(), 'Harus ada yang belum pernah login.');
    }

    public function test_password_comes_from_config_and_is_hashed(): void
    {
        $this->seed(DemoUserSeeder::class);

        $user = $this->demoUsers()->firstOrFail();
        $this->assertNotSame(self::PASSWORD, $user->password);
        $this->assertTrue(Hash::check(self::PASSWORD, $user->password));
    }

    public function test_demo_user_can_log_in_but_deleted_demo_user_cannot(): void
    {
        $this->seed(DemoUserSeeder::class);

        $aktif = $this->demoUsers()->where('status', 'active')->whereNull('deleted_at')->firstOrFail();
        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $aktif->email, 'password' => self::PASSWORD])->assertOk();

        $this->app['auth']->guard('web')->logout();

        $dihapus = $this->demoUsers()->onlyTrashed()->firstOrFail();
        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $dihapus->email, 'password' => self::PASSWORD])->assertStatus(422);
    }

    public function test_is_idempotent_and_repairs_drift(): void
    {
        $this->seed(DemoUserSeeder::class);
        $jumlah = $this->demoUsers()->count();

        // Simulasi data berubah: seeding ulang mengembalikan ke kondisi awal tanpa menggandakan akun.
        $user = $this->demoUsers()->where('email', 'adi.saputra@'.DemoUserSeeder::DOMAIN)->firstOrFail();
        $user->update(['status' => 'suspended']);
        $user->roles()->sync([\App\Models\Role::where('slug', 'mentor')->value('id')]);

        $this->seed(DemoUserSeeder::class);

        $this->assertSame($jumlah, $this->demoUsers()->count());
        $user->refresh()->load('roles');
        $this->assertSame('active', $user->status);
        $this->assertSame(['siswa'], $user->roles->pluck('slug')->all());
    }

    public function test_does_not_touch_other_users(): void
    {
        $admin = $this->userWithRole('admin', ['email' => 'admin.asli@example.test', 'name' => 'Admin Asli']);

        $this->seed(DemoUserSeeder::class);

        $this->assertSame('Admin Asli', $admin->fresh()->name);
        $this->assertSame(['admin'], $admin->roles()->pluck('slug')->all());
    }

    public function test_refuses_to_run_outside_local_environment(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        // --force melewati konfirmasi bawaan `db:seed` di production, sehingga yang diuji adalah penjaga di seeder.
        $this->artisan('db:seed', ['--class' => DemoUserSeeder::class, '--force' => true])
            ->expectsOutputToContain('hanya boleh dijalankan di lingkungan local')
            ->assertSuccessful();

        $this->assertSame(0, $this->demoUsers()->count());
    }

    public function test_rejects_weak_configured_password(): void
    {
        config(['lms.demo_password' => 'pendek']);

        $this->seed(DemoUserSeeder::class);

        $this->assertSame(0, $this->demoUsers()->count());
    }

    public function test_generates_random_password_when_not_configured(): void
    {
        config(['lms.demo_password' => null]);

        $this->seed(DemoUserSeeder::class);

        $users = $this->demoUsers()->get();
        $this->assertGreaterThan(15, $users->count());
        $this->assertFalse(Hash::check('', $users->first()->password));
        $this->assertCount(1, $users->pluck('password')->unique(), 'Satu password acak dipakai semua akun demo.');
    }

    public function test_default_db_seed_does_not_create_demo_users(): void
    {
        $this->seed(\Database\Seeders\DatabaseSeeder::class);

        $this->assertSame(0, $this->demoUsers()->count());
    }
}
