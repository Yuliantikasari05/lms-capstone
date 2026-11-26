<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tugas, kuis, dan ujian beserta soal dan pengumpulan peserta.
 *
 * Alur review mengikuti blueprint: tugas/kuis buatan Mentor langsung tersedia, ujian menunggu
 * persetujuan Admin (status "pending") dan baru aktif setelah disetujui.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->string('kind', 20); // task | quiz | exam
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->unsignedSmallInteger('max_score')->nullable();
            $table->boolean('allow_late')->default(false);
            $table->unsignedSmallInteger('late_penalty')->nullable();
            $table->unsignedSmallInteger('xp_points')->default(0);
            $table->string('status', 20)->default('draft'); // draft | pending | approved | rejected
            $table->string('review_note', 500)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['course_id', 'kind']);
            $table->index(['course_id', 'status']);
        });

        Schema::create('assignment_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->string('type', 30); // multiple_choice | essay | file_upload
            $table->text('prompt');
            $table->json('options')->nullable();
            $table->json('correct_option_ids')->nullable();
            $table->boolean('multi_select')->default(false);
            $table->unsignedSmallInteger('max_words')->nullable();
            $table->json('allowed_file_types')->nullable();
            $table->unsignedSmallInteger('max_file_size_mb')->nullable();
            $table->unsignedSmallInteger('max_files')->nullable();
            $table->unsignedSmallInteger('points')->default(0);
            $table->unsignedSmallInteger('position')->default(1);
            $table->timestamps();
        });

        Schema::create('assignment_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->constrained('assignments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('submitted_at');
            $table->string('status', 20)->default('submitted'); // submitted | graded
            $table->unsignedSmallInteger('score')->nullable();
            $table->text('feedback')->nullable();
            $table->foreignId('graded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('graded_at')->nullable();
            $table->timestamps();

            $table->unique(['assignment_id', 'user_id']);
        });

        Schema::create('assignment_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('submission_id')->constrained('assignment_submissions')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('assignment_questions')->cascadeOnDelete();
            $table->text('answer_text')->nullable();
            $table->json('selected_option_ids')->nullable();
            $table->string('file_name')->nullable();
            $table->unsignedSmallInteger('points_awarded')->nullable();
            $table->timestamps();

            $table->unique(['submission_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_answers');
        Schema::dropIfExists('assignment_submissions');
        Schema::dropIfExists('assignment_questions');
        Schema::dropIfExists('assignments');
    }
};
