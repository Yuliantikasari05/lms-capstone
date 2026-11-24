<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Profil Lembaga Bimbingan (mitra eksternal). Satu akun Lembaga = satu lembaga = satu baris di sini
 * (user_id unik). Status akun (aktif/nonaktif/ditangguhkan) tetap di tabel users agar login dan
 * penonaktifan memakai satu sumber kebenaran.
 *
 * revenue_share_percent = bagian lembaga dari setiap penjualan (sisanya untuk platform). NULL berarti
 * "belum diatur": penjualan belum boleh dicatat sampai Admin mengisinya (lihat InstitutionRevenueService).
 * Nomor rekening disimpan terenkripsi (cast "encrypted" pada model) dan tidak pernah dikirim utuh lewat API.
 *
 * Akun Lembaga yang sudah ada sebelum migrasi ini diberi profil otomatis di bawah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institutions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->string('phone', 30)->nullable();
            $table->text('address')->nullable();
            $table->unsignedTinyInteger('revenue_share_percent')->nullable();
            $table->string('bank_name', 50)->nullable();
            $table->string('bank_account_holder', 100)->nullable();
            $table->text('bank_account_number')->nullable(); // terenkripsi
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
        });

        $this->backfillExistingInstitutionAccounts();
    }

    public function down(): void
    {
        Schema::dropIfExists('institutions');
    }

    /** Akun ber-role "lembaga" yang sudah ada mendapat profil minimal (nama = nama akun). */
    private function backfillExistingInstitutionAccounts(): void
    {
        $accounts = DB::table('users')
            ->join('role_user', 'role_user.user_id', '=', 'users.id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->where('roles.slug', 'lembaga')
            ->select('users.id', 'users.name', 'users.created_at', 'users.deleted_at')
            ->get();

        foreach ($accounts as $account) {
            DB::table('institutions')->insert([
                'user_id' => $account->id,
                'name' => mb_substr((string) $account->name, 0, 150),
                'created_at' => $account->created_at ?? now(),
                'updated_at' => now(),
                'deleted_at' => $account->deleted_at,
            ]);
        }
    }
};
