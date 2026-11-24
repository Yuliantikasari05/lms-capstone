<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pencairan dana ke Lembaga ("Riwayat Pencairan Dana"). Diajukan/diproses Admin.
 * Rekening tujuan disalin saat pengajuan (bank, nama pemilik, 4 digit terakhir) agar riwayat tetap
 * benar walau rekening lembaga diubah; nomor rekening utuh tidak disalin ke sini.
 * Status: pending (Menunggu), completed (Selesai), cancelled (Dibatalkan; dana kembali ke saldo).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institution_payouts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->foreignId('institution_id')->constrained('institutions')->restrictOnDelete();
            $table->unsignedBigInteger('amount');
            $table->string('status', 20)->default('pending');
            $table->string('bank_name', 50)->nullable();
            $table->string('bank_account_holder', 100)->nullable();
            $table->string('bank_account_last4', 4)->nullable();
            $table->string('note', 255)->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('processed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['institution_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('institution_payouts');
    }
};
