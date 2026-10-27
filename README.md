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
- Automated test backend (health, login berhasil/gagal, logout, profil dengan/tanpa autentikasi, role/permission, pembatasan akses).

**Masih placeholder ("Fitur belum tersedia pada tahap ini")**

Seluruh menu selain Dashboard/Ringkasan, Manajemen User (daftar), dan Profil; antara lain kursus, kupon, gamifikasi, lembaga bimbingan, pengaturan, tugas, kurikulum, jadwal, materi, laporan, papan peringkat, pelatihan, webinar, sertifikat, pembayaran, voucher, dan notifikasi.

Angka ringkasan dashboard non-Admin ditampilkan sebagai "belum tersedia" karena modul datanya belum ada.

**Catatan batasan**

- Aturan "Mentor sesuai penugasan", "Siswa sesuai haknya", dan "Lembaga hanya data miliknya" baru berupa fondasi (role + permission). Pembatasan per-data akan ditambahkan bersama tabel bisnisnya (kursus, program, dll.), karena belum ada data yang perlu dibatasi.
- Belum ada GitHub Actions/CI/CD, sesuai ruang lingkup tahap ini.
