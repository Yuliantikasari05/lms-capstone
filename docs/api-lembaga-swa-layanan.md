# API Lembaga Bimbingan (Swa-Layanan)

Kontrak untuk halaman role **Lembaga Bimbingan**: dashboard, Kelola Modul, Jelajahi (harga & laporan),
Kelola Siswa, Voucher, Profil, dan notifikasi. Semua endpoint di bawah `/api/v1`, memakai cookie sesi
(login dulu). Galat mengikuti standar biasa: 401 belum login, 403 tanpa izin, 404 bukan milik lembaga ini,
422 `{ "message": "...", "errors": { "kolom": ["pesan"] } }`.

**Batas kepemilikan.** Tidak ada id lembaga yang dikirim klien. Profil diambil dari `user_id` akun yang login;
program diambil dari `created_by` akun itu dengan jenis `institution`. Program lembaga lain selalu 404.

## Izin

Semua hanya untuk role Lembaga dan dapat dimatikan Admin di **Pengaturan > Role & Akses** (modul
"Pengelolaan Lembaga" dan aktivitas "Program Lembaga Saya").

| Izin | Kegunaan |
|---|---|
| `courses.view` / `courses.create` / `courses.update` | Program lembaga sendiri (buat, lihat, ubah) |
| `content.manage` | Modul, materi, dan sesi program sendiri |
| `lembaga.students.view` | Daftar dan detail siswa program lembaga |
| `lembaga.vouchers.view/create/update/delete` | Voucher promosi lembaga |
| `lembaga.pricing.view/update` | Harga normal dan harga diskon program |
| `lembaga.profile.view/update` | Profil dan pengaturan lembaga |
| `lembaga.report.view` | Laporan pendapatan, pendaftar, dan voucher |
| `dashboard.lembaga` | Ringkasan dashboard (izin wajib role) |

Memindahkan/menghapus izin di matriks langsung menutup endpoint terkait (403) tanpa perlu deploy.
Pendaftaran peserta tetap milik Admin (`enrollments.manage`); Lembaga hanya membaca.

## Endpoint

| Metode | URL | Izin | Keterangan |
|---|---|---|---|
| GET | `/lembaga/summary` | `dashboard.lembaga` | Kartu ringkasan + tiga program terbaru |
| GET | `/lembaga/profile` | `lembaga.profile.view` | Profil lembaga + statistik + rekening tersamar |
| PATCH | `/lembaga/profile` | `lembaga.profile.update` | Ubah nama, deskripsi, telepon, alamat |
| GET | `/lembaga/students` | `lembaga.students.view` | Daftar siswa program lembaga (`q`, `page`, `per_page`) |
| GET | `/lembaga/students/{user}` | `lembaga.students.view` | Detail siswa + program yang diikuti |
| GET | `/lembaga/vouchers` | `lembaga.vouchers.view` | Daftar voucher + `summary` |
| POST | `/lembaga/vouchers` | `lembaga.vouchers.create` | Buat voucher (201) |
| GET | `/lembaga/vouchers/{coupon}` | `lembaga.vouchers.view` | Detail voucher |
| PATCH | `/lembaga/vouchers/{coupon}` | `lembaga.vouchers.update` | Ubah voucher / aktif-nonaktif |
| DELETE | `/lembaga/vouchers/{coupon}` | `lembaga.vouchers.delete` | Hapus voucher (soft delete) |
| GET | `/lembaga/pricing` | `lembaga.pricing.view` | Harga seluruh program lembaga |
| PATCH | `/lembaga/programs/{course}/pricing` | `lembaga.pricing.update` | Atur harga normal & diskon |
| GET | `/lembaga/reports` | `lembaga.report.view` | Ringkasan + laporan per program |

## Program dan kurikulum

Program adalah kursus jenis `institution`. CRUD-nya memakai endpoint kursus yang sudah ada:

- `GET /courses?type=institution` — daftar program milik lembaga (CoursePolicy membatasi kepemilikan).
- `POST /courses` — body `{ "type": "institution", "title", "description", "category", "status": "draft|active" }`.
  Lembaga hanya boleh membuat jenis `institution`; jenis lain 422. Program lembaga tidak memakai Mentor sehingga
  boleh langsung aktif.
