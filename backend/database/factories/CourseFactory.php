<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Course> */
class CourseFactory extends Factory
{
    protected $model = Course::class;

    public function definition(): array
    {
        return [
            'type' => Course::TYPE_ACADEMIC,
            'title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'status' => Course::STATUS_DRAFT,
            'mentor_id' => null,
            'created_by' => null,
        ];
    }

    public function academic(): static
    {
        return $this->state(['type' => Course::TYPE_ACADEMIC]);
    }

    public function training(): static
    {
        return $this->state(['type' => Course::TYPE_TRAINING]);
    }

    public function webinar(): static
    {
        return $this->state(['type' => Course::TYPE_WEBINAR]);
    }

    public function institution(?User $owner = null): static
    {
        return $this->state(['type' => Course::TYPE_INSTITUTION, 'mentor_id' => null, 'created_by' => $owner?->id]);
    }

    public function active(): static
    {
        return $this->state(['status' => Course::STATUS_ACTIVE]);
    }

    public function inactive(): static
    {
        return $this->state(['status' => Course::STATUS_INACTIVE]);
    }

    public function mentoredBy(User $mentor): static
    {
        return $this->state(['mentor_id' => $mentor->id]);
    }
}
