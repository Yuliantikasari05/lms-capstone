# API Pengaturan: Role & Akses (Admin)

Kontrak untuk halaman **Pengaturan > Manajemen Role & Akses** (FR-14, hi-fi 3.18). Semua endpoint ada di bawah `/api/v1`, memakai cookie
sesi (login dulu). Galat mengikuti format biasa: 401 belum login, 403 tanpa izin, 404 tidak ditemukan,
422 `{ "message": "...", "errors": { "kolom": ["pesan"] } }`.

## 1. Prinsip: sakelar di matriks = izin yang benar-benar ditegakkan

- **Mematikan** sebuah sakelar membuat fiturnya **403** untuk semua akun ber-role itu, seketika (izin dibaca dari database pada tiap request).
- **Menyalakan** sakelar membuka fiturnya, dengan batas kepemilikan data bila ada (Mentor hanya kursus yang diampunya, Lembaga hanya program miliknya).
- Hal ini **dibuktikan otomatis** oleh `RbacEnforcementTest`: untuk setiap sel matriks, Admin menyalakan lalu mematikan izinnya lewat API Pengaturan yang asli,
  kemudian endpoint fiturnya dipanggil sebagai pengguna role itu (nyala = terbuka, mati = 403). Ditambah penyapu seluruh rute: role tanpa izin apa pun ditolak
  di semua rute selain rute swa-layan, dan Admin dengan semua izin tidak ditolak di rute mana pun.
- Fitur yang ada di desain tetapi **belum dibangun** (`status: "planned"`) tampil di matriks tetapi **tidak dapat dinyalakan** (`state: "unavailable"`),
  sehingga tidak ada sakelar yang tampak aktif padahal tidak mengendalikan apa pun.
- Izin hanya dapat dipasang pada role yang berhak menerimanya. Izin yang dapat menaikkan hak sendiri (kelola pengguna, kelola role, riwayat aktivitas)
  **hanya untuk Admin**: pemegang `users.update` dapat menjadikan akun sebagai Admin dan pemegang `users.reset_password` dapat mereset kata sandi Admin.
- Self-service (profil, ganti kata sandi, notifikasi, logout) tidak diatur matriks: selalu tersedia bagi semua akun yang login.

## 2. Endpoint

| Metode | URL | Izin | Keterangan |
|---|---|---|---|
| GET | `/settings/roles` | `roles.view` | Daftar role + kartu ringkasan |
| GET | `/settings/roles/{id}` | `roles.view` | Detail role + **matriks lengkap** |
| GET | `/settings/permissions` | `roles.view` | Katalog aktivitas per modul beserta role penerimanya |
| POST | `/settings/roles` | `roles.manage` | Buat role khusus (201) |
| PATCH | `/settings/roles/{id}` | `roles.manage` | Ubah nama, deskripsi, dan/atau izin ("Simpan Perubahan") |
| POST | `/settings/roles/{id}/reset` | `roles.manage` | Kembalikan role bawaan ke pengaturan awal |
| DELETE | `/settings/roles/{id}` | `roles.manage` | Hapus role khusus |

`GET /roles` (daftar sederhana untuk dropdown) tetap ada dan tidak berubah.

### GET /settings/roles

```json
{
  "data": [{
    "id": 2, "slug": "mentor", "name": "Mentor", "description": null,
    "is_system": true, "can_rename": false, "can_delete": false,
    "users_count": 4, "permissions_count": 1, "assignable_count": 5,
    "required_permissions": ["dashboard.mentor"]
  }],
  "summary": { "total_roles": 5, "total_users": 28, "custom_roles": 0 }
}
```

### GET /settings/roles/{id}

`data` sama seperti di atas ditambah `permissions` (daftar slug yang dimiliki). Kunci `matrix` berisi modul, aktivitas, dan sel C/R/U/D:

```json
{
  "data": { "id": 2, "slug": "mentor", "permissions": ["dashboard.mentor"], "required_permissions": ["dashboard.mentor"], "...": "..." },
  "columns": ["create", "read", "update", "delete"],
  "matrix": [{
    "key": "curriculum", "name": "Kurikulum dan Kursus",
    "editable_count": 4, "granted_count": 1, "all_granted": false,
    "activities": [{
      "key": "courses", "label": "Kursus yang Saya Ampu", "description": "Membuat dan mengelola kursus yang diampu sendiri.",
      "status": "active", "note": null, "scope": "own",
      "cells": [
        { "action": "create", "slug": "courses.create", "state": "off", "granted": false, "editable": true,  "shared": false, "sensitive": false, "reason": null },
        { "action": "read",   "slug": "courses.view",   "state": "on",  "granted": true,  "editable": true,  "shared": true,  "sensitive": false, "reason": null },
        { "action": "update", "slug": "courses.update", "state": "off", "granted": false, "editable": true,  "shared": false, "sensitive": false, "reason": null },
        { "action": "delete", "slug": null,             "state": "na",  "granted": false, "editable": false, "shared": false, "sensitive": false, "reason": null }
      ]
    }]
  }]
}
```

