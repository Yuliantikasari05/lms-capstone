<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Data halaman "Manajemen Lembaga Bimbingan" (detail satu lembaga) untuk Admin.
 * Semua angka berasal dari data nyata. Pemasukan baru ada setelah modul pembayaran mencatat transaksi
 * (InstitutionRevenueService::recordSale); sebelum itu semuanya 0.
 */
class InstitutionDashboardService
{
    public const DEFAULT_PERIOD = '3m';

    /** Pilihan rentang waktu di halaman (7 hari, 30 hari, 3 bulan, 6 bulan, 1 tahun). */
    public const PERIODS = [
        '7d' => ['label' => '7 hari', 'bucket' => 'day'],
        '30d' => ['label' => '30 hari', 'bucket' => 'day'],
        '3m' => ['label' => '3 bulan', 'bucket' => 'week'],
        '6m' => ['label' => '6 bulan', 'bucket' => 'month'],
        '1y' => ['label' => '1 tahun', 'bucket' => 'month'],
    ];

    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    public function __construct(private readonly InstitutionRevenueService $revenue = new InstitutionRevenueService) {}

    /** @return array<string,mixed> */
    public function build(Institution $institution, string $period = self::DEFAULT_PERIOD): array
    {
        $period = array_key_exists($period, self::PERIODS) ? $period : self::DEFAULT_PERIOD;
        [$from, $to] = $this->window($period);

        $length = (int) $from->diffInDays($to->copy()->startOfDay()) + 1;
        $previousFrom = $from->copy()->subDays($length);
        $previousTo = $from->copy()->subSecond();

        $current = $this->paid($institution)->whereBetween('paid_at', [$from, $to]);
        $revenueNow = (int) (clone $current)->sum('institution_amount');
        $platformNow = (int) (clone $current)->sum('platform_amount');
        $soldNow = (int) (clone $current)->count();
        $revenuePrevious = (int) $this->paid($institution)->whereBetween('paid_at', [$previousFrom, $previousTo])->sum('institution_amount');

        $balance = $this->revenue->balance($institution);

        return [
            'period' => [
                'key' => $period,
                'label' => self::PERIODS[$period]['label'],
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'cards' => [
                'total_revenue' => [
                    'value' => $revenueNow,
                    'previous' => $revenuePrevious,
                    // null bila periode sebelumnya 0 (tidak ada dasar pembanding).
                    'change_percent' => $revenuePrevious > 0 ? round(($revenueNow - $revenuePrevious) / $revenuePrevious * 100, 1) : null,
                ],
                'content_sold' => ['value' => $soldNow],
                'active_students' => [
                    'value' => $this->activeStudents($institution),
                    'new_in_period' => $this->newStudents($institution, $from, $to),
                ],
                'active_programs' => [
                    'value' => $institution->programs()->where('courses.status', Course::STATUS_ACTIVE)->count(),
                    'released_in_period' => $institution->programs()->whereBetween('courses.created_at', [$from, $to])->count(),
                ],
                'available_balance' => ['value' => $balance['available']],
            ],
            'revenue_chart' => $this->chart($institution, $period, $from, $to),
            'finance' => [
                'revenue_share_percent' => $institution->revenue_share_percent,
                'gross_total' => $balance['gross'],
                'institution_total' => $balance['earned'],
                'platform_total' => $balance['platform'],
                'paid_out_total' => $balance['completed'],
                'pending_payout_total' => $balance['pending'],
                'available_balance' => $balance['available'],
                'can_request_payout' => $institution->hasBankAccount() && $balance['available'] > 0,
                'bank_account' => $institution->bankLabel(),
            ],
            'revenue_split' => [
                'institution_percent' => $institution->revenue_share_percent,
                'platform_percent' => $institution->revenue_share_percent === null ? null : 100 - $institution->revenue_share_percent,
                'institution_amount' => $revenueNow,
                'platform_amount' => $platformNow,
            ],
            'top_programs' => $this->topPrograms($institution, $from, $to),
            'student_progress' => $this->studentProgress($institution),
            'active_vouchers' => $this->activeVouchers($institution),
            'recent_payouts' => $institution->payouts()->orderByDesc('id')->limit(5)->get(),
        ];
    }

    // ------------------------------------------------------------------ rentang waktu

    /** @return array{0: Carbon, 1: Carbon} awal hari pertama, akhir hari ini */
    private function window(string $period): array
    {
        $today = now()->startOfDay();

        $from = match ($period) {
            '7d' => $today->copy()->subDays(6),
            '30d' => $today->copy()->subDays(29),
            '3m' => $today->copy()->subMonthsNoOverflow(3)->addDay(),
            '6m' => $today->copy()->subMonthsNoOverflow(6)->addDay(),
            default => $today->copy()->subMonthsNoOverflow(12)->addDay(),
        };

        return [$from, now()->endOfDay()];
    }

    private function paid(Institution $institution)
    {
        return Transaction::query()->where('institution_id', $institution->id)->paid();
    }

    // ------------------------------------------------------------------ grafik

    /** Pendapatan lembaga dan bagian platform per hari/minggu/bulan; periode tanpa transaksi tetap muncul bernilai 0. */
    private function chart(Institution $institution, string $period, Carbon $from, Carbon $to): array
    {
        $bucket = self::PERIODS[$period]['bucket'];

        /** @var Collection<string, array{key:string,label:string,institution_amount:int,platform_amount:int}> $points */
        $points = collect();
        $cursor = $this->bucketStart($from, $bucket);
        while ($cursor->lessThanOrEqualTo($to)) {
            $key = $this->bucketKey($cursor, $bucket);
            $points[$key] = ['key' => $key, 'label' => $this->bucketLabel($cursor, $bucket), 'institution_amount' => 0, 'platform_amount' => 0];
            $cursor = match ($bucket) {
                'day' => $cursor->copy()->addDay(),
                'week' => $cursor->copy()->addWeek(),
                default => $cursor->copy()->addMonthNoOverflow()->startOfMonth(),
            };
        }

        $this->paid($institution)
            ->whereBetween('paid_at', [$from, $to])
            ->get(['paid_at', 'institution_amount', 'platform_amount'])
            ->each(function (Transaction $row) use ($points, $bucket) {
                $key = $this->bucketKey($this->bucketStart($row->paid_at, $bucket), $bucket);
                if ($points->has($key)) {
                    $point = $points[$key];
                    $point['institution_amount'] += $row->institution_amount;
                    $point['platform_amount'] += $row->platform_amount;
                    $points[$key] = $point;
                }
            });

        return ['bucket' => $bucket, 'points' => $points->values()->all()];
    }

    private function bucketStart(Carbon $date, string $bucket): Carbon
    {
        return match ($bucket) {
            'day' => $date->copy()->startOfDay(),
            'week' => $date->copy()->startOfWeek(),
            default => $date->copy()->startOfMonth(),
        };
    }

    private function bucketKey(Carbon $start, string $bucket): string
    {
        return $bucket === 'month' ? $start->format('Y-m') : $start->format('Y-m-d');
    }

    private function bucketLabel(Carbon $start, string $bucket): string
    {
        $month = self::MONTHS[$start->month - 1];

        return $bucket === 'month' ? "{$month} {$start->year}" : "{$start->day} {$month}";
    }

    // ------------------------------------------------------------------ siswa dan program

    private function enrollments(Institution $institution)
    {
        return Enrollment::query()
            ->where('enrollments.status', Enrollment::STATUS_ACTIVE)
            ->whereIn('enrollments.course_id', $institution->programs()->select('courses.id'));
    }

    private function activeStudents(Institution $institution): int
    {
        return (int) $this->enrollments($institution)->distinct()->count('enrollments.user_id');
    }

    private function newStudents(Institution $institution, Carbon $from, Carbon $to): int
    {
        return (int) $this->enrollments($institution)->whereBetween('enrollments.enrolled_at', [$from, $to])->distinct()->count('enrollments.user_id');
    }

    /** "Top Konten Terlaris": program dengan penjualan terbanyak pada periode terpilih. */
    private function topPrograms(Institution $institution, Carbon $from, Carbon $to): array
    {
        $rows = $this->paid($institution)
            ->whereNotNull('course_id')
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('course_id, count(*) as sold, sum(institution_amount) as revenue')
            ->groupBy('course_id')
            ->orderByDesc('sold')
            ->orderBy('course_id')
            ->limit(5)
            ->get();

        $courses = Course::withTrashed()->whereIn('id', $rows->pluck('course_id'))->get()->keyBy('id');

        return $rows->values()->map(fn ($row, int $index) => [
            'rank' => $index + 1,
            'course' => ['id' => (int) $row->course_id, 'title' => $courses[$row->course_id]->title ?? '-'],
            'sold' => (int) $row->sold,
            'revenue' => (int) $row->revenue,
            'status' => $courses[$row->course_id]->status ?? null,
            'status_label' => isset($courses[$row->course_id]) ? $courses[$row->course_id]->statusLabel() : null,
        ])->all();
    }

    /**
     * "Perkembangan Siswa". Pencatatan progres materi belum ada di sistem, sehingga progress_percent
     * sengaja null (bukan angka karangan) sampai modul progres dibangun.
     */
    private function studentProgress(Institution $institution): array
    {
        return $this->enrollments($institution)
            ->with(['user', 'course'])
            ->orderByDesc('enrollments.enrolled_at')
            ->orderByDesc('enrollments.id')
            ->limit(6)
            ->get()
            ->map(fn (Enrollment $e) => [
                'user' => ['id' => $e->user_id, 'name' => $e->user?->name],
                'program' => ['id' => $e->course_id, 'title' => $e->course?->title],
                'enrolled_at' => $e->enrolled_at?->toIso8601String(),
                'progress_percent' => null,
            ])->all();
    }

    /** "Voucher Aktif": voucher milik lembaga yang masih berlaku (maksimal 3 untuk kartu, total di "total"). */
    private function activeVouchers(Institution $institution): array
    {
        $query = $institution->vouchers()->withStatus(Coupon::STATUS_ACTIVE);

        return [
            'total' => (clone $query)->count(),
            'items' => (clone $query)->withCount('redemptions')->orderByDesc('coupons.id')->limit(3)->get()
                ->map(fn (Coupon $c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => $c->name,
                    'discount_label' => $c->discountLabel(),
                    'usage_label' => $c->usedCount().'/'.($c->usage_limit ?? '∞'),
                    'expires_at' => $c->expires_at?->toIso8601String(),
                ])->all(),
        ];
    }
}
