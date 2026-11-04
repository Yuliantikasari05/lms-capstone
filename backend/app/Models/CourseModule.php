<?php

namespace App\Models;

use Database\Factories\CourseModuleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class CourseModule extends Model
{
    /** @use HasFactory<CourseModuleFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = ['title', 'position'];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class)->withTrashed();
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class)->orderBy('position')->orderBy('id');
    }

    public function auditLabel(): string
    {
        return $this->title;
    }
}
