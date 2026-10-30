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
];
