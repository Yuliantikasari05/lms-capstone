<?php

namespace App\Services;

use App\Exceptions\XpException;
use App\Models\Role;
use App\Models\User;
use App\Models\XpBalance;
use App\Models\XpTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya pintu untuk mengubah XP. Buku besar (xp_transactions) dan saldo (xp_balances)
 * selalu berubah bersama dalam satu transaksi dengan kunci baris, sehingga saldo = jumlah buku besar.
 *
 * - award(): XP dari aktivitas belajar (materi, tugas, ujian). Idempoten per (Siswa, sumber).
 *   Dipanggil modul progres/tugas pada tahap berikutnya.
 * - adjust()/reset(): koreksi oleh Admin (alasan wajib). Riwayat tidak pernah diubah: koreksi = baris baru.
 */
class XpService
{
    public const SOURCE_MATERIAL = 'material';
    public const SOURCE_TASK = 'task';
    public const SOURCE_EXAM = 'exam';
    public const SOURCE_ADJUSTMENT = 'adjustment';
    public const SOURCE_RESET = 'reset';

    public const AWARD_SOURCES = [self::SOURCE_MATERIAL, self::SOURCE_TASK, self::SOURCE_EXAM];

    /**
     * Memberi XP dari aktivitas belajar.
     *
     * @return XpTransaction|null null bila sumber yang sama sudah pernah memberi XP kepada Siswa ini
     *
     * @throws XpException
     */
    public function award(User $student, int $amount, string $sourceType, int $sourceId, ?string $reason = null): ?XpTransaction
    {
        $this->assertStudent($student);

        if ($amount <= 0) {
            throw new XpException(XpException::INVALID_AMOUNT, 'XP yang diberikan harus lebih dari 0.');
        }
        if (! in_array($sourceType, self::AWARD_SOURCES, true)) {
            throw new XpException(XpException::INVALID_SOURCE, 'Sumber XP tidak valid.');
        }

        $alreadyGiven = XpTransaction::query()
            ->where('user_id', $student->id)->where('source_type', $sourceType)->where('source_id', $sourceId)->exists();
        if ($alreadyGiven) {
            return null;
        }

        try {
            return $this->record($student, $amount, $sourceType, $sourceId, $reason, null);
        } catch (QueryException $e) {
            // Dua proses memberi XP dari sumber yang sama bersamaan: batasan unik memastikan hanya satu yang tercatat.
            if ($this->isUniqueViolation($e)) {
                return null;
            }

            throw $e;
        }
    }

    /**
     * Koreksi XP oleh Admin (positif menambah, negatif mengurangi). Saldo tidak boleh menjadi negatif.
     *
     * @throws XpException
     */
    public function adjust(User $student, int $delta, string $reason, User $by): XpTransaction
    {
        $this->assertStudent($student);

        if ($delta === 0) {
            throw new XpException(XpException::INVALID_AMOUNT, 'Jumlah koreksi tidak boleh 0.');
        }

        return $this->record($student, $delta, self::SOURCE_ADJUSTMENT, null, $reason, $by);
    }

    /**
     * Mengembalikan XP Siswa ke 0 dengan satu entri koreksi (riwayat tetap utuh).
     *
     * @throws XpException
     */
    public function reset(User $student, string $reason, User $by): XpTransaction
    {
        $this->assertStudent($student);

        return DB::transaction(function () use ($student, $reason, $by) {
            $balance = $this->lockedBalance($student);

            if ($balance->total_xp === 0) {
                throw new XpException(XpException::ALREADY_ZERO, 'XP Siswa ini sudah 0.');
            }

            return $this->write($student, $balance, -$balance->total_xp, self::SOURCE_RESET, null, $reason, $by);
        });
    }

    public function balanceOf(User $student): int
    {
        return (int) XpBalance::query()->where('user_id', $student->id)->value('total_xp');
    }

    // ------------------------------------------------------------------ internal

    private function record(User $student, int $delta, string $type, ?int $sourceId, ?string $reason, ?User $by): XpTransaction
    {
        return DB::transaction(function () use ($student, $delta, $type, $sourceId, $reason, $by) {
            return $this->write($student, $this->lockedBalance($student), $delta, $type, $sourceId, $reason, $by);
        });
    }

    private function write(User $student, XpBalance $balance, int $delta, string $type, ?int $sourceId, ?string $reason, ?User $by): XpTransaction
    {
        $new = $balance->total_xp + $delta;
        if ($new < 0) {
            throw new XpException(XpException::BELOW_ZERO, 'XP tidak boleh menjadi negatif (saldo saat ini '.$balance->total_xp.').');
        }

        $transaction = new XpTransaction(['amount' => $delta, 'source_type' => $type, 'source_id' => $sourceId, 'reason' => $reason]);
        $transaction->user_id = $student->id;
        $transaction->created_by = $by?->id;
        $transaction->save();

        $balance->total_xp = $new;
        $balance->save();

        return $transaction;
    }

    /** Menjamin baris saldo ada, lalu menguncinya sampai transaksi selesai (mencegah balapan antar proses). */
    private function lockedBalance(User $student): XpBalance
    {
        XpBalance::query()->insertOrIgnore(['user_id' => $student->id, 'total_xp' => 0]);

        return XpBalance::query()->where('user_id', $student->id)->lockForUpdate()->firstOrFail();
    }

    private function assertStudent(User $student): void
    {
        if (! $student->hasRole(Role::SISWA) || $student->trashed()) {
            throw new XpException(XpException::NOT_STUDENT, 'Hanya Siswa yang dapat memiliki XP.');
        }
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return in_array((string) $e->getCode(), ['23505', '23000'], true) && stripos($e->getMessage(), 'unique') !== false;
    }
}
