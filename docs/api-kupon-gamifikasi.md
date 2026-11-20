# API Kupon dan Gamifikasi (Admin)

Kontrak API untuk halaman **Manajemen Kupon** dan **Gamifikasi** Admin. Mengikuti `docs/standar-rest-api.md`: semua endpoint di bawah `/api/v1`, memakai login cookie (Sanctum), dan hanya untuk akun yang kata sandinya bukan lagi kata sandi sementara. Kesalahan validasi berbentuk `422 { message, errors: { kolom: [pesan] } }`; tidak ada izin `403`; data tidak ada `404`.

Semua endpoint di dokumen ini **khusus Admin**. Izin: `coupons.view/create/update/delete`, `gamification.view` (baca), `gamification.manage` (ubah). Role lain mendapat `403`.

## Kupon

Satu tabel dipakai untuk kupon Admin dan, kelak, voucher Lembaga (kolom `owner_type`). Menu ini hanya menampilkan dan mengubah kupon milik Admin; voucher Lembaga yang diakses lewat sini mendapat `403` ("Voucher Lembaga dikelola oleh lembaganya.").

### Bidang kupon

| Bidang | Keterangan |
|---|---|
| `code` | Huruf besar, angka, `_` dan `-`, 3 sampai 30 karakter. Dinormalkan ke huruf besar; unik tanpa membedakan huruf besar-kecil, **termasuk kupon yang sudah dihapus**. Tidak dapat diubah setelah kupon pernah dipakai. |
| `name` | Opsional, maksimal 100 karakter (mis. "Promo Harga Kelas Materi UTBK"). |
| `discount_type` | `percentage` (nilai 1 sampai 100) atau `fixed` (rupiah bulat, 1 sampai 100.000.000). |
| `discount_value` | Bilangan bulat. |
| `usage_limit` | Opsional. `null` = tanpa batas. Tidak boleh di bawah jumlah pemakaian yang sudah terjadi. |
| `course_id` | Opsional. Kosong = berlaku untuk semua kursus; terisi = **khusus kursus/program itu** (arti "Payment Khusus" di desain). |
| `expires_at` | Opsional, ISO 8601. Saat membuat harus setelah sekarang; saat mengubah boleh tanggal lampau. |
| `is_active` | Boolean, bawaan `true`. Satu-satunya status yang diatur Admin. |

### Status efektif (dihitung server, field `status`)

Prioritas: `inactive` (nonaktif), lalu `expired` (kedaluwarsa), lalu `exhausted` (kuota habis), lalu `active`. Label siap tampil ada di `status_label`.

