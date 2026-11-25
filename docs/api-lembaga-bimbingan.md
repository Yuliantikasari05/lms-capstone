# API Lembaga Bimbingan dan Pengaturan Role & Akses (Admin)

Kontrak untuk halaman **Manajemen Lembaga Bimbingan** (use case "Mengelola Lembaga Bimbingan", hi-fi 3.17) dan
**Pengaturan > Manajemen Role & Akses** (FR-14, hi-fi 3.18). Semua endpoint ada di bawah `/api/v1`, memakai cookie sesi
(login dulu) dan khusus Admin. Galat mengikuti format biasa: 401 belum login, 403 tanpa izin, 404 tidak ditemukan,
422 `{ "message": "...", "errors": { "kolom": ["pesan"] } }`.

Semua nominal adalah **rupiah bulat (integer)**. Tanggal berformat ISO 8601.

## Izin

| Izin | Kegunaan |
|---|---|
| `institutions.view` | Daftar, detail, dashboard, dan riwayat pencairan |
| `institutions.create` | Tambah lembaga (profil dan akun) |
| `institutions.update` | Ubah profil, bagi hasil, rekening, status |
| `institutions.delete` | Hapus dan pulihkan |
| `institutions.payout` | Ajukan dan proses pencairan dana (uang keluar, sengaja terpisah) |
| `roles.view` | Lihat role dan matriks izin (sudah ada sebelumnya) |
| `roles.manage` | Ubah izin role, buat dan hapus role khusus |

Semuanya hanya dimiliki role Admin secara bawaan.

## 1. Lembaga Bimbingan

Satu akun Lembaga = satu lembaga. Profil dibuat bersamaan dengan akun. Status akun (`active`, `inactive`, `suspended`)
tersimpan di akun, jadi menonaktifkan lembaga langsung mencegah loginnya.

| Metode | URL | Keterangan |
|---|---|---|
| GET | `/institutions` | Daftar + kartu ringkasan |
| POST | `/institutions` | Tambah (201). Kata sandi sementara ditampilkan **sekali** |
| GET | `/institutions/{id}` | Detail |
| PATCH | `/institutions/{id}` | Ubah |
| DELETE | `/institutions/{id}` | Hapus (soft delete) |
| POST | `/institutions/{id}/restore` | Pulihkan |
| GET | `/institutions/{id}/dashboard?period=3m` | Data halaman detail |
| GET | `/institutions/{id}/payouts` | Riwayat pencairan |
| POST | `/institutions/{id}/payouts` | Ajukan pencairan (201) |
| PATCH | `/institutions/{id}/payouts/{payoutId}` | Selesaikan atau batalkan |

### GET /institutions

Query: `q` (nama, email, telepon), `status` (`active|inactive|suspended`), `trashed` (`only|with`), `per_page` (1 sampai 100, bawaan 15), `page`.

```json
{
  "data": [{
    "id": 1, "name": "Bimbel Cerdas Mandiri", "description": "...", "phone": "0274-555-0101", "address": "...",
    "email": "bimbel.cerdas@demo.test", "status": "active", "status_label": "Aktif",
    "account": { "id": 7, "last_login_at": null, "deleted": false },
    "revenue_share_percent": 80, "needs_revenue_share": false,
    "bank": { "configured": true, "name": "BCA", "account_holder": "Bimbel Cerdas Mandiri", "account_last4": "7810", "label": "BCA ····7810 (Bimbel Cerdas Mandiri)" },
    "programs_count": 3,
    "balance": { "earned": 4200000, "held": 1800000, "available": 2400000 },
    "joined_at": "2026-01-12T00:00:00+07:00", "deleted_at": null,
    "abilities": { "update": true, "delete": true, "manage_payouts": true }
  }],
  "links": {}, "meta": { "current_page": 1, "last_page": 1, "total": 1 },
  "summary": { "total": 3, "active": 2, "institution_revenue_total": 0, "platform_revenue_total": 0, "pending_payouts_total": 0 }
}
```

`summary` tidak terpengaruh filter. `platform_revenue_total` adalah pemasukan kerja sama bagi platform (FR-16).
**Nomor rekening tidak pernah dikirim utuh**, hanya 4 digit terakhir dan label.

### POST /institutions

```json
{
  "name": "Bimbel Cerdas Nusantara", "email": "admin@cerdasnusantara.test", "revenue_share_percent": 80,
  "description": "...", "phone": "+62 812-3456-7890", "address": "...",
  "bank_name": "BCA", "bank_account_holder": "Bimbel CN", "bank_account_number": "1234567810",
  "status": "active"
}
```

