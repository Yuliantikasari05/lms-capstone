<?php

namespace App\Models;

use Database\Factories\InstitutionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Lembaga Bimbingan (mitra eksternal). Profil dari satu akun ber-role "lembaga".
 * Status akun dan kredensial tetap di User; di sini profil, bagi hasil, dan rekening pencairan.
 */
class Institution extends Model
{
    /** @use HasFactory<InstitutionFactory> */
    use HasFactory, SoftDeletes;

    /** user_id dan created_by sengaja tidak fillable: diisi eksplisit oleh controller. */
    protected $fillable = [
        'name', 'description', 'phone', 'address', 'revenue_share_percent',
        'bank_name', 'bank_account_holder', 'bank_account_number',
    ];

    /** Nomor rekening tidak pernah ikut serialisasi model. */
    protected $hidden = ['bank_account_number'];

    protected function casts(): array
    {
        return [
            'revenue_share_percent' => 'integer',
            'bank_account_number' => 'encrypted',
        ];
    }

    // ------------------------------------------------------------------ relasi

    /** withTrashed: profil tetap terbaca walau akunnya sudah dihapus (riwayat keuangan). */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(InstitutionPayout::class);
    }

    /** Program Lembaga = kursus jenis "institution" yang dibuat akun lembaga ini. */
    public function programs(): HasMany
    {
        return $this->hasMany(Course::class, 'created_by', 'user_id')->where('courses.type', Course::TYPE_INSTITUTION);
    }

    /** Voucher milik lembaga ini (tabel kupon, owner_type=institution). */
    public function vouchers(): HasMany
    {
        return $this->hasMany(Coupon::class, 'owner_id', 'user_id')->where('coupons.owner_type', Coupon::OWNER_INSTITUTION);
    }

    // ------------------------------------------------------------------ aturan

    public function hasRevenueShare(): bool
    {
        return $this->revenue_share_percent !== null;
    }

    public function hasBankAccount(): bool
    {
        return filled($this->bank_name) && filled($this->bank_account_holder) && filled($this->bank_account_number);
    }

    /** Empat digit terakhir rekening (untuk tampilan dan salinan pencairan). */
    public function bankAccountLast4(): ?string
    {
        $number = (string) $this->bank_account_number;

        return $number === '' ? null : substr($number, -4);
    }

    /** Contoh: "BCA ····7810 (Bimbel CN)". Nomor utuh tidak pernah ditampilkan. */
    public function bankLabel(): ?string
    {
        if (! $this->hasBankAccount()) {
            return null;
        }

        return "{$this->bank_name} ····{$this->bankAccountLast4()} ({$this->bank_account_holder})";
    }

    /**
     * Pembagian nominal yang dibayar pembeli: bagian lembaga dibulatkan ke bawah, sisanya platform,
     * sehingga jumlah keduanya selalu persis sama dengan nominal.
     *
     * @return array{institution: int, platform: int}
     */
    public function splitFor(int $netAmount): array
    {
        $share = (int) ($this->revenue_share_percent ?? 0);
        $institution = intdiv(max(0, $netAmount) * $share, 100);

        return ['institution' => $institution, 'platform' => max(0, $netAmount) - $institution];
    }

    public function auditLabel(): string
    {
        return $this->name;
    }
}
