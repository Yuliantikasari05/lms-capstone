<?php

namespace App\Support;

/**
 * Pola LIKE aman: karakter % dan _ dari pengguna diperlakukan sebagai teks biasa, bukan wildcard.
 * Pakai bersama klausa:  whereRaw("lower(kolom) like ? escape '!'", [Like::contains($kata)])
 */
final class Like
{
    public static function contains(string $term): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($term)).'%';
    }
}
