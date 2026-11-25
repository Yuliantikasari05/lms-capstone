<?php

namespace Tests\Feature;

use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Sesi tatap muka (Offline) tidak memakai link meeting; pembatalan sesi menyimpan alasannya. */
class OfflineSessionTest extends TestCase
{
    use RefreshDatabase;

    private User $mentor;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();
        $this->mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Rina Kusumawati']);
        $this->course = Course::factory()->active()->mentoredBy($this->mentor)->create();
    }

    private function payload(array $override = []): array
    {
        return array_merge([
            'title' => 'Bimbingan Tatap Muka',
            'starts_at' => '2026-12-02T13:00:00+07:00',
            'ends_at' => '2026-12-02T15:00:00+07:00',
            'mode' => 'offline',
            'location' => 'Ruang bimbingan 1',
        ], $override);
    }

    public function test_an_offline_session_is_saved_without_a_meeting_link(): void
    {
        $this->actingAs($this->mentor, 'web')
            ->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.mode', 'offline')
            ->assertJsonPath('data.mode_label', 'Offline')
            ->assertJsonPath('data.location', 'Ruang bimbingan 1')
            ->assertJsonPath('data.meeting_url', null);

        $session = ClassSession::firstOrFail();
        $this->assertSame(ClassSession::MODE_OFFLINE, $session->mode);
        $this->assertNull($session->meeting_url);
        $this->assertSame('Ruang bimbingan 1', $session->location);
    }

    public function test_a_link_is_still_required_for_online_sessions(): void
    {
        $this->actingAs($this->mentor, 'web')
            ->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload(['mode' => 'online']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['meeting_url']);
    }

    public function test_switching_a_session_to_offline_clears_its_link(): void
    {
        $session = ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'meeting_url' => 'https://meet.google.com/abc-defg-hij',
        ]);

        $this->actingAs($this->mentor, 'web')
            ->patchJson('/api/v1/sessions/'.$session->id, ['mode' => 'offline', 'location' => 'Aula'])
            ->assertOk()
            ->assertJsonPath('data.mode', 'offline')
            ->assertJsonPath('data.location', 'Aula')
            ->assertJsonPath('data.meeting_url', null);

        $this->assertNull($session->fresh()->meeting_url);
    }

    public function test_a_session_can_be_saved_as_a_draft(): void
    {
        $this->actingAs($this->mentor, 'web')
            ->postJson('/api/v1/courses/'.$this->course->id.'/sessions', $this->payload(['status' => 'draft']))
            ->assertCreated()
            ->assertJsonPath('data.schedule_status', 'draft')
            ->assertJsonPath('data.schedule_status_label', 'Draft');
    }

    public function test_cancelling_a_session_requires_and_stores_a_reason(): void
    {
        $session = ClassSession::factory()->create(['course_id' => $this->course->id]);

        $this->actingAs($this->mentor, 'web')
            ->patchJson('/api/v1/sessions/'.$session->id, ['status' => 'cancelled'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cancellation_reason']);

        $this->actingAs($this->mentor, 'web')
            ->patchJson('/api/v1/sessions/'.$session->id, [
                'status' => 'cancelled',
                'cancellation_reason' => 'Mentor berhalangan hadir.',
            ])
            ->assertOk()
            ->assertJsonPath('data.schedule_status', 'cancelled')
            ->assertJsonPath('data.cancellation_reason', 'Mentor berhalangan hadir.');

        $this->assertSame(ClassSession::STATUS_CANCELLED, $session->fresh()->status);
    }

    public function test_the_session_list_reports_mode_participants_and_mentor(): void
    {
        ClassSession::factory()->create([
            'course_id' => $this->course->id,
            'mode' => ClassSession::MODE_OFFLINE,
            'location' => 'Ruang 2',
            'meeting_url' => null,
        ]);

        $this->actingAs($this->mentor, 'web')
            ->getJson('/api/v1/courses/'.$this->course->id.'/sessions')
            ->assertOk()
            ->assertJsonPath('data.0.mode', 'offline')
            ->assertJsonPath('data.0.mentor_name', 'Rina Kusumawati')
            ->assertJsonPath('data.0.participants', 0);
    }
}
