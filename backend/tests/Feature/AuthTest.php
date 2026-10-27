<?php

namespace Tests\Feature;

use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
    }

    public function test_login_succeeds_with_valid_credentials(): void
    {
        $user = $this->userWithRole(Role::MENTOR, ['email' => 'mentor@example.test']);

        $this->asSpa()->postJson('/api/v1/auth/login', [
            'email' => 'mentor@example.test',
            'password' => 'password-rahasia-123',
        ])
            ->assertOk()
            ->assertJsonPath('data.email', 'mentor@example.test')
            ->assertJsonPath('data.primary_role', 'mentor')
            ->assertJsonPath('data.permissions', ['dashboard.mentor'])
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticatedAs($user, 'web');
        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->userWithRole(Role::SISWA, ['email' => 'siswa@example.test']);

        $this->asSpa()->postJson('/api/v1/auth/login', [
            'email' => 'siswa@example.test',
            'password' => 'salah-total',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertGuest('web');
    }

    public function test_login_requires_email_and_password(): void
    {
        $this->asSpa()->postJson('/api/v1/auth/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_inactive_account_cannot_login(): void
    {
        $this->userWithRole(Role::SISWA, ['email' => 'nonaktif@example.test', 'status' => 'inactive']);

        $this->asSpa()->postJson('/api/v1/auth/login', [
            'email' => 'nonaktif@example.test',
            'password' => 'password-rahasia-123',
        ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_inactive');

        $this->assertGuest('web');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_me_returns_profile_role_and_permissions(): void
    {
        $user = $this->userWithRole(Role::ADMIN);

        $response = $this->actingAs($user, 'web')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.primary_role', 'admin');

        $permissions = $response->json('data.permissions');
        $this->assertContains('users.view', $permissions);
        $this->assertContains('dashboard.admin', $permissions);
        $this->assertNotContains('dashboard.siswa', $permissions);
    }

    public function test_inactive_user_with_existing_session_is_rejected(): void
    {
        $user = $this->userWithRole(Role::SISWA, ['status' => 'suspended']);

        $this->actingAs($user, 'web')
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_inactive');
    }

    public function test_logout_ends_the_session(): void
    {
        $user = $this->userWithRole(Role::KARYAWAN);

        $this->actingAs($user, 'web')
            ->postJson('/api/v1/auth/logout')
            ->assertOk();

        $this->assertGuest('web');
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/v1/auth/logout')->assertUnauthorized();
    }
}
