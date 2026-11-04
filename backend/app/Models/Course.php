<?php

namespace App\Models;

use Database\Factories\CourseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Kursus. Di desain disebut juga "kurikulum"; di aplikasi selalu "kursus".
 */
class Course extends Model
{
    /** @use HasFactory<CourseFactory> */
    use HasFactory, SoftDeletes;

    public const TYPE_ACADEMIC = 'academic';       // Siswa, diampu Mentor, ada XP
    public const TYPE_TRAINING = 'training';       // Karyawan, diampu Mentor, ada sertifikat
    public const TYPE_WEBINAR = 'webinar';         // Karyawan, diampu Mentor, ada sertifikat
    public const TYPE_INSTITUTION = 'institution'; // Program Lembaga (dibuat Lembaga, tahap 4)

    public const TYPES = [self::TYPE_ACADEMIC, self::TYPE_TRAINING, self::TYPE_WEBINAR, self::TYPE_INSTITUTION];

    /** Jenis yang boleh dibuat lewat manajemen kursus Admin/Mentor. Program Lembaga dibuat Lembaga. */
    public const CREATABLE_TYPES = [self::TYPE_ACADEMIC, self::TYPE_TRAINING, self::TYPE_WEBINAR];

    public const TYPE_LABELS = [
        self::TYPE_ACADEMIC => 'Akademik',
        self::TYPE_TRAINING => 'Pelatihan',
        self::TYPE_WEBINAR => 'Webinar',
        self::TYPE_INSTITUTION => 'Program Lembaga',
    ];

    public const STATUS_DRAFT = 'draft';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_ACTIVE, self::STATUS_INACTIVE];

    public const STATUS_LABELS = [
        self::STATUS_DRAFT => 'Draf',
        self::STATUS_ACTIVE => 'Aktif',
        self::STATUS_INACTIVE => 'Nonaktif',
    ];

    /** mentor_id dan created_by sengaja tidak fillable: diisi eksplisit oleh controller. */
    protected $fillable = ['type', 'title', 'description', 'status'];

    // ------------------------------------------------------------------ relasi

    /** withTrashed: nama Mentor tetap tampil walaupun akunnya sudah dihapus. */
    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id')->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function modules(): HasMany
    {
        return $this->hasMany(CourseModule::class)->orderBy('position')->orderBy('id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ClassSession::class)->orderBy('starts_at')->orderBy('id');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function activeEnrollments(): HasMany
    {
        return $this->enrollments()->where('status', Enrollment::STATUS_ACTIVE);
    }

    // ------------------------------------------------------------------ aturan jenis kursus

    public function typeLabel(): string
    {
        return self::TYPE_LABELS[$this->type] ?? $this->type;
    }

    public function statusLabel(): string
    {
        return self::STATUS_LABELS[$this->status] ?? $this->status;
    }

    /** Role peserta yang boleh didaftarkan: akademik/program lembaga = Siswa, pelatihan/webinar = Karyawan. */
    public function participantRole(): string
    {
        return match ($this->type) {
            self::TYPE_TRAINING, self::TYPE_WEBINAR => Role::KARYAWAN,
            default => Role::SISWA,
        };
    }

    /** XP hanya berlaku untuk kursus akademik dan program lembaga (Siswa). */
    public function allowsXp(): bool
    {
        return in_array($this->type, [self::TYPE_ACADEMIC, self::TYPE_INSTITUTION], true);
    }

    public function isInstitutionProgram(): bool
    {
        return $this->type === self::TYPE_INSTITUTION;
    }

    /** Program Lembaga tidak memakai Mentor. */
    public function requiresMentor(): bool
    {
        return ! $this->isInstitutionProgram();
    }

    /** Pemilik: Mentor pengampu, atau Lembaga pembuat program lembaga. */
    public function isOwnedBy(User $user): bool
    {
        if ($this->isInstitutionProgram()) {
            return $this->created_by !== null && $this->created_by === $user->id && $user->hasRole(Role::LEMBAGA);
        }

        return $this->mentor_id !== null && $this->mentor_id === $user->id && $user->hasRole(Role::MENTOR);
    }

    public function auditLabel(): string
    {
        return $this->title;
    }

    // ------------------------------------------------------------------ visibilitas per pengguna

    /**
     * Kursus yang boleh dilihat pengguna:
     * Admin = semua; Mentor = yang diampunya; Lembaga = program miliknya;
     * Siswa/Karyawan = kursus AKTIF yang diikutinya (pendaftaran aktif).
     * Pengguna dengan role lain tidak melihat apa pun.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->hasRole(Role::ADMIN)) {
            return $query;
        }

        return $query->where(function (Builder $visible) use ($user) {
            $any = false;

            if ($user->hasRole(Role::MENTOR)) {
                $visible->orWhere(fn (Builder $q) => $q->where('type', '!=', self::TYPE_INSTITUTION)->where('mentor_id', $user->id));
                $any = true;
            }

            if ($user->hasRole(Role::LEMBAGA)) {
                $visible->orWhere(fn (Builder $q) => $q->where('type', self::TYPE_INSTITUTION)->where('created_by', $user->id));
                $any = true;
            }

            if ($user->hasRole([Role::SISWA, Role::KARYAWAN])) {
                $visible->orWhere(fn (Builder $q) => $q
                    ->where('status', self::STATUS_ACTIVE)
                    ->whereHas('enrollments', fn (Builder $e) => $e->where('user_id', $user->id)->where('status', Enrollment::STATUS_ACTIVE)));
                $any = true;
            }

            if (! $any) {
                $visible->whereRaw('1 = 0');
            }
        });
    }
}
