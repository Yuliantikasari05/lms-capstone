<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Notifications\LearningNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Kontrak notifikasi dalam aplikasi: hanya milik sendiri, tandai dibaca, dan hapus. */
class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->student = $this->userWithRole(Role::SISWA);
    }

    private function notify(User $user, string $title = 'Tugas sudah dinilai'): void
    {
        $user->notify(new LearningNotification(
            LearningNotification::CATEGORY_ASSESSMENT,
            $title,
            'Nilaimu 88. Buka detail tugas untuk membaca feedback Mentor.',
            'Rina Kusumawati',
            'Mentor',
            'Lihat nilai',
            '/siswa/assignments',
        ));
    }

    public function test_list_returns_only_own_notifications_with_unread_count(): void
    {
        $this->notify($this->student, 'Notifikasi saya');
        $other = $this->userWithRole(Role::SISWA);
        $this->notify($other, 'Notifikasi orang lain');

        $response = $this->actingAs($this->student, 'web')->getJson('/api/v1/notifications')->assertOk();

        $response->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Notifikasi saya')
            ->assertJsonPath('data.0.is_read', false)
            ->assertJsonPath('data.0.category', 'assessment')
            ->assertJsonPath('data.0.href', '/siswa/assignments')
            ->assertJsonPath('meta.unread_count', 1);
    }

    public function test_marking_a_notification_read_updates_the_unread_count(): void
    {
        $this->notify($this->student);
        $id = $this->student->notifications()->value('id');

        $this->actingAs($this->student, 'web')
            ->patchJson("/api/v1/notifications/{$id}/read")
            ->assertOk()
            ->assertJsonPath('data.is_read', true)
            ->assertJsonPath('meta.unread_count', 0);

        $this->assertNotNull($this->student->notifications()->whereKey($id)->value('read_at'));
    }

    public function test_read_all_and_clear_apply_only_to_the_signed_in_user(): void
    {
        $this->notify($this->student);
        $this->notify($this->student, 'Notifikasi kedua');
        $other = $this->userWithRole(Role::SISWA);
        $this->notify($other);

        $this->actingAs($this->student, 'web')
            ->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('meta.unread_count', 0);

        $this->assertSame(0, $this->student->fresh()->unreadNotifications()->count());
        $this->assertSame(1, $other->fresh()->unreadNotifications()->count());

        $this->actingAs($this->student, 'web')
            ->deleteJson('/api/v1/notifications')
            ->assertOk();

        $this->assertSame(0, $this->student->notifications()->count());
        $this->assertSame(1, $other->notifications()->count());
    }

    public function test_a_user_cannot_read_or_delete_someone_elses_notification(): void
    {
        $other = $this->userWithRole(Role::SISWA);
        $this->notify($other);
        $id = $other->notifications()->value('id');

        $this->actingAs($this->student, 'web')
            ->patchJson("/api/v1/notifications/{$id}/read")
            ->assertNotFound();
        $this->actingAs($this->student, 'web')
            ->deleteJson("/api/v1/notifications/{$id}")
            ->assertNotFound();

        $this->assertSame(1, $other->notifications()->count());
        $this->assertNull($other->notifications()->whereKey($id)->value('read_at'));
    }

    public function test_notifications_require_authentication(): void
    {
        $this->getJson('/api/v1/notifications')->assertUnauthorized();
    }
}
