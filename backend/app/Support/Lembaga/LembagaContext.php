<?php

namespace App\Support\Lembaga;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * Konteks Lembaga Bimbingan untuk endpoint swa-layan role Lembaga.
 *
 * Semua data selalu diambil dari KEPEMILIKAN akun yang sedang login: profil lembaga lewat user_id
 * dan program lewat created_by + jenis "institution". Tidak ada id lembaga yang datang dari klien,
 * sehingga satu lembaga tidak mungkin membaca atau mengubah data lembaga lain.
 */
final class LembagaContext
{
    /** Profil lembaga milik akun yang login (404 bila belum punya profil). */
    public static function institution(User $user): Institution
    {
        $institution = Institution::query()->where('user_id', $user->id)->first();

        abort_if($institution === null, 404, 'Profil lembaga tidak ditemukan.');

        return $institution;
    }

    /** Query program milik lembaga ini, lengkap dengan ringkasan yang dipakai kartu dan laporan. */
    public static function programsQuery(User $user): Builder
    {
        return Course::query()
            ->where('courses.type', Course::TYPE_INSTITUTION)
            ->where('courses.created_by', $user->id)
            ->withCount(['modules', 'sessions', 'activeEnrollments as participants_count'])
            ->withCount(['transactions as sold_count' => fn (Builder $q) => $q->where('transactions.status', Transaction::STATUS_PAID)])
            ->withSum(['transactions as revenue' => fn (Builder $q) => $q->where('transactions.status', Transaction::STATUS_PAID)], 'institution_amount');
    }

    /** Program milik lembaga ini; 404 untuk program lembaga lain atau kursus biasa. */
    public static function program(User $user, Course $course): Course
    {
        abort_unless($course->isInstitutionProgram() && $course->created_by === $user->id, 404, 'Program lembaga tidak ditemukan.');

        return $course;
    }

    /** @return array<int,int> */
    public static function programIds(User $user): array
    {
        return Course::query()
            ->where('type', Course::TYPE_INSTITUTION)
            ->where('created_by', $user->id)
            ->pluck('id')
            ->all();
    }

    /**
     * Siswa yang punya pendaftaran aktif pada salah satu program lembaga ini.
     *
     * @param  array<int,int>  $programIds
     */
    public static function studentsQuery(array $programIds): Builder
    {
        return User::query()
            ->whereHas('enrollments', fn (Builder $q) => $q
                ->whereIn('course_id', $programIds)
                ->where('status', Enrollment::STATUS_ACTIVE))
            ->with(['enrollments' => fn ($q) => $q
                ->whereIn('course_id', $programIds)
                ->where('status', Enrollment::STATUS_ACTIVE)
                ->with('course:id,title')
                ->orderBy('enrolled_at')]);
    }

    /**
     * Ringkasan angka seluruh program lembaga (seluruh waktu).
     *
     * @return array{active_programs:int,total_students:int,total_enrollments:int,total_revenue:int,active_vouchers:int,used_vouchers:int}
     */
    public static function summary(User $user): array
    {
        $programIds = self::programIds($user);

        $enrollments = Enrollment::query()
            ->whereIn('course_id', $programIds)
            ->where('status', Enrollment::STATUS_ACTIVE);

        $vouchers = \App\Models\Coupon::query()
            ->where('owner_type', \App\Models\Coupon::OWNER_INSTITUTION)
            ->where('owner_id', $user->id);

        return [
            'active_programs' => Course::query()
                ->whereIn('id', $programIds)
                ->where('status', Course::STATUS_ACTIVE)
                ->count(),
            'total_students' => (clone $enrollments)->distinct()->count('user_id'),
            'total_enrollments' => $enrollments->count(),
            'total_revenue' => (int) Transaction::query()
                ->whereIn('course_id', $programIds)
                ->where('status', Transaction::STATUS_PAID)
                ->sum('institution_amount'),
            'active_vouchers' => (clone $vouchers)->where('is_active', true)->count(),
            'used_vouchers' => (int) \App\Models\CouponRedemption::query()
                ->whereIn('coupon_id', (clone $vouchers)->select('id'))
                ->count(),
        ];
    }

    /** @param  EloquentCollection<int,\App\Models\Coupon>  $vouchers */
    public static function voucherMetrics(EloquentCollection $vouchers): array
    {
        $now = now();

        return [
            'active_total' => $vouchers->filter(fn ($v) => $v->status() === \App\Models\Coupon::STATUS_ACTIVE)->count(),
            'used_total' => $vouchers->sum(fn ($v) => $v->usedCount()),
            'expiring_soon' => $vouchers->filter(fn ($v) => $v->is_active
                && $v->expires_at !== null
                && $v->expires_at->greaterThan($now)
                && $v->expires_at->lessThanOrEqualTo($now->copy()->addDays(30)))->count(),
        ];
    }
}