Wajib: `name` (maks. 150, unik tanpa membedakan huruf besar-kecil), `email` (unik di seluruh akun, termasuk yang dihapus),
`revenue_share_percent` (bilangan bulat 1 sampai 100 = bagian lembaga; sisanya platform). Data rekening **semua terisi atau semua kosong**;
nomor rekening 5 sampai 30 digit (spasi dan tanda hubung dibuang otomatis). Admin tidak mengirim `password` (ditolak); sistem membuat
kata sandi sementara dan akun wajib menggantinya saat login pertama.

Respons 201: `{ "data": {...}, "message": "...", "temporary_password": "..." }` dengan header `Cache-Control: no-store`.

### PATCH /institutions/{id}

Semua kolom opsional (kirim yang berubah). Mengirim `null` mengosongkan kolom opsional. Mengubah `name`, `email`, dan `status`
ikut mengubah akunnya; status selain `active` langsung mengeluarkan sesi aktif lembaga. Mengubah email mengirim pemberitahuan ke email lama.
Perubahan `revenue_share_percent` hanya berlaku untuk **transaksi berikutnya** (riwayat tidak berubah).

### DELETE /institutions/{id}

Soft delete akun dan profil. **Ditolak (422)** bila lembaga punya riwayat transaksi atau pencairan, atau masih punya siswa aktif pada programnya.
Dalam kasus itu nonaktifkan lewat `PATCH` dengan `"status": "inactive"`.

### GET /institutions/{id}/dashboard

Query `period`: `7d`, `30d`, `3m` (bawaan), `6m`, `1y`.

```json
{
  "data": {
    "period": { "key": "3m", "label": "3 bulan", "from": "...", "to": "..." },
    "cards": {
      "total_revenue":     { "value": 240000, "previous": 96000, "change_percent": 150.0 },
      "content_sold":      { "value": 2 },
      "active_students":   { "value": 928, "new_in_period": 85 },
      "active_programs":   { "value": 14, "released_in_period": 2 },
      "available_balance": { "value": 6245000 }
    },
    "revenue_chart": { "bucket": "week", "points": [{ "key": "2026-11-16", "label": "16 Nov", "institution_amount": 0, "platform_amount": 0 }] },
    "finance": {
      "revenue_share_percent": 80, "gross_total": 0, "institution_total": 0, "platform_total": 0,
      "paid_out_total": 0, "pending_payout_total": 0, "available_balance": 0,
      "can_request_payout": false, "bank_account": "BCA ····7810 (Bimbel CN)"
    },
    "revenue_split": { "institution_percent": 80, "platform_percent": 20, "institution_amount": 0, "platform_amount": 0 },
    "top_programs": [{ "rank": 1, "course": { "id": 5, "title": "..." }, "sold": 6, "revenue": 480000, "status": "active", "status_label": "Aktif" }],
    "student_progress": [{ "user": { "id": 9, "name": "..." }, "program": { "id": 5, "title": "..." }, "enrolled_at": "...", "progress_percent": null }],
    "active_vouchers": { "total": 2, "items": [{ "id": 3, "code": "HEMAT10", "name": "...", "discount_label": "10%", "usage_label": "0/50", "expires_at": null }] },
    "recent_payouts": [ /* sama dengan item riwayat pencairan, maksimal 5 */ ]
  },
  "institution": { /* sama dengan GET /institutions/{id} */ },
  "periods": [{ "key": "7d", "label": "7 hari" }, { "key": "30d", "label": "30 hari" }, { "key": "3m", "label": "3 bulan" }, { "key": "6m", "label": "6 bulan" }, { "key": "1y", "label": "1 tahun" }]
}
```

Catatan angka:
- `change_percent` membandingkan dengan periode sebelumnya yang sama panjang; `null` bila periode sebelumnya 0.
- `revenue_chart.bucket`: `day` (7d, 30d), `week` (3m), `month` (6m, 1y). Bucket tanpa transaksi tetap ada bernilai 0.
- `finance` dan `available_balance` adalah total **seluruh waktu**; kartu, grafik, `revenue_split`, dan `top_programs` mengikuti `period`.
- `student_progress.progress_percent` selalu `null` untuk sementara: pencatatan progres materi belum ada di sistem, dan angka tidak dikarang.
- `active_students` dihitung dari pendaftaran aktif pada program milik lembaga; `active_vouchers` dari tabel kupon (`owner_type = institution`).
- Pemasukan baru terisi setelah modul pembayaran mencatat transaksi (lihat "Untuk modul pembayaran"). Sebelum itu semuanya 0.

