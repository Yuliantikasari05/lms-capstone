<?php

namespace Tests\Feature;

use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Ringkasan dashboard Mentor hanya menghitung kursus yang diampu pengguna tersebut. */
class MentorSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_summary_only_counts_the_mentors_own_courses(): void
    {
        $this->seedRbac();

        $mentor = $this->userWithRole(Role::MENTOR, ['name' => 'Mentor A']);
        $other = $this->userWithRole(Role::MENTOR, ['name' => 'Mentor B']);

        $active = Course::factory()->active()->mentoredBy($mentor)->create(['title' => 'Kursus Aktif']);
        Course::factory()->mentoredBy($mentor)->create(['title' => 'Kursus Draf']);
        $foreign = Course::factory()->active()->mentoredBy($other)->create(['title' => 'Kursus Lain']);

        Enrollment::factory()->create([
            'course_id' => $active->id,
            'user_id' => $this->userWithRole(Role::SISWA, ['status' => User::STATUS_ACTIVE])->id,
        ]);
        Enrollment::factory()->create([
            'course_id' => $active->id,
            'user_id' => $this->userWithRole(Role::SISWA, ['status' => User::STATUS_INACTIVE])->id,
        ]);
        Enrollment::factory()->create([
            'course_id' => $foreign->id,
            'user_id' => $this->userWithRole(Role::SISWA)->id,
        ]);

        ClassSession::factory()->create([
            'course_id' => $active->id,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHour(),
        ]);
        ClassSession::factory()->create([
            'course_id' => $foreign->id,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDay()->addHour(),
        ]);

        $this->actingAs($mentor, 'web')
            ->getJson('/api/v1/mentor/summary')
            ->assertOk()
            ->assertJsonPath('data.courses_total', 2)
            ->assertJsonPath('data.courses_active', 1)
            ->assertJsonPath('data.students_total', 2)
            ->assertJsonPath('data.students_active', 1)
            ->assertJsonPath('data.upcoming_sessions_total', 1)
            ->assertJsonCount(2, 'data.courses')
            ->assertJsonCount(1, 'data.upcoming_sessions');
    }

    public function test_a_mentor_without_courses_gets_zeroes(): void
    {
        $this->seedRbac();

        $mentor = $this->userWithRole(Role::MENTOR);

        $this->actingAs($mentor, 'web')
            ->getJson('/api/v1/mentor/summary')
            ->assertOk()
            ->assertJsonPath('data.courses_total', 0)
            ->assertJsonPath('data.students_total', 0)
            ->assertJsonPath('data.upcoming_sessions_total', 0);
    }

    public function test_a_user_without_course_permission_is_rejected(): void
    {
        $this->seedRbac();

        $this->actingAs(User::factory()->create(), 'web')
            ->getJson('/api/v1/mentor/summary')
            ->assertForbidden();
    }
}
