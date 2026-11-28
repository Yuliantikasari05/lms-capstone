<?php

namespace Database\Seeders;

use App\Exceptions\InstitutionException;
use App\Models\ClassSession;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Material;
use App\Models\Role;
use App\Models\User;
use App\Services\InstitutionPayoutService;
use App\Services\InstitutionRevenueService;
use Illuminate\Database\Seeder;

/**
 * Data contoh untuk halaman Manajemen Lembaga Bimbingan (profil, program, siswa, penjualan, voucher, pencairan).
 *
 * Jalankan manual:   php artisan db:seed --class=DemoInstitutionSeeder
 * Syarat: RolePermissionSeeder dan DemoUserSeeder sudah dijalankan (akun Lembaga dan Siswa demo),
 * serta ada satu akun Admin (php artisan lms:create-admin) untuk mencatat pencairan contoh.
 * Sengaja TIDAK dimasukkan ke DatabaseSeeder agar `db:seed` biasa tidak pernah membuat data demo.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Aman dijalankan berulang: profil dicocokkan lewat akun, program lewat judul, penjualan lewat reference,
 *   voucher lewat kode; pencairan contoh hanya dibuat bila lembaga belum punya pencairan.
 * - Nomor rekening di bawah hanya contoh (bukan rekening sungguhan).
 */
class DemoInstitutionSeeder extends Seeder
{
    /** Akun Lembaga hasil DemoUserSeeder (1 akun = 1 lembaga). */
    private const INSTITUTIONS = [
        'bimbel.cerdas' => [
            'name' => 'Bimbel Cerdas Mandiri', 'share' => 80, 'phone' => '0274-555-0101', 'address' => 'Jl. Kaliurang Km 5, Sleman, Yogyakarta',
            'description' => 'Bimbingan belajar persiapan UTBK dan ujian sekolah.',
            'bank' => ['BCA', 'Bimbel Cerdas Mandiri', '8830127810'],
            'programs' => [['Matematika Intensif UTBK', 350_000], ['IPA Terpadu SMA', 280_000], ['Bahasa Indonesia Lengkap', 150_000]],
            'vouchers' => [['DEMOCERDAS10', 'Diskon Siswa Baru', Coupon::TYPE_PERCENTAGE, 10, 100], ['DEMOCERDAS25RB', 'Potongan Rp 25.000', Coupon::TYPE_FIXED, 25_000, null]],
            'students' => 9,
        ],
        'prima.edukasi' => [
            'name' => 'Lembaga Prima Edukasi', 'share' => 75, 'phone' => '0274-555-0202', 'address' => 'Jl. Magelang Km 3, Yogyakarta',
            'description' => 'Kelas bahasa dan persiapan tes masuk perguruan tinggi.',
            'bank' => ['Mandiri', 'Prima Edukasi', '1370045521'],
            'programs' => [['English for TOEFL', 400_000], ['Kimia Dasar', 220_000]],
            'vouchers' => [['DEMOPRIMA15', 'Promo Prima', Coupon::TYPE_PERCENTAGE, 15, 50]],
            'students' => 6,
        ],
        'bimbel.nusantara' => [
            'name' => 'Bimbel Nusantara', 'share' => 70, 'phone' => null, 'address' => null,
            'description' => null,
            'bank' => null,
            'programs' => [['Fisika Modern', 300_000]],
            'vouchers' => [],
            'students' => 2,
        ],
    ];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoInstitutionSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $accounts = User::query()
            ->whereIn('email', array_map(fn (string $local) => "{$local}@".DemoUserSeeder::DOMAIN, array_keys(self::INSTITUTIONS)))
            ->get()->keyBy(fn (User $u) => explode('@', $u->email)[0]);

        $students = User::query()
            ->where('email', 'like', '%@'.DemoUserSeeder::DOMAIN)
            ->where('status', User::STATUS_ACTIVE)
            ->whereHas('roles', fn ($q) => $q->where('slug', Role::SISWA))
            ->orderBy('id')->get();