### Pencairan dana

`GET /institutions/{id}/payouts?status=&per_page=` mengembalikan daftar (terbaru dulu) dan `summary`:

```json
{
  "data": [{
    "id": 4, "code": "PO-2026-00004", "amount": 800000, "status": "pending", "status_label": "Menunggu",
    "destination": { "label": "BCA ····7810 (Bimbel CN)", "bank_name": "BCA", "account_holder": "Bimbel CN", "account_last4": "7810" },
    "note": null, "requested_by": { "id": 1, "name": "Admin" }, "processed_by": null,
    "requested_at": "2026-11-23T10:00:00+07:00", "processed_at": null
  }],
  "summary": { "available_balance": 0, "pending_total": 800000, "completed_total": 0 }
}
```

- `POST /institutions/{id}/payouts` body `{ "amount": 500000, "note": "..." }`. **`amount` kosong = seluruh saldo yang dapat dicairkan** (tombol "Proses Pencairan Dana"). Status awal `pending` (Menunggu).
  Ditolak (422) bila jumlah melebihi saldo, tidak ada saldo, atau rekening lembaga belum lengkap. Pengajuan dijaga kunci baris sehingga saldo tidak dapat ditarik dua kali.
- `PATCH .../payouts/{payoutId}` body `{ "status": "completed" | "cancelled", "note": "..." }`. Hanya pencairan `pending` yang bisa diubah (422 bila sudah diproses).
  `cancelled` mengembalikan dananya ke saldo. `completed` mencatat siapa dan kapan (`processed_by`, `processed_at`).
- Rekening tujuan disalin saat pengajuan, jadi mengubah rekening lembaga kemudian tidak mengubah riwayat.

Saldo yang dapat dicairkan = total bagian lembaga dari transaksi `paid` dikurangi pencairan `pending` dan `completed`.

## 2. Pengaturan: Role & Akses

Dipindahkan ke dokumen tersendiri karena matriksnya dirancang ulang: lihat `docs/api-pengaturan-role-akses.md`.

## 3. Audit log

Aksi baru yang tercatat: `institution.created`, `institution.updated`, `institution.deleted`, `institution.restored`,
`institution.payout_requested`, `institution.payout_completed`, `institution.payout_cancelled`,
`role.created`, `role.updated`, `role.reset`, `role.deleted`. Nomor rekening hanya dicatat 4 digit terakhirnya; kata sandi tidak pernah dicatat.
Catatan role memuat nama role di `changes.role` dan, untuk perubahan izin, `permissions_added` dan `permissions_removed`.

## 4. Untuk modul pembayaran (tahap berikutnya)

Pencatatan penjualan Program Lembaga disiapkan di `App\Services\InstitutionRevenueService` dan sudah diuji:

```php
$sale = app(InstitutionRevenueService::class)->recordSale(
    institution: $institution, buyer: $siswa, grossAmount: 350000, discountAmount: 35000,
    course: $program, coupon: $coupon, reference: 'PAY-12345',   // reference unik = idempoten
);
// Pengembalian dana: ->refund($sale)
```

Pembagian hasil dihitung dari `revenue_share_percent` lembaga **saat transaksi** lalu disalin ke tabel `transactions`
(bagian lembaga dibulatkan ke bawah, sisanya platform). Melempar `InstitutionException` bila bagi hasil belum diatur, nominal tidak valid,
atau program bukan milik lembaga. Tabel `transactions` sengaja dibuat generik agar modul pembayaran dapat memakainya untuk transaksi lain.

## 5. Tabel baru dan data lama

| Tabel | Isi |
|---|---|
| `institutions` | Profil lembaga (1:1 dengan akun). Nomor rekening terenkripsi |
| `transactions` | Buku besar pembelian dengan pembagian hasil yang dicatat saat transaksi |
| `institution_payouts` | Riwayat pencairan dana |

Akun ber-role Lembaga yang sudah ada saat migrasi dijalankan otomatis diberi profil (nama = nama akun, `revenue_share_percent` = `null`,
`needs_revenue_share: true`). Admin perlu mengisi bagi hasilnya sebelum penjualan dapat dicatat. Akun Lembaga baru sebaiknya dibuat dari menu
Lembaga Bimbingan, bukan dari menu Pengguna.
