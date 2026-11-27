<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Progres belajar peserta (FR-37, FR-39, FR-41, FR-42, FR-44).
 *
 * - material_completions: materi yang sudah diselesaikan peserta. XP materi diberikan sekali
 *   (dicatat di xp_transactions dengan sumber "material"), kolom xp_awarded hanya untuk jejak.
 * - session_attendances: kehadiran tercatat saat peserta menekan "Gabung sesi" (satu baris per sesi).
 * - study_logs: akumulasi menit belajar per peserta, kursus, dan tanggal, dari sinyal 1 menit
 *   selama halaman materi terbuka.
 * - learning_days: hari aktif (kalender WIB) dari login pertama pada tanggal tersebut; dasar
 *   "Total Hari Aktif" di Laporan dan Daily Streak di dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_completions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->timestamp('completed_at');
            $table->unsignedSmallInteger('xp_awarded')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'material_id']);
            $table->index(['user_id', 'completed_at']);
        });

        Schema::create('session_attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_session_id')->constrained('class_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('joined_at');
            $table->timestamps();

            $table->unique(['class_session_id', 'user_id']);
            $table->index(['user_id', 'joined_at']);
        });

        Schema::create('study_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->date('studied_on');
            $table->unsignedInteger('minutes')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'course_id', 'studied_on']);
            $table->index(['user_id', 'studied_on']);
        });

        Schema::create('learning_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('day');
            $table->timestamps();

            $table->unique(['user_id', 'day']);
            $table->index(['user_id', 'day']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learning_days');
        Schema::dropIfExists('study_logs');
        Schema::dropIfExists('session_attendances');
        Schema::dropIfExists('material_completions');
    }
};
