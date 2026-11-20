<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Kupon tidak dapat dipakai. "reason" berisi kode alasan yang stabil untuk dipakai pemanggil
 * (mis. modul pembayaran), sedangkan pesan siap ditampilkan ke pengguna.
 */
class CouponException extends RuntimeException
{
    public const NOT_FOUND = 'not_found';
    public const INACTIVE = 'inactive';
    public const EXPIRED = 'expired';
    public const EXHAUSTED = 'exhausted';
    public const WRONG_COURSE = 'wrong_course';
    public const INVALID_AMOUNT = 'invalid_amount';

    public function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }
}
