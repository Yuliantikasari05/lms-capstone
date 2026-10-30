<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soft delete untuk pengguna: akun yang "dihapus" hanya diberi tanda deleted_at,
 * sehingga riwayat (kursus, nilai, sertifikat, transaksi) tidak hilang dan akun bisa dipulihkan.
 * Berjalan di PostgreSQL maupun SQLite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
