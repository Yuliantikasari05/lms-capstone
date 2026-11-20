<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kupon (Admin) dan, kelak, voucher Lembaga: satu tabel dengan kolom pemilik (owner_type).
 * Sekarang hanya pemilik "admin"; voucher Lembaga dikerjakan di tahap pembayaran.
 * Jenis diskon disimpan sebagai string dan divalidasi di aplikasi (bukan enum database)
 * agar berjalan sama di PostgreSQL dan SQLite. Nominal berupa rupiah bulat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();
            $table->string('owner_type', 20)->default('admin');
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name')->nullable();
            // Disimpan huruf besar; unik (termasuk kupon yang sudah dihapus, kodenya tetap tercadangkan).
            $table->string('code', 30)->unique();
            $table->string('discount_type', 20);
            $table->unsignedInteger('discount_value');
            // null = tanpa batas penggunaan.
            $table->unsignedInteger('usage_limit')->nullable();
            // null = berlaku untuk semua kursus; terisi = khusus kursus/program tersebut.
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupons');
    }
};
