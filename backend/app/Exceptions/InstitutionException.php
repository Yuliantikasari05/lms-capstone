<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Aturan keuangan/pencairan Lembaga yang dilanggar. "reason" adalah kode stabil untuk pemanggil
 * (mis. modul pembayaran); pesannya siap ditampilkan ke Admin.
 */
class InstitutionException extends RuntimeException
{
    public const SHARE_NOT_SET = 'share_not_set';
    public const INVALID_AMOUNT = 'invalid_amount';
    public const INSUFFICIENT_BALANCE = 'insufficient_balance';
    public const BANK_NOT_SET = 'bank_not_set';
    public const INVALID_STATE = 'invalid_state';
    public const NOTHING_TO_PAY_OUT = 'nothing_to_pay_out';

    public function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }
}
