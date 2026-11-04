<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pendaftaran peserta ke kursus. Satu pasangan (kursus, pengguna) hanya satu baris; pembatalan mengubah
 * status menjadi "cancelled" (riwayat tidak dihapus) dan mendaftar ulang mengaktifkannya kembali.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained('courses')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('active');
            // admin = didaftarkan Admin; purchase = dibeli sendiri (Program Lembaga, tahap berikutnya)
            $table->string('source', 20)->default('admin');
            $table->foreignId('enrolled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('enrolled_at')->useCurrent();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->unique(['course_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
    }
};
