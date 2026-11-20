<?php

namespace App\Exceptions;

use RuntimeException;

/** XP tidak dapat diubah. "reason" adalah kode alasan yang stabil; pesan siap ditampilkan. */
class XpException extends RuntimeException
{
    public const NOT_STUDENT = 'not_student';
    public const INVALID_AMOUNT = 'invalid_amount';
    public const INVALID_SOURCE = 'invalid_source';
    public const BELOW_ZERO = 'below_zero';
    public const ALREADY_ZERO = 'already_zero';

    public function __construct(public readonly string $reason, string $message)
    {
        parent::__construct($message);
    }
}
