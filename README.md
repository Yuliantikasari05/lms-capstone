# LMS Capstone Project

Fondasi aplikasi **Learning Management System (LMS)** berbentuk monorepo: backend REST API (Laravel 12) dan frontend SPA (React + TypeScript). Tahap ini fokus pada fondasi yang benar: autentikasi, RBAC lima role, serta dashboard dan navigasi dasar untuk tiap role. Fitur bisnis LMS belum dibuat (lihat [Status fitur](#14-status-fitur)).

## 1. Deskripsi proyek

- Backend: REST API `/api/v1` dengan autentikasi **Laravel Sanctum (cookie/sesi, first-party SPA)**.
- RBAC: 5 role (Admin, Mentor, Siswa, Karyawan, Lembaga Bimbingan), permission, dan prinsip *least privilege*.
- Frontend: dashboard berbeda per role. **Admin** memakai sidebar vertikal; **Mentor, Siswa, Karyawan, Lembaga Bimbingan** memakai navigasi horizontal di atas.
- Role dan permission selalu berasal dari backend (`GET /api/v1/auth/me`), bukan di-hardcode di frontend.

## 2. Teknologi

| Bagian | Teknologi |
|---|---|
| Backend | Laravel 12, PHP 8.2+, PostgreSQL, Laravel Sanctum, PHPUnit |
| Frontend | React 18, TypeScript, Vite, React Router, Axios, Tailwind CSS 3, lucide-react |

## 3. Struktur folder

```text
lms-capstone-project/
├── backend/     # Laravel 12 (API, migration, seeder, test)
├── frontend/    # React + TypeScript + Vite
├── README.md
└── .gitignore
```

## 4. Persyaratan software

- PHP **8.2** atau lebih baru, dengan ekstensi: `pdo_pgsql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `fileinfo`, `curl`. Untuk menjalankan test backend diperlukan juga `pdo_sqlite`.
- Composer 2.x
- PostgreSQL 14+
- Node.js 20+ dan npm

## 5. Instalasi dependency backend

```bash
cd backend
composer install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
php artisan key:generate
```

`composer install` akan membuat `composer.lock`. Sebaiknya file ini ikut di-commit agar versi dependency konsisten.

## 6. Membuat database PostgreSQL dan mengatur `.env`

Buat database (sesuaikan user Anda):

```bash
psql -U postgres -c "CREATE DATABASE lms_capstone;"
```

Edit `backend/.env`:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=lms_capstone
DB_USERNAME=postgres
DB_PASSWORD=isi_password_postgres_anda
```

Pengaturan Sanctum/CORS yang sudah ada di `.env.example` cocok untuk pengembangan lokal (frontend `http://localhost:5173`, backend `http://localhost:8000`). Jika frontend dibuka lewat `127.0.0.1`, samakan semua URL (lihat Troubleshooting).

## 7. Migration dan seeder

```bash
php artisan migrate
php artisan db:seed
```

Seeder membuat 5 role beserta permission-nya. Akun Admin dibuat sesuai bagian 12.

### 7a. Sinkronisasi izin RBAC (jalankan setelah menarik perubahan)

Kode yang baru ditarik **tidak** otomatis menambah izin di database. Bila sebuah modul (mis. kupon, gamifikasi, lembaga bimbingan, pengaturan role, atau fitur kursus Mentor) belum pernah di-seed, endpoint-nya mengembalikan **403** walaupun policy dan route sudah benar.

Periksa lebih dahulu:

```bash
php artisan lms:permissions:check       # exit code 1 bila belum sinkron
```

Perintah ini membandingkan `RolePermissionSeeder` dan katalog RBAC (`App\Support\Rbac\Catalog`) dengan isi tabel `permissions` / `permission_role`, lalu melaporkan:

- izin yang ditegakkan kode tetapi belum ada di database,
- role bawaan yang belum ada,
- role yang kehilangan izin wajibnya (mis. Admin tanpa `roles.manage`).

Status ringkasnya juga tersedia tanpa login di `GET /api/v1/health` pada objek `permissions` (`ok`, `missing`, `roles_missing_required`), sehingga masalah ini terlihat sebelum pengguna menemui 403.

Bila terdeteksi belum sinkron:

```bash
php artisan db:seed --class=RolePermissionSeeder --force
php artisan lms:reset-role-permissions --role=all --force   # hanya bila izin bawaan role ikut hilang
```

`RolePermissionSeeder` aman dijalankan berulang: izin baru dibuat dan diberikan ke role bawaan, sedangkan izin yang sengaja dimatikan Admin lewat **Pengaturan > Role & Akses** tidak dinyalakan lagi. Setelah sinkron, pengguna cukup me-refresh halaman karena izin dibaca ulang dari database pada setiap request.

### 7b. Data demo kursus, tugas, dan jadwal (opsional, hanya development)

Halaman Mentor (Kursus Saya, Manajemen Kurikulum, Dashboard, Tugas, Jadwal Bimbingan) membaca data dari database. Untuk mengisi contoh yang saling cocok:

```bash
php artisan migrate
php artisan db:seed --class=DemoUserSeeder
php artisan db:seed --class=DemoCourseSeeder
php artisan db:seed --class=DemoAssignmentSeeder
php artisan db:seed --class=DemoLearningSeeder   # data belajar Siswa (opsional)
php artisan db:seed --class=DemoGamificationSeeder # level & XP contoh (opsional)
php artisan db:seed --class=DemoNotificationSeeder # notifikasi contoh Siswa, Mentor, dan Admin (opsional)
```

- `DemoUserSeeder` membuat akun `@demo.test` (Mentor, Siswa, Karyawan, Lembaga). Kata sandinya dari `DEMO_USER_PASSWORD` di `.env`.
- `DemoCourseSeeder` membuat 7 kursus beserta modul, materi, sesi, dan peserta untuk Mentor demo (mis. `rina.kusumawati@demo.test`, `bagas.prasetyo@demo.test`). Aman dijalankan berulang: data dicocokkan lewat judul.
- Sesi demo bergantian **Online** dan **Offline**. Sesi Online memakai tautan dummy `https://meet.google.com/hbk-givp-vaz` (hanya untuk demo); sesi Offline tidak punya tautan dan memakai lokasi ruangan. Saat Mentor membuat sesi sungguhan, tautan asli wajib diisi untuk sesi Online.
- `DemoAssignmentSeeder` membuat tugas, kuis, dan satu ujian (berstatus **Menunggu persetujuan** Admin) beserta soal dan pengumpulan contoh, sehingga halaman **Tugas** dan tab **Tugas siswa/karyawan** langsung berisi data.
- `DemoLearningSeeder` melengkapi akun `adi.saputra@demo.test` (enrollment aktif, materi selesai, log belajar 6 bulan, hari aktif, kehadiran sesi lampau) sehingga Dashboard, Materi, Tugas, Jadwal, Papan Peringkat, dan Laporan siswa berisi data nyata. Rincian endpoint: `docs/api-belajar-siswa.md`.
- `DemoGamificationSeeder` membuat level contoh hanya bila tabel `levels` masih kosong, lalu memberi XP contoh ke Siswa demo agar papan peringkat tidak kosong.
- `DemoNotificationSeeder` mengisi lonceng dan halaman **Notifikasi** tiap peran dengan isi sesuai pekerjaannya: Siswa (`adi.saputra@demo.test`), Mentor (`rina.kusumawati@demo.test`), dan setiap akun Admin. Notifikasi juga dibuat otomatis dari aktivitas nyata: pengumpulan tugas (Mentor), keputusan review ujian dan peserta baru (Admin), nilai tugas dan sesi baru (Siswa). Penerimanya ditentukan izin role dan kepemilikan kursus.
- Keduanya hanya berjalan di lingkungan `local`/`testing` dan **tidak** dipanggil oleh `db:seed` biasa.
- Materi demo memakai tautan (tanpa file) dan bertipe `video` bila punya durasi, `link` bila tidak, sesuai aturan API.
- Hapus data demo kursus lewat `php artisan tinker`: `Course::withTrashed()->whereIn('title', DemoCourseSeeder::titles())->forceDelete();`
- Hapus data demo tugas: `Assignment::withTrashed()->whereIn('title', DemoAssignmentSeeder::titles())->forceDelete();`

## 8. Menjalankan Laravel

```bash
php artisan serve
```

API tersedia di `http://localhost:8000`. Cek: `http://localhost:8000/api/v1/health`.

Menjalankan test backend (memakai SQLite in-memory, **tidak menyentuh database PostgreSQL Anda**):

```bash
php artisan test
```

## 9. Instalasi dependency frontend

```bash
cd frontend
npm install
```

`npm install` akan membuat `package-lock.json`; sebaiknya di-commit.

## 10. Mengatur URL API frontend

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Isi `frontend/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 11. Menjalankan React + Vite

```bash
npm run dev
```

Buka `http://localhost:5173`. Build produksi: `npm run build` (menjalankan type-check lalu build Vite).

## 12. Akun awal Admin

Tidak ada password default di source code. Pilih salah satu cara:

**Cara A (disarankan): perintah interaktif.** Password diketik tersembunyi dan tidak disimpan di file apa pun.

```bash
cd backend
php artisan lms:create-admin
```

**Cara B: lewat seeder.** Isi di `backend/.env` (password minimal 12 karakter), lalu jalankan `php artisan db:seed`. Setelah akun terbentuk, **kosongkan kembali `ADMIN_PASSWORD`** di `.env`.

```dotenv
ADMIN_NAME="Administrator"
ADMIN_EMAIL=admin@contoh.test
ADMIN_PASSWORD=
```

Akun Karyawan, Mentor, Siswa, dan Lembaga Bimbingan dibuat oleh Admin (melalui `POST /api/v1/users`). Belum ada pendaftaran mandiri (self-registration), termasuk untuk Karyawan, sampai ada keputusan.

## 13. Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `could not find driver` | Aktifkan ekstensi `pdo_pgsql` di `php.ini` (untuk test: `pdo_sqlite`). |
| Login selalu gagal dengan status 400 / "Sanctum stateful" | Host frontend belum ada di `SANCTUM_STATEFUL_DOMAINS`. Contoh: buka `localhost:5173` → harus ada `localhost:5173` di daftar. Jalankan `php artisan config:clear`. |
| Status 419 (CSRF token mismatch) | Frontend dan backend harus memakai host yang sama (`localhost` **atau** `127.0.0.1`, jangan dicampur). Hapus cookie situs lalu ulangi login. |
| Error CORS di browser | Pastikan `FRONTEND_URL` di `backend/.env` sama persis dengan URL frontend (termasuk port), lalu `php artisan config:clear`. |
| Setelah login langsung kembali ke halaman login | Cookie sesi tidak terkirim. Periksa `SESSION_DOMAIN=null`, `SESSION_SAME_SITE=lax`, dan host yang konsisten. |
| Tabel `sessions` tidak ada | Jalankan `php artisan migrate`. |
| Frontend menampilkan "Server tidak dapat dihubungi" | Backend belum berjalan atau `VITE_API_BASE_URL` salah. Restart `npm run dev` setelah mengubah `.env`. |
| Perubahan `.env` backend tidak berlaku | `php artisan config:clear`. |

## 14. Status fitur

**Sudah tersedia**

- Endpoint: `GET /api/v1/health`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`.
- RBAC: tabel `users`, `roles`, `permissions`, `role_user`, `permission_role`; status akun; seeder 5 role; pembuatan Admin awal yang aman.
- Endpoint pengguna (khusus Admin, berbasis Policy): `GET/POST /api/v1/users`, `GET/PATCH/DELETE /api/v1/users/{id}`, `GET /api/v1/roles`, `GET /api/v1/admin/summary`.
- Frontend: login/logout/cek sesi lewat API, penanganan 401/403/419 dan backend tidak dapat dihubungi, layout sidebar (Admin) dan top-nav (4 role lain), dashboard, halaman Profil, daftar pengguna (Admin, hanya baca).
- Dashboard Admin menampilkan data nyata dari database (jumlah pengguna, mentor, login terbaru).
- Halaman **Kursus Saya** Mentor (`/mentor/courses`) dan detail kursus (`/mentor/courses/:id`) memakai data nyata: `GET /api/v1/courses`, `GET /api/v1/courses/{id}`, dan `GET /api/v1/courses/{id}/modules` (kurikulum + materi, termasuk tautan/berkas materi). Tampilan tidak diubah; data contoh lama hanya dipakai halaman yang belum terhubung (mis. Manajemen Kurikulum Mentor).
- Automated test backend (health, login berhasil/gagal, logout, profil dengan/tanpa autentikasi, role/permission, pembatasan akses).

**Masih placeholder ("Fitur belum tersedia pada tahap ini")**

Seluruh menu selain Dashboard/Ringkasan, Manajemen User (daftar), dan Profil; antara lain kursus, kupon, gamifikasi, lembaga bimbingan, pengaturan, tugas, kurikulum, jadwal, materi, laporan, papan peringkat, pelatihan, webinar, sertifikat, pembayaran, voucher, dan notifikasi.

Angka ringkasan dashboard non-Admin ditampilkan sebagai "belum tersedia" karena modul datanya belum ada.

**Catatan batasan**

- Aturan "Mentor sesuai penugasan", "Siswa sesuai haknya", dan "Lembaga hanya data miliknya" baru berupa fondasi (role + permission). Pembatasan per-data akan ditambahkan bersama tabel bisnisnya (kursus, program, dll.), karena belum ada data yang perlu dibatasi.
- Belum ada GitHub Actions/CI/CD, sesuai ruang lingkup tahap ini.
