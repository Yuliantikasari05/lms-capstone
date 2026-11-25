<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Mentor sudah menyediakan deskripsi modul dan sesi; kolomnya disimpan agar isian
 * tidak hilang setelah halaman dimuat ulang. Nullable supaya data lama tidak perlu diubah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_modules', function (Blueprint $table) {
            $table->text('description')->nullable();
        });

        Schema::table('class_sessions', function (Blueprint $table) {
            $table->text('description')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        Schema::table('course_modules', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
