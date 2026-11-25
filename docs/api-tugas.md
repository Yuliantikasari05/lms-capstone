# API Tugas, Kuis, dan Ujian

Semua rute berada di bawah `/api/v1` dan sudah melewati `auth:sanctum`, `active`, dan `password.changed`.
Otorisasi dua lapis: middleware `permission:...` (hak umum) + `AssignmentPolicy` (kepemilikan kursus).

## Izin

| Izin | Admin | Mentor | Arti |
|---|---|---|---|
| `assignments.view` | ya | ya | Melihat daftar dan detail tugas |
| `assignments.manage` | ya | ya | Membuat, mengubah, menghapus, aktif/nonaktif tugas |
| `assignments.grade` | ya | ya | Melihat pengumpulan dan menyimpan nilai/feedback |
| `assignments.review` | ya | tidak | Menyetujui atau menolak ujian buatan Mentor |

Izin ini juga tampil di **Pengaturan > Role & Akses** (aktivitas "Master Tugas dan Ujian", "Penilaian dan Feedback", "Review Soal Ujian") sehingga dapat dimatikan per role. Mematikan izin membuat endpoint terkait membalas 403.

## Alur review (sesuai blueprint)

- Tugas (`task`) dan kuis (`quiz`) dari Mentor langsung berstatus `approved` dan dapat diaktifkan.
- Ujian (`exam`) dibuat berstatus `pending` (**Menunggu persetujuan**), tidak aktif, dan baru tampil setelah Admin menyetujui lewat `/assignments/{id}/review`.
- Ujian yang jenisnya diubah kembali ke `exam` pada tugas yang sudah disetujui akan menunggu review ulang.

## Endpoint

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/assignments` | Daftar tugas dari kursus yang boleh dilihat. Filter: `course_id`, `kind`, `status`, `active` (`true`/`false`), `search` (judul), `per_page` (bawaan 100). |
| POST | `/courses/{id}/assignments` | Membuat tugas beserta soal. |
| GET | `/assignments/{id}` | Detail tugas beserta soal. |
| PATCH | `/assignments/{id}` | Mengubah tugas. Soal hanya boleh diubah bila belum ada pengumpulan (jika ada, 422). |
| DELETE | `/assignments/{id}` | Soft delete. |
| PATCH | `/assignments/{id}/activation` | `is_active` (boolean). Tugas yang belum disetujui tidak dapat diaktifkan (422). |
| POST | `/assignments/{id}/review` | `decision` (`approve`/`reject`), `note?`. Butuh `assignments.review`. |
| GET | `/assignments/{id}/submissions` | Pengumpulan peserta beserta jawaban. Filter: `status` (`submitted`/`graded`). |
| GET | `/submissions/{id}` | Detail satu pengumpulan. |
| PATCH | `/submissions/{id}` | Menyimpan nilai: `score` (wajib), `feedback?`, `answers[]` (`question_id`, `points_awarded`). |

## Body membuat tugas

```json
{
  "title": "Tugas 1: Struktur HTML",
  "description": "Kerjakan semua soal.",
  "kind": "task",
  "starts_at": "2026-12-01T08:00:00+07:00",
  "due_at": "2026-12-08T23:59:00+07:00",
  "max_score": 100,
  "allow_late": true,
  "late_penalty": 10,
  "is_active": true,
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "Tag HTML untuk paragraf?",
      "options": [{ "id": 1, "text": "<p>" }, { "id": 2, "text": "<div>" }],
      "correct_option_ids": [1],
      "multi_select": false,
      "points": 40
    },
    { "type": "essay", "prompt": "Jelaskan class dan id.", "max_words": 50, "points": 60 },
    { "type": "file_upload", "prompt": "Unggah hasil latihan.", "allowed_file_types": ["PDF"], "max_file_size_mb": 20, "max_files": 2, "points": 60 }
  ]
}
```

Aturan validasi penting:

- `kind`: `task`, `quiz`, `exam`. `questions` minimal satu soal.
- Tipe soal: `multiple_choice`, `essay`, `file_upload`. Pilihan ganda butuh minimal dua opsi terisi.
- `due_at` tidak boleh lebih awal dari `starts_at`.
- `max_score` boleh dikosongkan; server menjumlahkan poin soal.

## Bentuk response

```json
{
  "id": 1,
  "course_id": 1,
  "course": { "id": 1, "title": "Dasar Pemrograman Web", "type": "academic", "type_label": "Akademik" },
  "title": "Tugas 1: Struktur HTML",
  "kind": "task",
  "kind_label": "Tugas",
  "format": "Mix",
  "status": "approved",
  "status_label": "Tersedia",
  "is_active": true,
  "questions": [{ "id": 1, "type": "multiple_choice", "type_label": "Pilihan ganda", "prompt": "...", "options": [], "correct_option_ids": [1], "points": 40 }],
  "questions_count": 2,
  "submissions_count": 3
}
```

`format` dihitung dari tipe soal: satu tipe seragam (`Essay`, `Pilihan ganda`, `Upload file`) atau `Mix` bila campuran.

## Pengumpulan dan penilaian

Response pengumpulan memuat `user`, `assignment` (judul, jenis, kursus), `status` (`submitted`/`graded`), `status_label`, `score`, `feedback`, dan `answers[]` beserta soal dan opsi jawaban (benar/dipilih dihitung klien dari `correct_option_ids` dan `selected_option_ids`).

Penyimpanan nilai mengubah status menjadi `graded`, mengisi `graded_by`/`graded_at`, dan tercatat di audit log sebagai `submission.graded`.

## Audit

`assignment.created`, `assignment.updated`, `assignment.activation`, `assignment.reviewed`, `assignment.deleted`, `submission.graded`.

## Belum ada

Pengumpulan oleh peserta dari sisi frontend (belum ada halaman Siswa/Karyawan yang memakai endpoint ini) dan pengunggahan berkas jawaban; data contoh pengumpulan dibuat oleh `DemoAssignmentSeeder`.