- `PATCH /courses/{id}` — ubah judul, deskripsi, status program sendiri.
- `POST /courses/{course}/modules`, `PATCH/DELETE /modules/{module}` — bab utama.
- `POST /modules/{module}/materials`, `PATCH/DELETE /materials/{material}` — materi (berkas atau tautan).
- `GET/POST /courses/{course}/sessions`, `PATCH/DELETE /sessions/{session}` — sesi dan tautan meeting.

Menghapus program tidak tersedia untuk Lembaga (izin `courses.delete` khusus Admin); nonaktifkan lewat status.

## Bentuk data penting

`GET /lembaga/summary`

```json
{
  "data": {
    "institution": { "id": 2, "name": "Lembaga Prima Edukasi", "revenue_share_percent": 75,
      "bank": { "configured": true, "label": "Mandiri ····5521 (Prima Edukasi)" } },
    "cards": { "active_programs": 3, "total_students": 6, "total_enrollments": 9,
      "total_revenue": 2235000, "active_vouchers": 1, "used_vouchers": 0 },
    "programs": [{
      "id": 11, "title": "English for TOEFL", "category": "akademik", "status": "active",
      "status_label": "Aktif", "price": 400000, "discount_price": 340000, "price_label": "Rp 340.000",
      "modules_count": 2, "sessions_count": 1, "students_count": 4, "sold_count": 3, "revenue": 1020000
    }]
  }
}
```

- `total_revenue` dan `revenue` adalah bagian lembaga dari transaksi berstatus `paid` (seluruh waktu).
- `sold_count` = jumlah transaksi berbayar program; `students_count` = pendaftaran aktif.
- `used_vouchers` = jumlah pemakaian voucher lembaga.

`GET /lembaga/students/{user}` menambahkan `programs[]` (program + `progress_percent`) dan `metrics`.
`progress_percent` dan `average_score` bernilai `null` karena pencatatan progres/nilai program lembaga belum ada;
angka tidak dikarang.

Voucher mengikuti tabel `coupons` dengan `owner_type = institution`:

```json
{ "id": 5, "name": "Promo Prima", "code": "DEMOPRIMA15", "discount_type": "percentage",
  "discount_value": 15, "discount_label": "15%", "usage_limit": 50, "used_count": 0,
  "status": "active", "status_label": "Aktif", "is_active": true,
  "expires_at": "2027-01-31", "course": { "id": 11, "title": "English for TOEFL" } }
```

Aturan voucher:

- Kode unik di seluruh platform (termasuk kupon Admin dan kupon terhapus), disimpan huruf besar.
- `course_id` harus program milik lembaga ini; kosong berarti berlaku untuk semua program.
- Diskon persentase maksimal 100; `usage_limit` kosong berarti tanpa batas.
- `expires_at` disimpan sampai akhir hari tanggal yang dipilih.

Harga:

```json
PATCH /lembaga/programs/11/pricing
{ "price": 400000, "discount_price": 340000 }
```

- `discount_price` kosong/`null` berarti tanpa diskon; `price` 0 berarti gratis.
- `discount_price` tidak boleh lebih besar dari `price` (422).
- Perubahan hanya berlaku untuk transaksi berikutnya; riwayat bagi hasil tidak berubah.

## Notifikasi

Penerima ditentukan izin dan kepemilikan, bukan daftar role tetap:

| Kejadian | Penerima | Isi |
|---|---|---|
| Lembaga membuat program baru | Admin pemegang `institutions.view` | "Program baru dari Lembaga: …" → `/admin/institutions` |
| Peserta didaftarkan ke program lembaga | Pemilik program (akun Lembaga, bila `courses.view` menyala) | "Peserta baru di …" → `/lembaga/students` |
| Peserta didaftarkan | Peserta | "Kamu terdaftar di …" → materi siswa |

Notifikasi Lembaga juga tampil di lonceng header dan halaman `/lembaga/notifications` (rute tersembunyi;
menu sidebar tidak berubah).

## Audit

`lembaga.voucher_created`, `lembaga.voucher_updated`, `lembaga.voucher_deleted`, `lembaga.pricing_updated`.
Nomor rekening dan kata sandi tidak pernah dicatat.
