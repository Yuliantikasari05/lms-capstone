# API Belajar Siswa

Semua rute berada di bawah `/api/v1/siswa` dan sudah melewati `auth:sanctum`, `active`, dan `password.changed`.
Otorisasi dua lapis: middleware `permission:...` (hak umum) + pemeriksaan role **Siswa** di controller.
Data selalu milik peserta yang sedang login — tidak ada parameter `user_id` dari klien.

Bedanya dengan endpoint staff (`/courses`, `/assignments`, `/sessions`): endpoint di sini hanya mengembalikan data
pada **kursus yang diikuti dengan enrollment aktif**, dan peserta tidak pernah menerima kunci jawaban atau data peserta lain.

## Izin

| Izin | Arti |
|---|---|
| `learning.view` | Melihat kursus, materi, dan progres belajar sendiri |
| `learning.progress` | Menandai materi selesai, mencatat menit belajar, dan hari aktif |
| `assignments.submit` | Melihat dan mengumpulkan tugas/kuis/ujian sendiri |
| `schedule.view` | Melihat jadwal sesi bimbingan dan tenggat tugas |
| `schedule.join` | Mencatat kehadiran pada sesi bimbingan |
| `leaderboard.view` | Melihat papan peringkat |
| `reports.view` | Melihat laporan belajar bulanan |

Ketujuh izin di atas hanya diberikan ke role **Siswa** (aktivitas "Belajar Mandiri", "Progres Materi", "Pengumpulan Tugas Siswa",
"Jadwal Belajar", "Kehadiran Sesi", "Papan Peringkat", "Laporan Belajar") sehingga dapat dimatikan per role lewat
**Pengaturan > Role & Akses**. Mematikan izin membuat endpoint terkait membalas 403.
Siswa yang enroll-nya nonaktif tidak melihat kursus tersebut dan mendapat 403 saat membuka detailnya.

## Aturan yang diterapkan

- **XP materi** diberikan sekali saat materi ditandai selesai (idempoten).
- **XP tugas/kuis** diberikan saat pengumpulan; **XP ujian** diberikan saat Mentor menyimpan nilai (bukan saat dikumpulkan).
- Pilihan ganda dinilai otomatis (`points_awarded`), tetapi status pengumpulan tetap `Dikumpulkan` sampai Mentor menilai.
- Pengumpulan setelah tenggat ditolak bila `allow_late = false`; bila diizinkan, `is_late` bernilai true dan
  `late_penalty` disimpan pada tugas.
- **Gabung sesi** hanya aktif 15 menit sebelum sesi dimulai sampai sesi selesai; setiap keberhasilan dicatat sebagai kehadiran.
- **Menit belajar** hanya bertambah dari sinyal heartbeat halaman materi (1 menit per panggilan, minimal 60 detik sejak sinyal terakhir).
- **Hari aktif** dicatat saat login (dan saat heartbeat) sehingga streak tidak bisa dinaikkan dengan banyak request.

## Endpoint

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/siswa/summary` | Ringkasan dashboard: progres kursus utama, streak, level, sesi mendatang, tugas menunggu, 5 besar peringkat. |
| GET | `/siswa/courses` | Kursus yang diikuti beserta progres, XP, dan menit belajar bulan ini. |
| GET | `/siswa/courses/{course}` | Detail kursus: modul, materi, status selesai, dan tautan berkas. 403 bila bukan peserta aktif. |
| POST | `/siswa/materials/{material}/complete` | Menandai materi selesai dan memberi XP (idempoten). |
| POST | `/siswa/materials/{material}/study` | Heartbeat menit belajar. Tanpa body; menambah 1 menit (ditolak bila <60 detik sejak sinyal terakhir). |
| GET | `/siswa/assignments` | Tugas/kuis/ujian yang tersedia beserta status pengumpulan sendiri. |
| GET | `/siswa/assignments/{assignment}` | Detail tugas + soal (tanpa kunci jawaban) + jawaban yang sudah dikirim. |
| POST | `/siswa/assignments/{assignment}/submissions` | Mengumpulkan jawaban; memberi XP tugas/kuis. 422 bila sudah dikumpulkan atau lewat tenggat. |
| GET | `/siswa/schedule` | Sesi bimbingan (`can_join`, `time_status`) dan tenggat tugas terdekat. |
| POST | `/siswa/sessions/{session}/join` | Mencatat kehadiran; membalas `meeting_url`/`location`. 422 di luar jendela waktu. |
| GET | `/siswa/leaderboard?period=week\|month\|all` | Papan peringkat XP; `is_me` menandai baris sendiri. |
| GET | `/siswa/report?month=YYYY-MM` | Laporan bulanan: menit belajar, hari aktif, 12 bulan terakhir, performa mapel, tugas, sesi, pencapaian. |

## Contoh body

```json
POST /api/v1/siswa/assignments/12/submissions
{
  "answers": [
    { "question_id": 31, "selected_option_ids": [1] },
    { "question_id": 32, "answer_text": "Jawaban essay saya." }
  ]
}
```

```
POST /api/v1/siswa/materials/45/study
```

## Bentuk respons penting

`GET /siswa/assignments` (satu baris):

```json
{
  "id": 12,
  "title": "Tugas 1: Struktur HTML dan CSS",
  "kind": "task",
  "kind_label": "Tugas",
  "course_title": "Dasar Pemrograman Web",
  "mentor_name": "Rina Kusumawati",
  "due_at": "2026-12-03T23:59:00+07:00",
  "xp_points": 20,
  "submission": {
    "status": "selesai",
    "label": "Selesai",
    "submitted_at": "2026-11-24T10:00:00+07:00",
    "score": 85,
    "is_late": false,
    "feedback": "Jawaban sudah baik."
  }
}
```

`status` pengumpulan selalu salah satu dari `belum`, `dikumpulkan`, `selesai` — baik di daftar maupun di detail.

`POST /siswa/sessions/{id}/join`:

```json
{
  "message": "Kehadiran tercatat.",
  "data": {
    "attendance_id": 4,
    "joined_at": "2026-11-29T08:50:00+07:00",
    "meeting_url": "https://meet.google.com/...",
    "location": null
  }
}
```

## Data demo

```bash
php artisan db:seed --class=DemoLearningSeeder
```

Seeder ini (hanya `local`/`testing`) melengkapi akun `adi.saputra@demo.test`: enrollment aktif pada
**Dasar Pemrograman Web** dan **Matematika Dasar SMP**, beberapa materi selesai, log belajar enam bulan,
hari aktif, satu sesi lampau yang dihadiri, dan pengumpulan tugas yang sudah dinilai. Aman dijalankan berulang.

Papan peringkat dan level memakai data gamifikasi; jalankan `php artisan db:seed --class=DemoGamificationSeeder`
bila tabel `levels` masih kosong (level contoh hanya dibuat bila belum ada level sama sekali).
