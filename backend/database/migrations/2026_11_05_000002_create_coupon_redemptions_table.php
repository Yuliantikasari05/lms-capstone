<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Catatan pemakaian kupon. Dasar angka "Penggunaan" (terpakai/kuota) dan "Total Penggunaan".
 * "reference" (mis. id pembayaran) bersifat unik sehingga pemakaian yang sama tidak tercatat dua kali.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')->constrained('coupons')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('course_id')->nullable()->constrained('courses')->nullOnDelete();
            $table->string('reference', 64)->nullable()->unique();
            $table->unsignedBigInteger('original_amount');
            $table->unsignedBigInteger('discount_amount');
            $table->timestamp('created_at')->useCurrent();

            $table->index('coupon_id');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_redemptions');
    }
};
