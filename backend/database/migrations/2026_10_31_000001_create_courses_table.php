<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kursus (di desain/ERD disebut juga "kurikulum"). Empat jenis: academic, training, webinar, institution
 * (Program Lembaga). Jenis dan status disimpan sebagai string dan divalidasi di aplikasi (bukan enum database)
 * agar berjalan sama di PostgreSQL dan SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft');
            // Satu kursus diampu satu Mentor. Kosong untuk draf dan untuk Program Lembaga.
            $table->foreignId('mentor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'status']);
            $table->index('mentor_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};
