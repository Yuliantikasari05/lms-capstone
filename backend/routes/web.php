<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'name' => config('app.name'),
    'message' => 'Ini adalah backend API. Gunakan /api/v1/health untuk memeriksa status.',
]));