Arti `state` pada sel:

| state | Arti | Tampilan yang disarankan |
|---|---|---|
| `on` | Izin menyala, dapat dimatikan | Sakelar hidup |
| `off` | Izin mati, dapat dinyalakan | Sakelar mati |
| `locked` | Menyala dan **wajib** (tidak dapat dimatikan) | Sakelar hidup, dikunci |
| `unavailable` | Ada di desain tetapi fiturnya belum dibangun (`reason` berisi penjelasan) | Abu-abu, tidak dapat diklik |
| `na` | Kolom ini tidak ada untuk aktivitas/role tersebut | Sel kosong (seperti di hi-fi) |

Catatan untuk frontend:
- **`shared: true`**: beberapa sel memakai izin backend yang sama (mis. membuat, ubah, dan hapus modul dan sesi = `content.manage`; dua baris dashboard = `dashboard.admin`).
  Simpan status sakelar **berdasarkan `slug`**, bukan per sel, sehingga sel-sel itu otomatis bergerak bersama.
- **`scope: "own"`**: role hanya mengakses data miliknya (kursus yang diampu, program lembaga sendiri). Tampilkan keterangan "hanya data milik sendiri".
- **`sensitive: true`**: izin menyangkut uang atau akun (mis. `institutions.payout`, `users.delete`); tampilkan peringatan sebelum menyalakan.
- **Sakelar "Semua"** per modul: hidupkan bila `all_granted` true. Menekannya berarti menyalakan/mematikan semua `slug` berstatus `on`/`off` pada modul itu (jangan sentuh `locked` dan `unavailable`).
- Kotak pencarian "Cari permission" dapat disaring di klien dari `label`, `description`, dan `slug`.

### PATCH /settings/roles/{id}  ("Simpan Perubahan")

```json
{ "permissions": ["dashboard.mentor", "courses.view", "content.manage"] }
```

`permissions` adalah **daftar lengkap** izin yang diinginkan (menggantikan yang lama): kirim semua slug yang berstatus menyala setelah Admin selesai mengubah, termasuk yang `locked`.
`name` dan `description` opsional (nama role bawaan tidak dapat diubah). Respons 200 sama dengan `GET /settings/roles/{id}` (matriks terbaru) ditambah `message`.

Galat 422 pada `errors.permissions` (setiap kalimat menyebut izin dan alasannya):
- izin tidak dikenal atau fiturnya belum tersedia;
- izin tidak berlaku untuk role itu (mis. `coupons.view` untuk Mentor);
- izin wajib role tidak boleh dicabut.

Tidak ada perubahan yang tersimpan bila ada satu izin pun yang ditolak.

### POST /settings/roles  dan  DELETE /settings/roles/{id}

`POST` body `{ "name": "Staf Kupon", "description": "...", "permissions": ["coupons.view"] }` (201, respons seperti detail). Role khusus hanya menerima izin yang tidak bergantung pada
kepemilikan data (lihat tabel "Role khusus" di bawah). Slug dibuat otomatis dari nama dan tidak berubah saat nama diganti. Nama role unik tanpa membedakan huruf besar-kecil.
`DELETE` hanya untuk role khusus yang tidak dipakai pengguna mana pun (422 bila masih dipakai atau role bawaan).

### POST /settings/roles/{id}/reset

Mengembalikan izin **role bawaan** ke pengaturan awal sistem. 422 untuk role khusus. Dicatat sebagai `role.reset`.

## 3. Pengaman

| Aturan | Akibat |
|---|---|
| Admin boleh dikurangi izinnya, tetapi `dashboard.admin`, `roles.view`, `roles.manage` wajib tetap | Admin tidak bisa mengunci dirinya dari Pengaturan; pemulihan selalu lewat UI |
| Setiap role bawaan wajib memegang dashboard-nya (`dashboard.<role>`) | Pengguna tetap bisa masuk ke halaman utamanya |
| Role bawaan tidak dapat dihapus atau diganti namanya | Badge "System" |
| Izin kelola pengguna, riwayat aktivitas, dan kelola role hanya untuk Admin | Mencegah eskalasi hak lewat role khusus |
| Role khusus tidak menerima izin kursus/modul/peserta | Izin itu bergantung pada kepemilikan data sehingga sakelarnya tidak akan berfungsi |
| Fitur belum dibangun tidak dapat dinyalakan | Tidak ada sakelar palsu |

