<?php

namespace Tests\Feature;

use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\LearningNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Fitur role Lembaga Bimbingan: dashboard, program, siswa, voucher, harga, profil, laporan,
 * dan notifikasi. Semua data dibatasi kepemilikan akun yang login.
 */
class LembagaApiTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Institution $institution;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedRbac();

        $this->owner = $this->userWithRole(Role::LEMBAGA, ['name' => 'Lembaga Saya']);
        $this->institution = Institution::factory()->forUser($this->owner)->withBank()->create(['name' => 'Lembaga Saya']);
    }

    private function program(?User $owner = null, string $title = 'Program Uji', string $status = Course::STATUS_ACTIVE, int $price = 150_000): Course
    {
        $course = Course::factory()->institution($owner ?? $this->owner)->create([
            'title' => $title,
            'status' => $status,
            'category' => 'teknologi',
        ]);
        $course->price = $price;
        $course->save();

        return $course;
    }

    /** Akun Lembaga lain beserta programnya, untuk membuktikan isolasi data. */
    private function otherInstitution(): array
    {
        $user = $this->userWithRole(Role::LEMBAGA, ['name' => 'Lembaga Lain']);
        $institution = Institution::factory()->forUser($user)->create(['name' => 'Lembaga Lain']);

        return [$user, $institution, $this->program($user, 'Program Lembaga Lain')];
    }

    public function test_dashboard_summary_counts_only_own_programs(): void
    {
        $program = $this->program();
        $this->program(title: 'Program Kedua', status: Course::STATUS_DRAFT);
        $this->otherInstitution();

        $student = $this->userWithRole(Role::SISWA);
        Enrollment::factory()->create(['course_id' => $program->id, 'user_id' => $student->id, 'status' => Enrollment::STATUS_ACTIVE]);
        Transaction::factory()->amount(200_000)->create(['course_id' => $program->id, 'institution_id' => $this->institution->id]);

        $response = $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/summary')->assertOk();

        $this->assertSame(1, $response->json('data.cards.active_programs'));
        $this->assertSame(1, $response->json('data.cards.total_students'));
        $this->assertSame(1, $response->json('data.cards.total_enrollments'));
        $this->assertSame(160_000, $response->json('data.cards.total_revenue'));
        $this->assertCount(2, $response->json('data.programs'));
        $this->assertSame('Lembaga Saya', $response->json('data.institution.name'));
    }

    public function test_lembaga_can_create_institution_program_but_not_other_types(): void
    {
        $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/courses', ['type' => 'institution', 'title' => 'Kelas Opsional', 'status' => 'active', 'category' => 'desain'])
            ->assertCreated()
            ->assertJsonPath('data.type', 'institution')
            ->assertJsonPath('data.status', 'active');

        $course = Course::where('title', 'Kelas Opsional')->firstOrFail();
        $this->assertSame($this->owner->id, $course->created_by);
        $this->assertNull($course->mentor_id);
        $this->assertSame('desain', $course->category);

        $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/courses', ['type' => 'academic', 'title' => 'Kelas Biasa'])
            ->assertStatus(422);
    }

    public function test_lembaga_cannot_touch_another_institutions_program_content(): void
    {
        [, , $otherProgram] = $this->otherInstitution();

        $this->actingAs($this->owner, 'web')
            ->patchJson("/api/v1/courses/{$otherProgram->id}", ['title' => 'Diambil alih'])
            ->assertForbidden();

        $this->actingAs($this->owner, 'web')
            ->postJson("/api/v1/courses/{$otherProgram->id}/modules", ['title' => 'Modul'])
            ->assertForbidden();
    }

    public function test_students_list_and_detail_are_limited_to_own_programs(): void
    {
        $program = $this->program();
        $mine = $this->userWithRole(Role::SISWA, ['name' => 'Siswa Saya']);
        $outsider = $this->userWithRole(Role::SISWA, ['name' => 'Siswa Lain']);
        Enrollment::factory()->create(['course_id' => $program->id, 'user_id' => $mine->id, 'status' => Enrollment::STATUS_ACTIVE]);

        [, , $otherProgram] = $this->otherInstitution();
        Enrollment::factory()->create(['course_id' => $otherProgram->id, 'user_id' => $outsider->id, 'status' => Enrollment::STATUS_ACTIVE]);

        $list = $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/students')->assertOk();
        $this->assertSame(['Siswa Saya'], array_column($list->json('data'), 'name'));

        $this->actingAs($this->owner, 'web')
            ->getJson("/api/v1/lembaga/students/{$mine->id}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Siswa Saya')
            ->assertJsonPath('data.programs.0.course.title', $program->title)
            ->assertJsonPath('data.metrics.progress_percent', null);

        $this->actingAs($this->owner, 'web')
            ->getJson("/api/v1/lembaga/students/{$outsider->id}")
            ->assertNotFound();
    }

    public function test_voucher_crud_is_owned_and_codes_are_unique(): void
    {
        $program = $this->program();

        $created = $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/lembaga/vouchers', [
                'name' => 'Promo Awal', 'code' => 'promo10', 'discount_type' => 'percentage',
                'discount_value' => 10, 'usage_limit' => 50, 'course_id' => $program->id, 'expires_at' => now()->addMonth()->toDateString(),
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'PROMO10')
            ->json('data');

        $this->assertDatabaseHas('coupons', [
            'id' => $created['id'], 'owner_type' => Coupon::OWNER_INSTITUTION, 'owner_id' => $this->owner->id,
        ]);

        $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/lembaga/vouchers', [
                'name' => 'Duplikat', 'code' => 'PROMO10', 'discount_type' => 'percentage',
                'discount_value' => 5, 'expires_at' => now()->addMonth()->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->actingAs($this->owner, 'web')
            ->patchJson("/api/v1/lembaga/vouchers/{$created['id']}", ['name' => 'Promo Diubah', 'is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.name', 'Promo Diubah')
            ->assertJsonPath('data.status', 'inactive');

        // Voucher lembaga lain tidak terlihat dan tidak dapat diubah.
        [$otherUser] = $this->otherInstitution();
        $foreign = Coupon::factory()->create(['owner_type' => Coupon::OWNER_INSTITUTION, 'owner_id' => $otherUser->id]);

        $this->actingAs($this->owner, 'web')->getJson("/api/v1/lembaga/vouchers/{$foreign->id}")->assertNotFound();
        $this->actingAs($this->owner, 'web')->patchJson("/api/v1/lembaga/vouchers/{$foreign->id}", ['name' => 'X'])->assertNotFound();

        $this->actingAs($this->owner, 'web')->deleteJson("/api/v1/lembaga/vouchers/{$created['id']}")->assertOk();
        $this->assertSoftDeleted('coupons', ['id' => $created['id']]);
    }

    public function test_voucher_course_must_belong_to_the_institution(): void
    {
        [, , $otherProgram] = $this->otherInstitution();

        $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/lembaga/vouchers', [
                'name' => 'Salah Program', 'code' => 'SALAH1', 'discount_type' => 'fixed', 'discount_value' => 10_000,
                'course_id' => $otherProgram->id, 'expires_at' => now()->addMonth()->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('course_id');
    }

    public function test_pricing_can_be_updated_for_own_program_only(): void
    {
        $program = $this->program(price: 200_000);

        $this->actingAs($this->owner, 'web')
            ->patchJson("/api/v1/lembaga/programs/{$program->id}/pricing", ['price' => 350_000, 'discount_price' => 250_000])
            ->assertOk()
            ->assertJsonPath('data.price', 350_000)
            ->assertJsonPath('data.price_label', 'Rp 250.000');

        $this->assertSame(250_000, $program->fresh()->discount_price);

        $this->actingAs($this->owner, 'web')
            ->patchJson("/api/v1/lembaga/programs/{$program->id}/pricing", ['price' => 100_000, 'discount_price' => 150_000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('discount_price');

        [, , $otherProgram] = $this->otherInstitution();
        $this->actingAs($this->owner, 'web')
            ->patchJson("/api/v1/lembaga/programs/{$otherProgram->id}/pricing", ['price' => 1_000])
            ->assertNotFound();

        $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/pricing')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_profile_is_readable_and_updates_sync_the_account_name(): void
    {
        $this->actingAs($this->owner, 'web')
            ->getJson('/api/v1/lembaga/profile')
            ->assertOk()
            ->assertJsonPath('data.name', 'Lembaga Saya')
            ->assertJsonPath('data.account.email', $this->owner->email)
            ->assertJsonPath('data.bank.account_last4', '7810');

        $this->actingAs($this->owner, 'web')
            ->patchJson('/api/v1/lembaga/profile', ['name' => 'Lembaga Baru', 'description' => 'Deskripsi baru'])
            ->assertOk();

        $this->assertSame('Lembaga Baru', $this->institution->fresh()->name);
        $this->assertSame('Lembaga Baru', $this->owner->fresh()->name);
    }

    public function test_report_returns_own_revenue_and_sales(): void
    {
        $program = $this->program();
        Transaction::factory()->amount(300_000)->create(['course_id' => $program->id, 'institution_id' => $this->institution->id]);

        $report = $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/reports')->assertOk();

        $this->assertSame(240_000, $report->json('data.summary.total_revenue'));
        $this->assertSame(1, $report->json('data.programs.0.sold_count'));
        $this->assertSame(240_000, $report->json('data.programs.0.revenue'));
    }

    public function test_new_program_notifies_admins_and_new_enrollment_notifies_the_institution(): void
    {
        Notification::fake();
        $admin = $this->userWithRole(Role::ADMIN);

        $this->actingAs($this->owner, 'web')
            ->postJson('/api/v1/courses', ['type' => 'institution', 'title' => 'Program Baru', 'status' => 'active'])
            ->assertCreated();

        Notification::assertSentTo($admin, LearningNotification::class);

        $program = Course::where('title', 'Program Baru')->firstOrFail();
        $student = $this->userWithRole(Role::SISWA);

        // Ganti pengguna: guard Sanctum menyimpan pengguna request sebelumnya, jadi guard dibersihkan dahulu.
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin->fresh(), 'web')
            ->postJson("/api/v1/courses/{$program->id}/enrollments", ['user_ids' => [$student->id]])
            ->assertCreated();

        Notification::assertSentTo($this->owner, LearningNotification::class);
        Notification::assertSentTo($student, LearningNotification::class);
    }

    public function test_institution_endpoints_are_forbidden_without_the_permission(): void
    {
        $lembagaRole = Role::where('slug', Role::LEMBAGA)->firstOrFail();
        $lembagaRole->permissions()->sync([]);

        $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/vouchers')->assertForbidden();
        $this->actingAs($this->owner, 'web')->getJson('/api/v1/lembaga/students')->assertForbidden();
    }
}
