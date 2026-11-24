<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Transaksi pembelian (buku besar sederhana). Saat ini hanya dicatat untuk penjualan Program Lembaga
 * dan dibaca dashboard Lembaga/Admin. Diisi oleh modul pembayaran (tahap berikutnya, termasuk
 * "Bayar (simulasi)") lewat InstitutionRevenueService::recordSale().
 *
 * Pembagian hasil DICATAT SAAT TRANSAKSI (institution_share_percent, institution_amount,
 * platform_amount) sehingga mengubah persentase lembaga di kemudian hari tidak mengubah riwayat.
 * Semua nominal rupiah bulat. "reference" unik: transaksi yang sama tidak tercatat dua kali.
 * Baris tidak pernah dihapus; pengembalian dana mengubah status menjadi "refunded".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 64)->unique();
            $table->foreignId('institution_id')->nullable()->constrained('institutions')->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->foreignId('coupon_id')->nullable()->constrained('coupons')->nullOnDelete();
            $table->unsignedBigInteger('gross_amount');
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('net_amount');
            $table->unsignedTinyInteger('institution_share_percent')->default(0);
            $table->unsignedBigInteger('institution_amount')->default(0);
            $table->unsignedBigInteger('platform_amount')->default(0);
            $table->string('status', 20)->default('paid');
            $table->timestamp('paid_at')->useCurrent();
            $table->timestamps();

            $table->index(['institution_id', 'status', 'paid_at']);
            $table->index('course_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
