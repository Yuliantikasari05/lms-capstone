# Pembuktian bahwa API LMS Menerapkan REST

Panduan untuk presentasi atau sidang. Semua klaim di bawah sudah dicek langsung pada kode main branch dan pada server yang dijalankan sungguhan.

## 1. Cukupkah halaman `localhost:8000`?

Tidak. Halaman itu (`routes/web.php`) hanya mengembalikan JSON "Ini adalah backend API". Itu membuktikan server hidup, bukan bahwa desainnya REST. REST adalah gaya arsitektur, jadi buktinya harus berupa perilaku: resource, metode HTTP, kode status, dan representasi. Tunjukkan lima bukti di bagian 3.

## 2. Enam batasan REST (Fielding) dan buktinya di kode Anda

| Batasan | Penerapan | Bukti |
|---|---|---|
| Client-server | Frontend React (`frontend/`, port 5173) dan backend Laravel (`backend/`, port 8000) terpisah penuh; keduanya hanya berbicara lewat HTTP+JSON. | Struktur folder; `FRONTEND_URL` dan CORS di `.env`. |
| Stateless | **Sebagian.** Setiap request membawa semua informasi yang dibutuhkan (cookie sesi + token CSRF), tetapi identitas disimpan di sesi server (`statefulApi()` pada `bootstrap/app.php`). Ini pola resmi Laravel Sanctum untuk SPA. | Jawab jujur; lihat pertanyaan 3 di bagian 5. |
| Cacheable | **Belum dimanfaatkan.** Respons membawa `Cache-Control: no-cache, private`. Tidak ada ETag. | Lihat saran 6. |
| Uniform interface | Resource berupa kata benda jamak (`/courses`, `/users`), metode HTTP sesuai makna, kode status tepat, representasi JSON konsisten (`data`, `message`, `meta`, `links`, `errors`). | Bagian 3. |
| Layered system | Request melewati lapisan middleware (autentikasi, `active`, `password.changed`, hak akses, `throttle`) sebelum controller; klien tidak tahu apa pun tentang database. | `routes/api.php`, `EnsureHasPermission`. |
| Code on demand | Opsional dalam REST dan tidak dipakai. | Tidak perlu dibuktikan. |

Dalam model kematangan Richardson: level 0 satu endpoint, level 1 resource terpisah, **level 2 metode HTTP dan kode status yang benar (posisi kode Anda)**, level 3 HATEOAS. Level 2 adalah standar industri; level 3 jarang diterapkan. Tautan paginasi (`links.next`) adalah bentuk ringan hypermedia yang sudah ada.

## 3. Lima bukti untuk diperagakan

**Bukti 1: daftar resource dan metode.**
```
cd backend
php artisan route:list --path=api/v1
```
Tunjukkan bahwa URL berupa kata benda dan metodenya `GET/POST/PUT/PATCH/DELETE`.

**Bukti 2: perilaku nyata lewat HTTP.** Nyalakan `php artisan serve`, lalu:
```
EMAIL=admin@demo.test PASSWORD='kata-sandi-anda' bash docs/demo-rest.sh
```
Skrip menjalankan alur ini dan mencetak kode status asli. Hasil yang kami rekam:

| Langkah | Request | Hasil |
|---|---|---|
| Tanpa login | `GET /api/v1/courses` | `401` |
| Login | `POST /api/v1/auth/login` | `200` |
| Buat | `POST /api/v1/courses` | `201` + resource baru |
| Baca daftar | `GET /api/v1/courses?q=Peragaan` | `200` + `data`, `links`, `meta` |
| Baca satu | `GET /api/v1/courses/{id}` | `200` |
| Ubah sebagian | `PATCH /api/v1/courses/{id}` | `200` |
| Validasi gagal | `POST` dengan data salah | `422` + `errors` per field |
| Hapus | `DELETE /api/v1/courses/{id}` | `200` |
| Sudah hilang | `GET /api/v1/courses/{id}` | `404` + `{"message":"Data tidak ditemukan."}` |
| Metode salah | `PUT /api/v1/courses` | `405` + header `Allow` |

Skrip memakai resource `/courses`; cara yang sama berlaku untuk `/users` dan lainnya. Anda juga bisa memakai Postman atau Insomnia; ingat bahwa SPA Sanctum membutuhkan `GET /sanctum/csrf-cookie`, header `Origin`, dan header `X-XSRF-TOKEN` (skrip sudah mengurusnya).