### Endpoint

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/coupons` | Filter: `q` (kode atau nama), `status` (`active` `inactive` `expired` `exhausted`), `course_id`, `per_page` (1 sampai 100, bawaan 15). Terbaru di atas. |
| POST | `/coupons` | `code`, `discount_type`, `discount_value`, serta `name`, `usage_limit`, `course_id`, `expires_at`, `is_active`. Respons `201`. |
| GET | `/coupons/{id}` | Detail |
| PATCH | `/coupons/{id}` | Bidang yang dikirim saja. |
| DELETE | `/coupons/{id}` | Soft delete. **Kupon yang sudah pernah dipakai ditolak (`422`)**: nonaktifkan saja. |

### Contoh respons `GET /coupons`

```json
{
  "data": [
    {
      "id": 3,
      "owner_type": "admin",
      "name": "Kamis Hemat",
      "code": "KAMISHEMAT",
      "discount_type": "fixed",
      "discount_type_label": "Nominal Tetap (Rp)",
      "discount_value": 50000,
      "discount_label": "Rp 50.000",
      "usage_limit": 1000,
      "used_count": 0,
      "usage_label": "0/1000",
      "course": null,
      "expires_at": "2027-02-05T00:00:00+07:00",
      "is_active": true,
      "status": "active",
      "status_label": "Aktif",
      "abilities": { "update": true, "delete": true },
      "created_at": "2026-11-05T09:00:00+07:00",
      "updated_at": "2026-11-05T09:00:00+07:00"
    }
  ],
  "links": {},
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 1 },
  "summary": { "total": 5, "active": 5, "total_redemptions": 0 }
}
```

`summary` memuat tiga kartu di hi-fi (Total Kupon, Kupon Aktif, Total Penggunaan) dan **tidak terpengaruh filter**. `usage_label` bernilai `"12/∞"` bila tanpa batas.

## Gamifikasi

### Aturan

- **XP hanya untuk Siswa.** Siswa yang dihitung di peringkat dan ringkasan: semua Siswa **aktif** yang belum dihapus (yang belum punya XP dihitung 0).
- **Riwayat XP tidak dapat diubah atau dihapus.** Koreksi Admin adalah entri baru (positif atau negatif) dengan alasan wajib. "Hapus" pada baris peringkat = **reset XP ke 0** (juga entri baru). Saldo tidak boleh negatif.
- **Peringkat kompetisi:** skor sama berbagi nomor, nomor berikutnya melompat (1, 2, 2, 4). Peringkat dihitung dari seluruh Siswa, jadi tidak berubah saat mencari atau berpindah halaman.
- **Level diatur Admin** (nama dan batas XP minimal, masing-masing unik) dan **tidak punya nilai bawaan**. Level Siswa = level tertinggi yang batasnya sudah tercapai; `null` bila belum ada level atau belum ada yang tercapai.
- Pemberian XP otomatis dari materi, tugas, dan ujian belum tersambung (menunggu progres dan tugas). Layanan `XpService::award()` sudah siap dan idempoten: satu sumber hanya memberi XP sekali per Siswa.
- **Pencapaian belum ada** (aturannya belum diputuskan); tab Pencapaian tetap memakai data contoh di frontend.

### Endpoint

| Metode | Path | Izin | Keterangan |
|---|---|---|---|
| GET | `/gamification/leaderboard` | view | Papan peringkat. Filter: `q` (nama atau email), `per_page` (bawaan 15). |
| GET | `/gamification/summary` | view | Kartu ringkasan. |
| GET | `/gamification/users/{id}/xp` | view | Riwayat XP satu Siswa (terbaru di atas, paginasi) beserta `xp` dan `level` saat ini. `404` bila bukan Siswa. |
| POST | `/gamification/users/{id}/xp-adjustments` | manage | `amount` (bilangan bulat bukan 0, maksimal 1.000.000 mutlak), `reason` (3 sampai 255 karakter). Respons `201`. |
| POST | `/gamification/users/{id}/xp-reset` | manage | `reason`. Ditolak (`422`) bila XP sudah 0. Respons `200`. |
| GET | `/gamification/levels` | view | Semua level, terurut dari batas terendah (tanpa paginasi). |
| GET | `/gamification/levels/{id}` | view | Detail |
| POST | `/gamification/levels` | manage | `name`, `min_xp`. Respons `201`. |
| PATCH | `/gamification/levels/{id}` | manage | |
| DELETE | `/gamification/levels/{id}` | manage | |

### Contoh respons

`GET /gamification/leaderboard` (tab Manajemen XP):

```json
{
  "data": [
    { "rank": 1, "user": { "id": 12, "name": "Audytia Wiraadmatja", "email": "audytia@example.com" }, "xp": 3200, "level": { "id": 4, "name": "Ahli" } },
    { "rank": 2, "user": { "id": 15, "name": "Yuli Antika Sari", "email": "yuli@example.com" }, "xp": 1700, "level": { "id": 3, "name": "Mahir" } },
    { "rank": 2, "user": { "id": 18, "name": "Dentri", "email": "dentri@example.com" }, "xp": 1700, "level": { "id": 3, "name": "Mahir" } }
  ],
  "links": {},
  "meta": { "current_page": 1, "last_page": 1, "per_page": 15, "total": 3 }
}
```

`GET /gamification/summary` (tiga kartu di bawah tabel):

```json
{ "data": { "students_count": 28, "total_xp": 9250, "average_xp": 330.4, "highest_xp": 3200, "levels_count": 4 } }
```

`POST /gamification/users/{id}/xp-adjustments`:

```json
{
  "data": { "id": 7, "amount": 50, "source_type": "adjustment", "source_label": "Koreksi Admin", "source_id": null, "reason": "Juara lomba", "created_by": { "id": 1, "name": "Administrator" }, "created_at": "2026-11-05T09:30:00+07:00" },
  "xp": 130,
  "level": { "id": 2, "name": "Menengah" },
  "message": "XP berhasil dikoreksi."
}
```

`source_type` pada riwayat: `material`, `task`, `exam` (otomatis, tahap berikutnya), `adjustment`, `reset` (Admin).

## Audit

Aksi tercatat di `/audit-logs` (hanya Admin): `coupon.created`, `coupon.updated` (nilai sebelum dan sesudah), `coupon.deleted`, `xp.adjusted` (jumlah, alasan, saldo sebelum dan sesudah), `xp.reset`, `level.created`, `level.updated`, `level.deleted`.

## Layanan untuk modul lain (bukan endpoint)

- `App\Services\XpService::award($siswa, $amount, 'material'|'task'|'exam', $sourceId)`: dipanggil modul progres, tugas, dan ujian. Idempoten per (Siswa, sumber); mengembalikan `null` bila sumber itu sudah pernah memberi XP. Hanya Siswa; selain itu `XpException`.
- `App\Services\CouponService::evaluate($code, $amount, $courseId)` dan `redeem($code, $user, $amount, $courseId, $reference)`: dipanggil modul pembayaran. `redeem` atomik dan idempoten bila `$reference` (mis. id pembayaran) sama. Penolakan berupa `CouponException` dengan `reason`: `not_found`, `inactive`, `expired`, `exhausted`, `wrong_course`, `invalid_amount`.

## Yang belum ada

Endpoint pemakaian kupon oleh pembeli dan pembayaran (tahap pembayaran); voucher Lembaga (tabel sudah mendukung `owner_type=institution`); pemberian XP otomatis dari progres belajar; papan peringkat untuk Siswa; Pencapaian; hari aktif dan streak (milik dashboard).
