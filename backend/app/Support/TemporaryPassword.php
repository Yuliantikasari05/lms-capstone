<?php

namespace App\Support;

/**
 * Pembuat kata sandi sementara yang aman: acak kriptografis (random_int), tanpa karakter yang mirip
 * (I, l, O, 0, 1), dan dijamin memuat huruf besar, huruf kecil, dan angka (memenuhi aturan min. 12 + huruf + angka).
 */
final class TemporaryPassword
{
    private const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    private const LOWER = 'abcdefghijkmnpqrstuvwxyz';
    private const DIGITS = '23456789';

    public static function generate(int $length = 14): string
    {
        $length = max(12, $length);
        $all = self::UPPER.self::LOWER.self::DIGITS;

        $chars = [self::pick(self::UPPER), self::pick(self::LOWER), self::pick(self::DIGITS)];
        while (count($chars) < $length) {
            $chars[] = self::pick($all);
        }

        // Acak urutan (Fisher-Yates) agar karakter wajib tidak selalu di depan.
        for ($i = count($chars) - 1; $i > 0; $i--) {
            $j = random_int(0, $i);
            [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
        }

        return implode('', $chars);
    }

    private static function pick(string $set): string
    {
        return $set[random_int(0, strlen($set) - 1)];
    }
}
