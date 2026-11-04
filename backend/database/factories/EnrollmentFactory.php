<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Enrollment> */
class EnrollmentFactory extends Factory
{
    protected $model = Enrollment::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'user_id' => User::factory(),
            'status' => Enrollment::STATUS_ACTIVE,
            'source' => Enrollment::SOURCE_ADMIN,
            'enrolled_at' => now(),
        ];
    }

    public function cancelled(): static
    {
        return $this->state(['status' => Enrollment::STATUS_CANCELLED, 'cancelled_at' => now()]);
    }
}
