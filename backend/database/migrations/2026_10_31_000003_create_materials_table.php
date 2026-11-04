<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Materi (item di dalam modul): video, pdf, dokumen, atau tautan. File disimpan di disk privat;
 * kolom file_path hanya berisi path relatif di disk, bukan URL publik.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_module_id')->constrained('course_modules')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('type', 20);
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->unsignedSmallInteger('duration_minutes')->nullable();
            // XP hanya untuk kursus akademik (dan program lembaga); aturan ini dijaga di validasi.
            $table->unsignedSmallInteger('xp_points')->default(0);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_module_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
