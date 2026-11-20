<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Buku besar XP Siswa: setiap perubahan XP adalah satu baris yang tidak pernah diubah atau dihapus
 * (koreksi = baris baru). Satu sumber (materi, tugas, ujian) hanya dapat memberi XP sekali per Siswa:
 * dijaga oleh batasan unik di bawah (baris dengan source_id kosong, mis. koreksi Admin, tidak dibatasi).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('xp_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Bertanda: positif menambah, negatif mengurangi (hanya koreksi/reset Admin).
            $table->integer('amount');
            // material | task | exam | adjustment | reset
            $table->string('source_type', 30);
            $table->unsignedBigInteger('source_id')->nullable();
            $table->string('reason', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['user_id', 'source_type', 'source_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xp_transactions');
    }
};
