<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Notifikasi dalam aplikasi (lonceng di header dan halaman Notifikasi).
 *
 * Memakai tabel notifikasi bawaan Laravel (channel "database") agar terhubung langsung dengan
 * trait Notifiable pada model User: satu baris per pengguna, dibaca/dihapus sendiri oleh pemiliknya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
