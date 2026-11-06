# Standar REST API

Aturan yang sudah dipakai di seluruh API dan dijaga otomatis oleh `backend/tests/Feature/RestConventionsTest.php`. Endpoint baru wajib mengikutinya.

## URL dan metode

- URL berupa **kata benda** huruf kecil dengan tanda hubung (`/courses`, `/enrollment-candidates`). Jangan memakai kata kerja (`/getCourses`, `/createUser`); aksinya dinyatakan oleh metode HTTP.
- Bagian dalam sebuah resource ditulis bersarang: `/courses/{course}/modules`. Bila resource sudah punya id sendiri, boleh diakses langsung: `/modules/{module}`.
- Metode:

| Metode | Dipakai untuk | Kode sukses |
|---|---|---|
| GET | Membaca (tidak mengubah data) | 200 |
| POST | Membuat resource baru | 201 |
| PATCH | Mengubah **sebagian** field | 200 |
| PUT | **Mengganti** seluruh resource atau sub-resource (mis. `PUT /courses/{course}/mentor`, `PUT /modules/order`) | 200 |
| DELETE | Menghapus | 200 (dengan `message`) |

PUT dan PATCH berbeda makna, sehingga modul yang memakai PUT untuk mengganti urutan atau mentor bukan ketidakkonsistenan. `PUT /users/{id}` dan `PATCH /users/{id}` sama-sama diterima untuk ubah sebagian.

- Aksi yang bukan CRUD biasa (mis. `POST /users/{user}/reset-password`, `POST /users/{user}/restore`) boleh ditulis sebagai sub-path berupa kata benda atau kata kerja yang bukan CRUD, dan harus memakai POST bila mengubah data.

## Respons

- Satu resource: `{ "data": {...} }`. Daftar: `{ "data": [...], "links": {...}, "meta": {...} }` dengan paginasi (`?page=&per_page=`) dan filter lewat query string.
- Pesan untuk pengguna: `"message"` (Bahasa Indonesia) pada respons ubah dan hapus.
- Galat validasi 422: `{ "message": "...", "errors": { "field": ["..."] } }`.

## Kode status galat

| Kode | Arti | Bentuk |
|---|---|---|
| 401 | Belum login | `{ "message": "Unauthenticated." }` |
| 403 | Login tetapi tidak berhak | `{ "message": "..." }` |
| 404 | Data atau endpoint tidak ada | `{ "message": "Data tidak ditemukan." }` atau `"Endpoint tidak ditemukan."` |
| 405 | Metode tidak didukung | `{ "message": "..." }` + header `Allow` |
| 422 | Validasi gagal | lihat di atas |
| 429 | Terlalu banyak request | `{ "message": "..." }` + header `Retry-After` |

Semua galat HTTP di bawah `/api` hanya berisi `message`, tidak pernah menyertakan nama model, path file, atau trace, termasuk saat `APP_DEBUG=true` (diatur di `bootstrap/app.php`). Untuk pesan 404 khusus gunakan `abort(404, 'Pesan Anda.')`; pesan itu dipertahankan.

## Keamanan dan produksi

- Semua rute kecuali `GET /health` dan `POST /auth/login` berada di bawah `auth:sanctum` (dites otomatis).
- Di produksi wajib `APP_ENV=production` dan `APP_DEBUG=false`.
- Data sensitif yang tidak boleh disimpan di cache klien memakai `Cache-Control: private, no-store` (contoh: `GET /sessions/{session}/meeting-link`).

## Batasan yang disadari

- Autentikasi memakai sesi cookie Sanctum (SPA), bukan token per request, sehingga tidak sepenuhnya stateless. Bila kelak ada klien mobile atau pihak ketiga, tambahkan token API Sanctum tanpa mengubah desain resource.
- Belum ada hypermedia penuh (HATEOAS); hanya tautan paginasi.
