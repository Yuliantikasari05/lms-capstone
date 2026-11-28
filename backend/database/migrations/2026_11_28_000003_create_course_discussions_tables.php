<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Forum diskusi per kursus (laporan capstone: diskusi kursus, semua peserta boleh membalas,
 * penulis boleh mengubah/menghapus miliknya sendiri, Mentor dan Admin boleh menghapus semua balasan).
 * Diskusi menempel pada kursus, bukan modul, agar satu forum berlaku untuk seluruh kelas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_discussions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 150);
            $table->text('body');
            $table->unsignedInteger('views')->default(0);
            $table->timestamps();

            $table->index(['course_id', 'id']);
        });

        Schema::create('course_discussion_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_discussion_id')->constrained('course_discussions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();

            $table->index(['course_discussion_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_discussion_replies');
        Schema::dropIfExists('course_discussions');
    }
};
