<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Detail jadwal sesi: mode (online/offline), lokasi untuk sesi tatap muka, status publikasi
 * (draft/terjadwal/dibatalkan), dan alasan pembatalan.
 *
 * meeting_url dibuat nullable karena sesi Offline tidak punya tautan meeting; kewajiban link
 * untuk sesi Online ditegakkan di SessionRequest.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            $table->string('mode', 20)->default('online')->after('ends_at');
            $table->string('location', 200)->nullable()->after('mode');
            $table->string('status', 20)->default('scheduled')->after('location');
            $table->string('cancellation_reason', 500)->nullable()->after('status');
            $table->string('meeting_url', 2048)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('class_sessions', function (Blueprint $table) {
            $table->dropColumn(['mode', 'location', 'status', 'cancellation_reason']);
        });
    }
};
