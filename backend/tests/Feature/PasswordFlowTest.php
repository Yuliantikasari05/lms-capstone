<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Notifications\EmailAddressChanged;
use App\Support\TemporaryPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PasswordFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
    }

    private function asAdmin(): static
    {
        return $this->as($this->admin);
    }

    /**
     * Berganti pelaku di tengah test. Guard "sanctum" menyimpan pengguna dari request sebelumnya,
     * jadi harus direset dulu agar actingAs benar-benar berlaku.
     */
    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    /** @return array{0:User,1:string} */
    private function createUserViaApi(string $role = 'siswa', string $email = 'baru@example.test'): array
    {
        $response = $this->asAdmin()->postJson('/api/v1/users', ['name' => 'Orang Baru', 'email' => $email, 'role' => $role])->assertCreated();

        return [User::where('email', $email)->firstOrFail(), $response->json('temporary_password')];
    }

    private function fakeSession(User $user, ?string $id = null): string
    {
        $id ??= bin2hex(random_bytes(20));
        DB::table('sessions')->insert([
            'id' => $id, 'user_id' => $user->id, 'ip_address' => '127.0.0.1',
            'user_agent' => 'phpunit', 'payload' => '', 'last_activity' => time(),
        ]);

        return $id;
    }

    // ------------------------------------------------------------------ pembuat kata sandi sementara

    public function test_temporary_password_generator_is_strong_and_random(): void
    {
        $seen = [];
        for ($i = 0; $i < 500; $i++) {
            $p = TemporaryPassword::generate();
            $this->assertSame(14, strlen($p));
            $this->assertMatchesRegularExpression('/[A-Z]/', $p);
            $this->assertMatchesRegularExpression('/[a-z]/', $p);
            $this->assertMatchesRegularExpression('/[0-9]/', $p);
            $this->assertDoesNotMatchRegularExpression('/[IlO01]/', $p, 'Tanpa karakter yang mudah tertukar.');
            $seen[$p] = true;
        }
        $this->assertCount(500, $seen, 'Tidak boleh ada kata sandi kembar.');
        $this->assertSame(12, strlen(TemporaryPassword::generate(5)), 'Panjang minimum 12.');
    }

    // ------------------------------------------------------------------ pembuatan akun

    public function test_admin_never_chooses_the_password(): void
    {
        $this->asAdmin()->postJson('/api/v1/users', [
            'name' => 'X', 'email' => 'x@example.test', 'role' => 'siswa', 'password' => 'PilihanAdmin12345',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $user = $this->userWithRole(Role::SISWA);
        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['password' => 'PilihanAdmin12345'])
            ->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->assertDatabaseMissing('users', ['email' => 'x@example.test']);
    }

    public function test_created_account_gets_a_one_time_temporary_password_that_must_be_changed(): void
    {
        $response = $this->asAdmin()->postJson('/api/v1/users', ['name' => 'Orang Baru', 'email' => 'baru@example.test', 'role' => 'siswa'])
            ->assertCreated()
            ->assertJsonPath('data.must_change_password', true);

        $temporary = $response->json('temporary_password');
        $this->assertSame(14, strlen($temporary));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));

        $user = User::where('email', 'baru@example.test')->firstOrFail();
        $this->assertNotSame($temporary, $user->password, 'Disimpan sebagai hash.');
        $this->assertTrue(Hash::check($temporary, $user->password));
        $this->assertTrue($user->must_change_password);

        // Kata sandi sementara tidak pernah muncul lagi di endpoint lain.
        $this->assertStringNotContainsString($temporary, json_encode($this->asAdmin()->getJson('/api/v1/users')->json()));
        $this->assertStringNotContainsString($temporary, json_encode($this->asAdmin()->getJson('/api/v1/users/'.$user->id)->json()));
    }

    public function test_temporary_password_logs_in_but_account_is_restricted_until_changed(): void
    {
        [$user, $temporary] = $this->createUserViaApi();

        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => $temporary])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        // Klien test tidak membawa cookie antar-request, jadi sesi disimulasikan dengan actingAs.
        $this->as($user->fresh());

        // Hanya /auth/me, /auth/password, dan logout yang boleh.
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.must_change_password', true);
        $this->getJson('/api/v1/roles')->assertStatus(403)->assertJsonPath('code', 'password_change_required');
        $this->getJson('/api/v1/users')->assertStatus(403)->assertJsonPath('code', 'password_change_required');
        $this->getJson('/api/v1/admin/summary')->assertStatus(403)->assertJsonPath('code', 'password_change_required');
        $this->postJson('/api/v1/auth/logout')->assertOk();
    }

    public function test_restriction_also_applies_to_an_admin_with_a_temporary_password(): void
    {
        // Middleware harus lebih dulu daripada pemeriksaan permission.
        $admin2 = $this->userWithRole(Role::ADMIN, ['must_change_password' => true]);

        $this->as($admin2)->getJson('/api/v1/users')
            ->assertStatus(403)->assertJsonPath('code', 'password_change_required');
    }

    // ------------------------------------------------------------------ ganti kata sandi sendiri

    public function test_change_password_validates_input(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['must_change_password' => true]); // kata sandi awal: password-rahasia-123
        $url = '/api/v1/auth/password';

        $this->as($user)->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['current_password', 'password']);

        $this->as($user)->postJson($url, [
            'current_password' => 'salah-total-123', 'password' => 'KataSandiBaru123', 'password_confirmation' => 'KataSandiBaru123',
        ])->assertStatus(422)->assertJsonValidationErrors(['current_password']);

        $this->as($user)->postJson($url, [
            'current_password' => 'password-rahasia-123', 'password' => 'pendek1', 'password_confirmation' => 'pendek1',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->as($user)->postJson($url, [
            'current_password' => 'password-rahasia-123', 'password' => 'KataSandiBaru123', 'password_confirmation' => 'BedKonfirmasi123',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->as($user)->postJson($url, [
            'current_password' => 'password-rahasia-123', 'password' => 'password-rahasia-123', 'password_confirmation' => 'password-rahasia-123',
        ])->assertStatus(422)->assertJsonValidationErrors(['password']);

        $this->assertTrue($user->fresh()->must_change_password, 'Gagal validasi tidak boleh melepas pembatasan.');
    }

    public function test_changing_the_temporary_password_lifts_the_restriction(): void
    {
        [$user, $temporary] = $this->createUserViaApi();

        $this->as($user->fresh());

        $this->getJson('/api/v1/users')->assertStatus(403)->assertJsonPath('code', 'password_change_required');

        $this->postJson('/api/v1/auth/password', [
            'current_password' => $temporary, 'password' => 'KataSandiBaruku99', 'password_confirmation' => 'KataSandiBaruku99',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Kata sandi berhasil diganti.')
            ->assertJsonPath('data.must_change_password', false);

        $this->assertFalse($user->fresh()->must_change_password);
        $this->as($user->fresh())->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.must_change_password', false);

        // Kata sandi sementara tidak berlaku lagi; yang baru berlaku.
        $this->assertFalse(Hash::check($temporary, $user->fresh()->password));
        $this->assertTrue(Hash::check('KataSandiBaruku99', $user->fresh()->password));

        // Dan login dengan kata sandi baru berhasil, yang sementara ditolak.
        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => $temporary])->assertStatus(422);
        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'KataSandiBaruku99'])
            ->assertOk()->assertJsonPath('data.must_change_password', false);
    }

    public function test_changing_password_signs_out_other_devices(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $this->fakeSession($user);
        $this->fakeSession($user);
        $this->assertSame(2, DB::table('sessions')->where('user_id', $user->id)->count());

        $this->as($user)->postJson('/api/v1/auth/password', [
            'current_password' => 'password-rahasia-123', 'password' => 'KataSandiBaruku99', 'password_confirmation' => 'KataSandiBaruku99',
        ])->assertOk();

        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
    }

    public function test_revoke_sessions_can_keep_one_session(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $other = $this->userWithRole(Role::SISWA);
        $keep = $this->fakeSession($user);
        $this->fakeSession($user);
        $this->fakeSession($other);

        $user->revokeSessions($keep);

        $this->assertSame([$keep], DB::table('sessions')->where('user_id', $user->id)->pluck('id')->all());
        $this->assertSame(1, DB::table('sessions')->where('user_id', $other->id)->count(), 'Sesi pengguna lain tidak tersentuh.');
    }

    // ------------------------------------------------------------------ reset oleh Admin

    public function test_admin_reset_issues_new_temporary_password_and_signs_user_out(): void
    {
        $user = $this->userWithRole(Role::SISWA);
        $this->fakeSession($user);
        $oldHash = $user->password;

        $response = $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/reset-password')
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true)
            ->assertJsonStructure(['message', 'temporary_password', 'data' => ['id', 'email']]);

        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $temporary = $response->json('temporary_password');

        $user->refresh();
        $this->assertNotSame($oldHash, $user->password);
        $this->assertTrue(Hash::check($temporary, $user->password));
        $this->assertFalse(Hash::check('password-rahasia-123', $user->password), 'Kata sandi lama tidak berlaku lagi.');
        $this->assertTrue($user->must_change_password);
        $this->assertSame(0, DB::table('sessions')->where('user_id', $user->id)->count());
    }

    public function test_full_reset_journey_reset_login_blocked_change_free(): void
    {
        $user = $this->userWithRole(Role::MENTOR);

        $temporary = $this->asAdmin()->postJson('/api/v1/users/'.$user->id.'/reset-password')->json('temporary_password');
        $this->app['auth']->guard('web')->logout();

        $this->asSpa()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => $temporary])
            ->assertOk()->assertJsonPath('data.must_change_password', true);

        $this->as($user->fresh());
        $this->getJson('/api/v1/roles')->assertStatus(403)->assertJsonPath('code', 'password_change_required');

        $this->postJson('/api/v1/auth/password', [
            'current_password' => $temporary, 'password' => 'KataSandiBaruku99', 'password_confirmation' => 'KataSandiBaruku99',
        ])->assertOk();

        // Mentor tidak punya roles.view, jadi 403 biasa (tanpa kode password_change_required): pembatasan sudah lepas.
        $this->as($user->fresh());
        $response = $this->getJson('/api/v1/roles')->assertStatus(403);
        $this->assertNull($response->json('code'));
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.must_change_password', false);
    }

    public function test_admin_cannot_reset_own_password_and_deleted_users_are_not_found(): void
    {
        $this->asAdmin()->postJson('/api/v1/users/'.$this->admin->id.'/reset-password')->assertForbidden();

        $gone = $this->userWithRole(Role::SISWA);
        $gone->delete();
        $this->asAdmin()->postJson('/api/v1/users/'.$gone->id.'/reset-password')->assertNotFound();
    }

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_cannot_reset_passwords(string $role): void
    {
        $actor = $this->userWithRole($role);
        $target = $this->userWithRole(Role::SISWA);

        $this->as($actor)->postJson('/api/v1/users/'.$target->id.'/reset-password')->assertForbidden();
        $this->assertFalse($target->fresh()->must_change_password);
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guest_cannot_reset_or_change_password(): void
    {
        $this->postJson('/api/v1/users/1/reset-password')->assertUnauthorized();
        $this->postJson('/api/v1/auth/password', [])->assertUnauthorized();
    }

    // ------------------------------------------------------------------ notifikasi email diubah

    public function test_changing_email_notifies_the_old_address(): void
    {
        Notification::fake();
        $user = $this->userWithRole(Role::SISWA, ['email' => 'lama@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['email' => 'baru.sekali@example.test'])->assertOk();

        Notification::assertSentOnDemand(EmailAddressChanged::class, function (EmailAddressChanged $n, array $channels, $notifiable) {
            return $notifiable->routes['mail'] === 'lama@example.test'
                && $n->newEmail === 'baru.sekali@example.test'
                && $channels === ['mail'];
        });
    }

    public function test_no_notification_when_email_is_unchanged(): void
    {
        Notification::fake();
        $user = $this->userWithRole(Role::SISWA, ['email' => 'tetap@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['name' => 'Nama Lain', 'email' => 'tetap@example.test'])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_notification_email_masks_the_new_address_and_hides_the_admin(): void
    {
        config(['mail.default' => 'array']);
        $user = $this->userWithRole(Role::SISWA, ['email' => 'lama@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['email' => 'rahasia.baru@example.test'])->assertOk();

        $messages = app('mail.manager')->mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);

        $body = $messages[0]->toString();
        $this->assertStringContainsString('lama@example.test', $body, 'Dikirim ke email lama.');
        $this->assertStringContainsString('ra***@example.test', $body);
        $this->assertStringNotContainsString('rahasia.baru@example.test', $body, 'Email baru harus disamarkan.');
        $this->assertStringNotContainsString('Admin Uji', $body, 'Identitas Admin tidak dibocorkan.');
    }

    public function test_failure_to_send_the_notification_does_not_break_the_update(): void
    {
        config(['mail.default' => 'mailer-yang-tidak-ada']);
        $user = $this->userWithRole(Role::SISWA, ['email' => 'lama@example.test']);

        $this->asAdmin()->patchJson('/api/v1/users/'.$user->id, ['email' => 'baru@example.test'])
            ->assertOk()->assertJsonPath('data.email', 'baru@example.test');
    }

    public function test_mask_helper(): void
    {
        $this->assertSame('bu***@gmail.com', EmailAddressChanged::mask('budi.santoso@gmail.com'));
        $this->assertSame('a***@x.id', EmailAddressChanged::mask('a@x.id'));
    }
}