## 4. Seeder dan pemulihan

- `php artisan db:seed --class=RolePermissionSeeder` **tidak lagi menimpa** pengaturan Admin. Seeder membuat permission baru dan hanya memberi izin bawaan yang
  **baru dibuat** pada eksekusi itu (mis. fitur baru) kepada role yang sudah ada; izin yang sengaja dimatikan tidak dinyalakan lagi. Role baru mendapat seluruh izin bawaan.
- Mengembalikan role bawaan: tombol "Atur ulang" (`POST /settings/roles/{id}/reset`) atau terminal:
  ```
  php artisan lms:reset-role-permissions --role=admin     (atau mentor, siswa, karyawan, lembaga, all)
  php artisan lms:reset-role-permissions --prune          (cabut izin yang tidak sah pada semua role)
  ```
  `--prune` berguna untuk data lama: mencabut izin yang tidak dikenal, belum tersedia, atau tidak berlaku untuk role itu (mis. `users.create` yang pernah diberikan ke role khusus).
- Izin bawaan: Mentor memegang `dashboard.mentor` beserta izin kursusnya (`courses.view`, `courses.create`, `courses.update`, `content.manage`); Siswa, Karyawan, dan Lembaga hanya memegang dashboard-nya. Admin menyalakan fitur lain lewat matriks.

## 5. Audit log

`role.created`, `role.updated`, `role.reset`, `role.deleted`. Catatan memuat nama role di `changes.role` dan, untuk perubahan izin, `permissions_added` dan `permissions_removed`.

## 6. Matriks izin per role

Tabel di bawah dihasilkan dari katalog kode (`App\Support\Rbac\Catalog`). Kolom C/R/U/D mengikuti hi-fi 3.18. Isi sel adalah izin yang ditegakkan backend;
`(wajib)` tidak dapat dimatikan; `(belum)` fiturnya belum dibangun sehingga tidak dapat dinyalakan; `·` kolom tidak ada. Sel dengan izin yang sama bergerak bersama.

### Admin

**Dashboard**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Dashboard Admin | · | `dashboard.admin` (wajib) | · | · |
| Lihat Statistik Platform | · | `dashboard.admin` (wajib) | · | · |

**Manajemen Pengguna**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Pengguna | `users.create` | `users.view` | `users.update` | `users.delete` |
| Ekspor Data Pengguna | · | `users.export` | · | · |
| Reset Kata Sandi Pengguna | · | · | `users.reset_password` | · |
| Riwayat Aktivitas | · | `audit.view` | · | · |

**Kurikulum dan Kursus**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Kursus dan Kurikulum | `courses.create` | `courses.view` | `courses.update` | `courses.delete` |
| Modul dan Materi | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Sesi dan Live | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Penunjukan Mentor | · | · | `courses.assign_mentor` | · |
| Peserta Kursus | `enrollments.manage` | `enrollments.manage` | · | `enrollments.manage` |
| Kelola Diskusi dan Komentar | (belum) | (belum) | (belum) | (belum) |
| Review Soal Ujian | · | (belum) | (belum) | · |
| Sertifikasi Karyawan | · | (belum) | (belum) | · |

**Manajemen Kupon**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Kupon | `coupons.create` | `coupons.view` | `coupons.update` | `coupons.delete` |

**Gamifikasi dan XP**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Papan Peringkat | · | `gamification.view` | · | · |
| Kelola XP Pengguna | · | · | `gamification.manage` | `gamification.manage` |
| Level | `gamification.manage` | `gamification.view` | `gamification.manage` | `gamification.manage` |
| Kelola Achievement | (belum) | (belum) | (belum) | (belum) |
| Kelola Misi Harian | (belum) | (belum) | (belum) | (belum) |

**Lembaga Bimbingan**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Lembaga Bimbingan | `institutions.create` | `institutions.view` | `institutions.update` | `institutions.delete` |
| Pencairan Dana Lembaga | `institutions.payout` | · | `institutions.payout` | · |

**Setting**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Pengaturan Sistem | · | (belum) | (belum) | · |
| Kelola Role dan Permission | `roles.manage` (wajib) | `roles.view` (wajib) | `roles.manage` (wajib) | `roles.manage` (wajib) |

