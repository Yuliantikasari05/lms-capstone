<?php

namespace Database\Factories;

use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Transaksi untuk test. Untuk logika bagi hasil yang sebenarnya pakai InstitutionRevenueService::recordSale();
 * factory ini menulis angka apa adanya (institution_amount dan platform_amount diisi lewat state).
 *
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        return [
            'reference' => 'TRX-'.fake()->unique()->numerify('########'),
            'gross_amount' => 100000,
            'discount_amount' => 0,
            'net_amount' => 100000,
            'institution_share_percent' => 80,
            'institution_amount' => 80000,
            'platform_amount' => 20000,
            'status' => Transaction::STATUS_PAID,
            'paid_at' => now(),
        ];
    }

    /** Menetapkan nominal bersih yang dibayar pembeli dengan bagi hasil persen tertentu. */
    public function amount(int $net, int $sharePercent = 80): static
    {
        $institution = intdiv($net * $sharePercent, 100);

        return $this->state([
            'gross_amount' => $net, 'discount_amount' => 0, 'net_amount' => $net,
            'institution_share_percent' => $sharePercent, 'institution_amount' => $institution, 'platform_amount' => $net - $institution,
        ]);
    }

    public function refunded(): static
    {
        return $this->state(['status' => Transaction::STATUS_REFUNDED]);
    }

    public function paidAt($when): static
    {
        return $this->state(['paid_at' => $when]);
    }
}