        if ($accounts->count() < count(self::INSTITUTIONS) || $students->isEmpty()) {
            $this->command?->error('Butuh akun Lembaga dan Siswa demo. Jalankan `db:seed --class=DemoUserSeeder` dulu. Dibatalkan.');

            return;
        }

        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('slug', Role::ADMIN))->orderBy('id')->first();
        $revenue = new InstitutionRevenueService;
        $payouts = new InstitutionPayoutService($revenue);
        $sales = 0;

        foreach (self::INSTITUTIONS as $local => $spec) {
            $account = $accounts[$local];
            $institution = $this->institution($account, $spec, $admin);
            $programs = $this->programs($account, $spec['programs']);

            $this->vouchers($account, $spec['vouchers']);
            $sales += $this->sell($institution, $programs, $spec['programs'], $students->take($spec['students']), $revenue);

            if ($admin !== null) {
                $this->payouts($institution, $admin, $revenue, $payouts);
            }
        }

        $this->command?->info(count(self::INSTITUTIONS).' lembaga demo siap ('.$sales.' penjualan baru).');
        if ($admin === null) {
            $this->command?->warn('Belum ada akun Admin, jadi riwayat pencairan contoh tidak dibuat. Jalankan `php artisan lms:create-admin` lalu ulangi seeder ini.');
        }
    }

    /** @param  array<string,mixed>  $spec */
    private function institution(User $account, array $spec, ?User $admin): Institution
    {
        $institution = Institution::withTrashed()->firstOrNew(['user_id' => $account->id]);
        $institution->fill([
            'name' => $spec['name'], 'description' => $spec['description'], 'phone' => $spec['phone'], 'address' => $spec['address'],
            'revenue_share_percent' => $spec['share'],
            'bank_name' => $spec['bank'][0] ?? null, 'bank_account_holder' => $spec['bank'][1] ?? null, 'bank_account_number' => $spec['bank'][2] ?? null,
        ]);
        $institution->created_by ??= $admin?->id;
        $institution->deleted_at = null;
        $institution->save();

        return $institution;
    }

    /**
     * @param  array<int, array{0:string,1:int}>  $definitions
     * @return array<int, Course>
     */
    private function programs(User $account, array $definitions): array
    {
        $courses = [];
        foreach ($definitions as $i => [$title, $price]) {
            $course = Course::withTrashed()->firstOrNew(['type' => Course::TYPE_INSTITUTION, 'created_by' => $account->id, 'title' => $title]);
            $course->fill(['description' => "Program {$title} dari lembaga demo.", 'status' => Course::STATUS_ACTIVE, 'category' => 'akademik']);
            $course->type = Course::TYPE_INSTITUTION;
            $course->created_by = $account->id;
            $course->mentor_id = null;
            $course->deleted_at = null;

            // Harga hanya diisi saat program baru dibuat agar perubahan harga oleh lembaga tidak tertimpa saat seeder diulang.
            if (! $course->exists || (int) $course->price === 0) {
                $course->price = $price;
                // Program pertama diberi harga promo contoh (15% lebih murah).
                $course->discount_price = $i === 0 ? intdiv($price * 85, 100) : null;
            }

            $course->save();
            $this->curriculum($course, $title);
            $courses[$i] = $course;
        }

        return $courses;
    }

    /** Dua modul + materi tautan + satu sesi pembuka, agar halaman Kelola Modul dan jadwal berisi data. */
    private function curriculum(Course $course, string $title): void
    {
        foreach (["Pengantar {$title}", "Latihan dan Evaluasi {$title}"] as $position => $moduleTitle) {
            $module = CourseModule::withTrashed()->firstOrNew(['course_id' => $course->id, 'title' => $moduleTitle]);
            $module->position = $position;
            $module->deleted_at = null;
            $module->save();

            $material = Material::withTrashed()->firstOrNew(['course_module_id' => $module->id, 'title' => "Materi {$moduleTitle}"]);
            $material->fill([
                'type' => Material::TYPE_LINK,
                'external_url' => 'https://contoh.test/materi/'.str($moduleTitle)->slug(),
                'position' => 0,
                'xp_points' => 0,
            ]);
            $material->deleted_at = null;
            $material->save();
        }

        $session = ClassSession::withTrashed()->firstOrNew(['course_id' => $course->id, 'title' => "Sesi Pembuka: {$title}"]);
        $session->fill([
            'description' => 'Sesi perkenalan program dan tanya jawab bersama pengajar lembaga.',
            'starts_at' => now()->addDays(7)->setTime(19, 0),
            'ends_at' => now()->addDays(7)->setTime(20, 30),
            'mode' => ClassSession::MODE_ONLINE,
            'meeting_url' => 'https://meet.google.com/hbk-givp-vaz',
            'status' => ClassSession::STATUS_SCHEDULED,
        ]);
        $session->deleted_at = null;
        $session->save();
    }

    /** @param  array<int, array{0:string,1:string,2:string,3:int,4:int|null}>  $vouchers */
    private function vouchers(User $account, array $vouchers): void
    {
        foreach ($vouchers as [$code, $name, $type, $value, $limit]) {
            $coupon = Coupon::withTrashed()->firstOrNew(['code' => $code]);
            $coupon->fill(['name' => $name, 'discount_type' => $type, 'discount_value' => $value, 'usage_limit' => $limit, 'is_active' => true]);
            $coupon->owner_type = Coupon::OWNER_INSTITUTION;
            $coupon->owner_id = $account->id;
            $coupon->deleted_at = null;
            $coupon->save();
        }
    }

    /**
     * Siswa membeli program (enrollment sumber "purchase") dan transaksinya dicatat lewat layanan yang
     * sama dengan modul pembayaran nanti. Tanggal tersebar beberapa bulan agar grafik terisi.
     *
     * @param  array<int, Course>  $courses
     * @param  array<int, array{0:string,1:int}>  $definitions
     * @param  \Illuminate\Support\Collection<int, User>  $students
     */
    private function sell(Institution $institution, array $courses, array $definitions, $students, InstitutionRevenueService $revenue): int
    {
        $created = 0;
        $n = 0;

        foreach ($students->values() as $s => $student) {
            foreach ($courses as $c => $course) {
                // Tidak semua siswa membeli semua program.
                if (($s + $c) % 2 === 1 && $c > 0) {
                    continue;
                }

                $when = now()->subDays(4 + (($s * 23 + $c * 41) % 210))->setTime(9 + ($n % 8), ($n * 7) % 60);
                $n++;

                $enrollment = Enrollment::firstOrNew(['course_id' => $course->id, 'user_id' => $student->id]);
                if (! $enrollment->exists) {
                    $enrollment->forceFill(['status' => Enrollment::STATUS_ACTIVE, 'source' => Enrollment::SOURCE_PURCHASE, 'enrolled_at' => $when]);
                    $enrollment->save();
                }

                $price = $definitions[$c][1];
                $discount = $n % 4 === 0 ? intdiv($price, 10) : 0; // sebagian memakai diskon 10%
                $reference = "DEMO-{$institution->id}-{$course->id}-{$student->id}";
                $exists = \App\Models\Transaction::where('reference', $reference)->exists();

                try {
                    $revenue->recordSale($institution, $student, $price, $discount, $course, null, $reference, $when);
                } catch (InstitutionException $e) {
                    $this->command?->warn("Penjualan dilewati: {$e->getMessage()}");

                    continue;
                }

                $created += $exists ? 0 : 1;
            }
        }

        return $created;
    }

    /** Satu pencairan selesai dan satu menunggu, hanya bila lembaga belum punya pencairan. */
    private function payouts(Institution $institution, User $admin, InstitutionRevenueService $revenue, InstitutionPayoutService $payouts): void
    {
        if (InstitutionPayout::where('institution_id', $institution->id)->exists() || ! $institution->hasBankAccount()) {
            return;
        }

        $available = $revenue->balance($institution)['available'];
        if ($available < 100_000) {
            return;
        }

        $done = $payouts->request($institution, intdiv($available * 4, 10), 'Pencairan contoh (demo)', $admin);
        $payouts->complete($done, $admin);
        $done->forceFill(['created_at' => now()->subDays(20), 'processed_at' => now()->subDays(18)])->save();

        $payouts->request($institution, intdiv($available, 10), 'Pencairan contoh menunggu (demo)', $admin);
    }
}
