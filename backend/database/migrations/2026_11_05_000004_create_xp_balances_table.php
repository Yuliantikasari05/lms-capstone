<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Saldo XP per Siswa (ringkasan dari xp_transactions) agar papan peringkat cepat. Selalu diperbarui
 * dalam transaksi yang sama dengan buku besar oleh XpService.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('xp_balances', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('total_xp')->default(0);
            $table->timestamp('updated_at')->nullable();

            $table->index('total_xp');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xp_balances');
    }
};
