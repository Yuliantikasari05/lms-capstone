<?php

namespace Database\Factories;

use App\Models\CourseModule;
use App\Models\Material;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Material> */
class MaterialFactory extends Factory
{
    protected $model = Material::class;

    public function definition(): array
    {
        return [
            'course_module_id' => CourseModule::factory(),
            'title' => fake()->words(3, true),
            'type' => Material::TYPE_LINK,
            'external_url' => 'https://contoh.test/materi',
            'xp_points' => 0,
            'position' => 0,
        ];
    }

    public function pdf(string $path = 'course-materials/contoh.pdf'): static
    {
        return $this->state([
            'type' => Material::TYPE_PDF,
            'external_url' => null,
            'file_path' => $path,
            'file_name' => 'contoh.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
        ]);
    }
}
