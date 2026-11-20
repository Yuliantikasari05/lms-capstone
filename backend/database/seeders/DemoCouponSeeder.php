<?php

namespace Database\Seeders;

use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Course;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Kupon contoh untuk development (mengisi halaman Manajemen Kupon: ringkasan, semua status, dan penggunaan).
 *
 * Jalankan manual:   php artisan db:seed --class=DemoCouponSeeder
 * (disarankan setelah DemoUserSeeder dan DemoCourseSeeder agar ada pemakai dan kursus contoh)
 * Sengaja TIDAK dimasukkan ke DatabaseSeeder agar `db:seed` biasa tidak pernah membuat data demo.
 *
 * - Hanya berjalan di lingkungan local/testing.
 * - Aman dijalankan berulang: kupon dicocokkan lewat kode, pemakaian lewat reference unik.
 * - Hapus semua kupon demo:  Coupon::withTrashed()->where('code', 'like', 'DEMO%')->get()->each->forceDelete();
 *   (hapus dulu CouponRedemption-nya bila ada)
 */
class DemoCouponSeeder extends Seeder
{
    /** @return array<int, array<string,mixed>> */
    private static function definitions(): array
    {
        return [
            ['code' => 'DEMO_SPECIAL_50', 'name' => 'Promo Spesial 50%', 'type' => Coupon::TYPE_PERCENTAGE, 'value' => 50, 'limit' => 1000, 'uses' => 4],
            ['code' => 'DEMO_MANUAL_10', 'name' => 'Diskon Manual 10%', 'type' => Coupon::TYPE_PERCENTAGE, 'value' => 10, 'limit' => 500, 'uses' => 2],
            ['code' => 'DEMOKAMISHEMAT', 'name' => 'Kamis Hemat', 'type' => Coupon::TYPE_FIXED, 'value' => 50000, 'limit' => 200, 'uses' => 1],
            ['code' => 'DEMOUTBK10', 'name' => 'Promo Harga Kelas Materi UTBK', 'type' => Coupon::TYPE_PERCENTAGE, 'value' => 10, 'limit' => null, 'uses' => 0, 'course' => true],
            ['code' => 'DEMOTANPABATAS', 'name' => 'Tanpa Batas Pemakaian', 'type' => Coupon::TYPE_FIXED, 'value' => 25000, 'limit' => null, 'uses' => 3],
            ['code' => 'DEMOMATI', 'name' => 'Kupon Dinonaktifkan', 'type' => Coupon::TYPE_PERCENTAGE, 'value' => 20, 'limit' => 100, 'uses' => 0, 'inactive' => true],
            ['code' => 'DEMOLEWAT', 'name' => 'Promo Akhir Tahun Lalu', 'type' => Coupon::TYPE_PERCENTAGE, 'value' => 30, 'limit' => 100, 'uses' => 1, 'expired' => true],
            ['code' => 'DEMOPENUH', 'name' => 'Kuota Terbatas', 'type' => Coupon::TYPE_FIXED, 'value' => 100000, 'limit' => 2, 'uses' => 2],
        ];
    }

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->command?->error('DemoCouponSeeder hanya boleh dijalankan di lingkungan local. Dibatalkan.');

            return;
        }

        $admin = User::query()->whereHas('roles', fn ($q) => $q->where('slug', Role::ADMIN))->oldest('id')->first();
        $students = User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', Role::SISWA))
            ->where('status', User::STATUS_ACTIVE)->orderBy('id')->get();
        $course = Course::query()->whereIn('type', [Course::TYPE_ACADEMIC, Course::TYPE_INSTITUTION])->oldest('id')->first();

        foreach (self::definitions() as $def) {
            $coupon = Coupon::query()->withTrashed()->where('code', $def['code'])->first() ?? new Coupon;

            $coupon->fill([
                'code' => $def['code'],
                'name' => $def['name'],
                'discount_type' => $def['type'],
                'discount_value' => $def['value'],
                'usage_limit' => $def['limit'],
                'course_id' => ($def['course'] ?? false) ? $course?->id : null,
                'expires_at' => ($def['expired'] ?? false) ? now()->subDays(5) : now()->addMonths(3),
                'is_active' => ! ($def['inactive'] ?? false),
            ]);
            $coupon->owner_type = Coupon::OWNER_ADMIN;
            $coupon->created_by = $admin?->id;
            $coupon->deleted_at = null;
            $coupon->save();

            $this->seedRedemptions($coupon, (int) $def['uses'], $students);
        }

        $this->command?->info(count(self::definitions()).' kupon demo siap.');
        if ($students->isEmpty()) {
            $this->command?->warn('Belum ada Siswa demo, jadi pemakaian kupon tidak dibuat. Jalankan DemoUserSeeder lalu ulangi.');
        }
    }

    /** @param \Illuminate\Support\Collection<int, User> $students */
    private function seedRedemptions(Coupon $coupon, int $count, $students): void
    {
        if ($students->isEmpty()) {
            return;
        }

        for ($i = 1; $i <= $count; $i++) {
            $reference = "demo-{$coupon->code}-{$i}";
            if (CouponRedemption::query()->where('reference', $reference)->exists()) {
                continue;
            }

            $amount = 200_000;
            $redemption = new CouponRedemption([
                'reference' => $reference,
                'original_amount' => $amount,
                'discount_amount' => $coupon->discountFor($amount),
            ]);
            $redemption->coupon_id = $coupon->id;
            $redemption->user_id = $students[($i - 1) % $students->count()]->id;
            $redemption->save();
        }
    }
}