### Mentor

**Dashboard**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Dashboard Mentor | · | `dashboard.mentor` (wajib) | · | · |

**Kurikulum dan Kursus**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Kursus yang Saya Ampu | `courses.create` | `courses.view` | `courses.update` | · |
| Modul dan Materi | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Sesi dan Live | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Kelola Diskusi dan Komentar | (belum) | (belum) | (belum) | (belum) |

**Tugas dan Ujian**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Master Tugas dan Ujian | (belum) | (belum) | (belum) | (belum) |
| Penilaian dan Feedback | · | (belum) | (belum) | · |

**Siswa**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Siswa yang Diampu | · | (belum) | · | · |

### Siswa

**Dashboard**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Dashboard Siswa | · | `dashboard.siswa` (wajib) | · | · |

**Pembelajaran**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Jadwal dan Deadline | · | (belum) | · | · |
| Papan Peringkat | · | (belum) | · | · |
| Kelas dan Materi yang Diikuti | · | (belum) | · | · |
| Laporan Belajar | · | (belum) | · | · |

**Tugas dan Ujian**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Tugas dan Evaluasi | (belum) | (belum) | · | · |

**Pembayaran dan Sertifikat**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Pembayaran Kelas | (belum) | · | · | · |

### Karyawan

**Dashboard**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Dashboard Karyawan | · | `dashboard.karyawan` (wajib) | · | · |

**Pembelajaran**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Kelas dan Materi yang Diikuti | · | (belum) | · | · |
| Laporan Belajar | · | (belum) | · | · |

**Tugas dan Ujian**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Tugas dan Evaluasi | (belum) | (belum) | · | · |

**Pembayaran dan Sertifikat**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Pembayaran Kelas | (belum) | · | · | · |
| Pengajuan Sertifikat | (belum) | (belum) | · | · |

### Lembaga Bimbingan

**Dashboard**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Dashboard Lembaga Bimbingan | · | `dashboard.lembaga` (wajib) | · | · |

**Kurikulum dan Kursus**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Program Lembaga Saya | · | `courses.view` | `courses.update` | · |
| Modul dan Materi | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Sesi dan Live | `content.manage` | `courses.view` | `content.manage` | `content.manage` |
| Kelola Diskusi dan Komentar | (belum) | (belum) | (belum) | (belum) |

**Pengelolaan Lembaga**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Kelola Siswa Lembaga | · | (belum) | · | · |
| Voucher Lembaga | (belum) | (belum) | (belum) | (belum) |
| Atur Harga Modul | · | (belum) | (belum) | · |
| Profil Lembaga | · | (belum) | (belum) | · |
| Laporan Keuangan dan Jelajahi | · | (belum) | · | · |

### Role khusus (buatan Admin)

**Manajemen Kupon**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Kupon | `coupons.create` | `coupons.view` | `coupons.update` | `coupons.delete` |

**Gamifikasi dan XP**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Lihat Papan Peringkat | · | `gamification.view` | · | · |
| Kelola XP Pengguna | · | · | `gamification.manage` | `gamification.manage` |
| Level | `gamification.manage` | `gamification.view` | `gamification.manage` | `gamification.manage` |

**Lembaga Bimbingan**

| Aktivitas | C | R | U | D |
|---|---|---|---|---|
| Data Lembaga Bimbingan | `institutions.create` | `institutions.view` | `institutions.update` | `institutions.delete` |
| Pencairan Dana Lembaga | `institutions.payout` | · | `institutions.payout` | · |


## 7. Menambah fitur atau izin baru (untuk developer)

1. Tambahkan izin di `RolePermissionSeeder::PERMISSIONS` (dan izin bawaan di `MATRIX` bila perlu).
2. Daftarkan aktivitasnya di `Catalog::activities()`: status `active`, slug tiap sel C/R/U/D, dan role penerimanya. Fitur yang belum dibangun didaftarkan dengan `planned`.
3. Jaga endpoint dengan `middleware('permission:...')` atau policy.
4. Tambahkan probe di `RbacEnforcementTest::probes()` dan `cellProbes()`. Test akan gagal bila izin aktif tidak punya probe, dan penyapu rute akan gagal bila ada rute baru
   yang tidak dijaga izin (kecuali didaftarkan di `SELF_SERVICE`).
5. Untuk mengaktifkan fitur planned: ubah statusnya menjadi `active`, isi slug sel, lalu lakukan langkah 1 sampai 4.
