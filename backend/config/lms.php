<?php

return [
    // Dibaca dari .env hanya oleh AdminSeeder. Jangan commit nilai asli.
    'admin' => [
        'name' => env('ADMIN_NAME', 'Administrator'),
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],

    // Dibaca hanya oleh DemoUserSeeder (khusus lingkungan local). Kosong = dibuat acak lalu ditampilkan sekali.
    'demo_password' => env('DEMO_USER_PASSWORD'),

    // File materi kursus. Disk privat (bukan URL publik); unduhan lewat endpoint berizin.
    'uploads' => [
        'disk' => env('LMS_UPLOAD_DISK', 'local'),
        // Batas ukuran per file dalam KB (51200 = 50 MB). Server (php.ini, Nginx, Cloudflare) harus mengizinkan ukuran ini.
        'max_kb' => (int) env('LMS_UPLOAD_MAX_KB', 51200),
    ],
];
