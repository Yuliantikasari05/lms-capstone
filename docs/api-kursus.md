# API Kursus (Tahap 2)

Kontrak API modul kursus untuk tim frontend. Semua endpoint berada di bawah `/api/v1`, memakai login cookie (Sanctum) seperti modul lain, dan hanya dapat diakses akun yang `must_change_password`-nya sudah false. Pesan error dalam bahasa Indonesia; kesalahan validasi berbentuk `422 { message, errors: { kolom: [pesan] } }`.

Istilah di desain "kurikulum" dan "kursus" dimaksudkan sama; di kode dan UI selalu **kursus**.

## Siapa boleh apa

Dua lapis, sesuai docs: **permission** (izin umum role) dan **kepemilikan** (CoursePolicy).

| Kemampuan | Permission | Admin | Mentor (nanti) | Lembaga (tahap 4) |
|---|---|---|---|---|
| Lihat daftar/detail | `courses.view` | semua kursus | hanya yang diampu | hanya program miliknya |
| Buat kursus | `courses.create` | ya (menunjuk Mentor) | ya (otomatis jadi pengampu) | - |
| Ubah kursus | `courses.update` | ya | hanya miliknya | hanya miliknya |
| Hapus kursus | `courses.delete` | ya | tidak | - |
| Tetapkan/ganti Mentor | `courses.assign_mentor` | ya | tidak | - |
| Modul, materi, sesi | `content.manage` | ya | hanya miliknya | hanya miliknya |
| Peserta | `enrollments.manage` | ya | tidak | - |

Sekarang semua permission hanya dimiliki Admin. Aturan kepemilikan untuk Mentor dan Lembaga sudah ditulis dan diuji, tetapi izinnya baru diberikan saat halaman role itu dikerjakan.

Program Lembaga (`type=institution`) tampil di daftar Admin tetapi **hanya-baca**: ubah, hapus, konten, dan peserta ditolak 403 ("Program Lembaga hanya dapat diubah oleh lembaganya.").

Setiap kursus di response memuat `abilities` (`update`, `delete`, `assign_mentor`, `manage_content`, `manage_enrollments`) untuk menonaktifkan tombol. Backend tetap yang menentukan.

## Aturan bisnis

- Jenis: `academic` (Siswa, ada XP), `training` dan `webinar` (Karyawan, tanpa XP), `institution` (Program Lembaga, dibuat Lembaga). Form manajemen hanya boleh membuat tiga jenis pertama. **Jenis tidak dapat diubah.**
- Status: `draft`, `active`, `inactive`. Mengaktifkan kursus butuh Mentor; kursus aktif tidak boleh kehilangan Mentor.
- Hapus kursus = soft delete, ditolak bila masih ada peserta aktif (nonaktifkan saja).
- Mentor yang masih mengampu kursus draf/aktif tidak dapat dihapus atau diubah rolenya (`/users`).
- Peserta: Akademik hanya Siswa, Pelatihan dan Webinar hanya Karyawan. Akun harus aktif. Satu akun satu kali per kursus; pencabutan mengubah status menjadi `cancelled` (riwayat tetap), mendaftar ulang mengaktifkannya lagi.
- XP materi hanya untuk kursus akademik (0 sampai 100).
- Instruktur sesi = Mentor kursus. Tipe sesi mengikuti jenis kursus (Kelas, Pelatihan, Webinar). Waktu selesai harus setelah waktu mulai.

## Endpoint

### Kursus

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/courses` | Filter: `q` (judul atau nama Mentor), `type`, `status`, `mentor_id`, `per_page` (1 sampai 100, bawaan 12). Terbaru di atas. Memuat `modules_count`, `sessions_count`, `participants_count` (peserta aktif). |
| POST | `/courses` | `type`, `title`, `description?`, `status?` (draft/active), `mentor_id?` |
| GET | `/courses/{id}` | Detail |
| PATCH | `/courses/{id}` | `title`, `description`, `status`. `type` dan `mentor_id` ditolak. |
| PUT | `/courses/{id}/mentor` | `mentor_id` (wajib dikirim; `null` = cabut, hanya untuk kursus belum aktif) |
| DELETE | `/courses/{id}` | Soft delete |

### Modul dan materi

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/courses/{id}/modules` | Modul beserta materinya, terurut |
| POST | `/courses/{id}/modules` | `title` |
| PATCH / DELETE | `/modules/{id}` | |
| PUT | `/courses/{id}/modules/order` | `ids`: seluruh id modul kursus dalam urutan baru |
| POST | `/modules/{id}/materials` | **multipart/form-data**. `title`, `type` (`video` `pdf` `document` `link`), `description?`, `file` atau `external_url` sesuai tipe, `duration_minutes?` (video), `xp_points?` (akademik) |
| PATCH | `/materials/{id}` | Tipe tidak dapat diubah. Bila menyertakan file baru, kirim `POST` dengan `_method=PATCH` (PHP tidak membaca multipart pada PATCH). |
| DELETE | `/materials/{id}` | Soft delete (file fisik dibersihkan perintah `lms:purge-material-files`) |
| PUT | `/modules/{id}/materials/order` | `ids` |
| GET | `/materials/{id}/file` | Unduh/tampilkan file (berizin). Path penyimpanan tidak pernah dikirim ke klien. |

Aturan file: PDF `pdf`; dokumen `doc docx ppt pptx xls xlsx txt csv`; video `mp4 webm` atau tautan; tautan hanya `http`/`https`. Ukuran maksimal dari `LMS_UPLOAD_MAX_KB` (bawaan 50 MB). Server (php.ini, Nginx, Cloudflare) harus mengizinkan ukuran yang sama.

### Sesi

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/courses/{id}/sessions` | Terurut waktu mulai. Memuat `status`: `upcoming` `ongoing` `finished`. |
| POST | `/courses/{id}/sessions` | `title`, `starts_at`, `ends_at` (ISO 8601; diubah ke zona waktu aplikasi), `meeting_url` |
| GET / PATCH / DELETE | `/sessions/{id}` | `meeting_url` hanya muncul bagi yang berhak mengelola |
| GET | `/sessions/{id}/meeting-link` | Tautan meeting, diambil saat diperlukan (bukan ikut di daftar) |

### Peserta

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/courses/{id}/enrollments` | Filter: `q`, `status` (`active` bawaan, `cancelled`, `all`), `per_page` |
| GET | `/courses/{id}/enrollment-candidates` | Akun yang boleh didaftarkan (role sesuai, aktif, belum terdaftar) |
| POST | `/courses/{id}/enrollments` | `user_ids` (semua-atau-tidak-sama-sekali; kesalahan per indeks `user_ids.N`) |
| DELETE | `/enrollments/{id}` | Mencabut (status `cancelled`) |

## Audit

Aksi yang dicatat di `/audit-logs`: `course.created`, `course.updated` (nilai sebelum/sesudah), `course.deleted`, `course.mentor_assigned`, serta aksi modul, materi, sesi, dan peserta. Kata sandi dan isi file tidak pernah dicatat.

## Yang belum ada (tahap berikutnya)

Progres materi, tombol "Gabung sesi" dan kehadiran peserta (Tahap 2b); tugas dan ujian (Tahap 3); Program Lembaga (Tahap 4); XP dan leaderboard (Tahap 5); sertifikat (Tahap 6). Tab Diskusi menunggu keputusan cakupan forum.
