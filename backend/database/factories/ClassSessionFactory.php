<?php

namespace Database\Factories;

use App\Models\ClassSession;
use App\Models\Course;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ClassSession> */
class ClassSessionFactory extends Factory
{
    protected $model = ClassSession::class;

    public function definition(): array
    {
        $start = now()->addDays(fake()->numberBetween(1, 30))->setTime(9, 0);

        return [
            'course_id' => Course::factory(),
            'title' => fake()->words(3, true),
            'starts_at' => $start,
            'ends_at' => $start->copy()->addHours(2),
            'meeting_url' => 'https://meet.contoh.test/'.fake()->lexify('????-????'),
        ];
    }
}
