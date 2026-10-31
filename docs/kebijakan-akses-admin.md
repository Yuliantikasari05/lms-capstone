# Kebijakan Akses Admin dan Perlindungan Akun

Dokumen ini menjelaskan bagaimana sistem membatasi, mencatat, dan mempertanggungjawabkan akses Admin terhadap akun pengguna. Ditulis 30 Oktober 2026. Bukan nasihat hukum; kesesuaian dengan UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022) perlu ditinjau oleh pihak yang berwenang.

## Prinsip

1. **Admin tidak mengetahui kata sandi akhir pengguna.** Admin tidak pernah memilih atau mengetik kata sandi pengguna.
2. **Akses secukupnya (least privilege).** Setiap kemampuan sensitif punya izin tersendiri: `users.reset_password`, `users.export`, `audit.view`. Saat ini hanya Admin yang memilikinya.
3. **Setiap tindakan tercatat.** Siapa, apa, kepada siapa, kapan, dan dari alamat IP mana.
4. **Catatan tidak dapat diubah.** Aplikasi menolak mengubah atau menghapus catatan audit.
5. **Pemilik akun diberi tahu** ketika emailnya diubah.
6. **Transparan.** Pengguna diberi tahu bahwa akun mereka dikelola Admin dan bahwa tindakan pengelolaan dicatat (layar ganti kata sandi dan halaman Profil).

## Alur kata sandi

| Situasi | Yang terjadi |
| --- | --- |
| Admin membuat akun | Sistem membuat kata sandi sementara acak (14 karakter). Ditampilkan **sekali** kepada Admin untuk disampaikan ke pemilik. Akun ditandai wajib ganti kata sandi. |
| Pemilik login pertama kali | Hanya dapat membuka layar ganti kata sandi. Semua endpoint lain ditolak (403) sampai kata sandi diganti. |
| Pemilik mengganti kata sandi | Kata sandi sementara tidak berlaku lagi. Perangkat lain dikeluarkan. Sejak saat ini tidak seorang pun, termasuk Admin, dapat mengetahuinya (hanya hash yang tersimpan). |
| Pemilik lupa kata sandi | Admin memakai "Reset kata sandi": kata sandi sementara baru, pengguna dikeluarkan dari semua perangkat, wajib ganti lagi. Admin tidak dapat mereset akunnya sendiri. |
| Admin ingin mengubah kata sandi lewat form ubah | Tidak bisa. Server menolak (422). |

Keterbatasan yang diketahui: antara saat Admin menyampaikan kata sandi sementara dan saat pemilik menggantinya, Admin secara teknis dapat login memakai kata sandi itu. Risikonya dikurangi oleh pencatatan, pembatasan akun sementara, dan (rencana) masa berlaku kata sandi sementara.

## Yang dicatat di riwayat aktivitas

| Aksi | Isi catatan |
| --- | --- |
| `user.created` | nama, email, role, status awal |
| `user.updated` | hanya bidang yang berubah (nama, email, status, role): nilai sebelum dan sesudah |
| `user.deleted`, `user.restored` | akun yang dihapus atau dipulihkan |
| `user.password_reset` | bahwa reset terjadi (**tanpa** kata sandi) |
| `user.exported` | filter yang dipakai dan jumlah baris |
| `auth.password_changed` | bahwa pemilik mengganti kata sandinya (**tanpa** kata sandi) |

Setiap catatan menyimpan: pelaku (id, nama, email sebagai salinan), target, alamat IP, user agent, dan waktu. Kata sandi dan hash-nya tidak pernah disimpan; kunci yang mengandung kata "password" otomatis dibuang. Catatan tetap terbaca walaupun akun pelaku atau target kemudian diubah atau dihapus.

## Perubahan email

Email adalah jalur pemulihan akun, sehingga perubahannya sensitif. Ketika Admin mengganti email, pemberitahuan dikirim ke **email lama**. Email baru ditampilkan sebagian (`bu***@domain`), dan identitas Admin tidak disebutkan. Jika pengiriman gagal, perubahan tetap tersimpan dan kegagalan dicatat di log aplikasi.

## Hal yang masih terbuka (perlu keputusan pemilik proyek)

- **Lama penyimpanan riwayat aktivitas.** Saat ini disimpan tanpa batas waktu. Catatan memuat email (data pribadi), sehingga perlu ditetapkan masa simpan.
- **Masa berlaku kata sandi sementara.** Saat ini tidak kedaluwarsa. Usulan: 48 jam, lalu Admin harus mereset ulang.
- **Pengendali data pribadi.** Pihak yang secara hukum menjadi pengendali (Maxy Academy, mitra, atau kampus) perlu ditegaskan.
- **Pengiriman email sungguhan.** Default pengembangan hanya menulis email ke log. Di server perlu SMTP (`MAIL_MAILER=smtp`).
- **Alternatif undangan email.** Setelah SMTP tersedia, kata sandi sementara bisa diganti tautan undangan sekali pakai sehingga Admin tidak perlu melihat kata sandi sama sekali.