**Bukti 3: pengujian otomatis.** `php artisan test` menjalankan seluruh pengujian (kode status, validasi, hak akses per role, format respons). Khusus `RestConventionsTest` memeriksa **seluruh** rute sekaligus: URL tanpa kata kerja, semua rute (kecuali health dan login) wajib login, galat 401/403/404/405 berbentuk JSON bersih. Bila ada rute atau galat baru yang menyimpang, test gagal.

**Bukti 4: Network tab browser.** Buka frontend, tekan F12, tab Network, filter `Fetch/XHR`. Tunjukkan request nyata dengan metode, kode status, dan JSON-nya.

**Bukti 5: dokumen.** `docs/standar-rest-api.md` (aturan yang dijaga test) dan `docs/api-kursus.md` (kontrak endpoint). Lebih kuat lagi bila ditambah dokumen OpenAPI (saran 2).

## 4. Pola yang sama di seluruh API

- Buat → `201`; baca/ubah/hapus → `200`; galat validasi → `422`; tidak login → `401`; tidak berhak → `403`; tidak ada → `404`.
- Daftar selalu dipaginasi (`?page=&per_page=`) dan bisa difilter lewat query string.
- Respons ubah dan hapus memuat `message` berbahasa Indonesia.

## 5. Pertanyaan yang mungkin diajukan dosen

1. **Mengapa `PATCH` bukan `PUT` untuk ubah?** `PUT` berarti mengganti seluruh resource, `PATCH` mengubah sebagian. Form ubah biasanya hanya mengirim field yang berubah. Rute `apiResource` Laravel menerima keduanya.
2. **Mengapa hapus mengembalikan `200` + pesan, bukan `204`?** Keduanya sah. `200` dipilih agar frontend bisa menampilkan pesan, dan dipakai konsisten di semua modul.
3. **Bukankah sesi cookie melanggar stateless?** Secara ketat ya: server menyimpan sesi. Namun untuk SPA satu organisasi, ini pola yang direkomendasikan Sanctum dan lebih aman terhadap XSS dibanding token di `localStorage`. Bila nanti ada aplikasi mobile atau pihak ketiga, Sanctum mendukung token API tanpa mengubah desain resource.
4. **Mengapa ada `POST /users/{user}/reset-password` dan `/restore`?** Itu aksi yang bukan sekadar CRUD. REST mengizinkan sub-resource atau aksi bila perlu; alternatif yang lebih murni adalah mengubah status lewat `PATCH`.
5. **Apakah ini REST murni?** Jawaban jujur: RESTful tingkat 2 (Richardson). Tidak ada HATEOAS penuh, dan itu wajar untuk API yang dipakai satu frontend yang kita kendalikan.

## 6. Penyempurnaan: yang sudah dikerjakan dan yang tersisa

Sudah dikerjakan:

1. **Galat HTTP bersih.** Sebelumnya 404 "data tidak ada" menyebut nama model internal (`No query results for model [App\Models\Course]`) bahkan di produksi, dan saat `APP_DEBUG=true` semua galat HTTP membocorkan trace dan path file server. Kini semuanya `{"message": "..."}` dengan kode status dan header aslinya (`bootstrap/app.php`).
2. **Test konvensi REST** (`RestConventionsTest`) yang menjaga seluruh API.
3. **Dokumen standar** (`docs/standar-rest-api.md`) dan catatan produksi di `.env.example`.

Perlu dikerjakan sendiri:

1. **Produksi: `APP_ENV=production` dan `APP_DEBUG=false`.** Wajib; debug membuka detail internal pada galat 500.
2. **Dokumen OpenAPI otomatis**: jalankan `composer require dedoc/scramble` di `backend/`. Dokumentasi interaktif tersedia di `/docs/api`. Ini bukti paling meyakinkan untuk dosen. (Tidak bisa dipasang dari lingkungan saya karena paket tidak dapat diunduh; setelah dipasang, jalankan `php artisan test` lagi.)

Opsional, bernilai kecil:

- **Cache** untuk data yang jarang berubah (daftar role) dengan `Cache-Control` atau ETag, untuk menutup batasan "cacheable".
- **Autentikasi token** hanya bila ada klien selain SPA.
- **Header `Location` pada 201** sengaja tidak ditambahkan: header itu harus menunjuk URL yang bisa dibaca, sedangkan modul dan materi tidak punya endpoint `GET` tunggal, sehingga tidak bisa diterapkan seragam.

Koreksi: penggunaan `PUT` untuk mengganti mentor atau urutan modul sudah benar (PUT = mengganti), jadi bukan ketidakkonsistenan yang perlu diperbaiki.
