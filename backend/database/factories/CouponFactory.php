<?php

namespace Database\Factories;

use App\Models\Coupon;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Coupon> */
class CouponFactory extends Factory
{
    protected $model = Coupon::class;

    public function definition(): array
    {
        return [
            'name' => null,
            'code' => 'KUPON'.fake()->unique()->numerify('####'),
            'discount_type' => Coupon::TYPE_PERCENTAGE,
            'discount_value' => 10,
            'usage_limit' => null,
            'course_id' => null,
            'expires_at' => null,
            'is_active' => true,
            'owner_type' => Coupon::OWNER_ADMIN,
        ];
    }

    public function percentage(int $value): static
    {
        return $this->state(['discount_type' => Coupon::TYPE_PERCENTAGE, 'discount_value' => $value]);
    }

    public function fixed(int $value): static
    {
        return $this->state(['discount_type' => Coupon::TYPE_FIXED, 'discount_value' => $value]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }

    public function expired(): static
    {
        return $this->state(['expires_at' => now()->subDay()]);
    }

    public function limited(int $limit): static
    {
        return $this->state(['usage_limit' => $limit]);
    }

    public function institution(): static
    {
        return $this->state(['owner_type' => Coupon::OWNER_INSTITUTION]);
    }
}
