<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Program Lembaga dapat dijual sebagai pembelajaran opsional: butuh kategori dan harga.
 * Harga disimpan sebagai rupiah bulat; discount_price kosong berarti tidak sedang diskon.
 * Nilai 0 berarti gratis. Kolom ini sengaja tidak fillable di model agar hanya dapat diubah
 * lewat endpoint "Atur Harga" milik Lembaga.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->string('category', 50)->nullable()->after('description');
            $table->unsignedInteger('price')->default(0)->after('category');
            $table->unsignedInteger('discount_price')->nullable()->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['category', 'price', 'discount_price']);
        });
    }
};
