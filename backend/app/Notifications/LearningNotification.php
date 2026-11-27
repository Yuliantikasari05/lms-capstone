<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Notifikasi dalam aplikasi (channel database). Dipakai untuk memberi tahu tiap peran tentang
 * pekerjaannya: peserta (nilai, jadwal, pencapaian), Mentor (pengumpulan, peserta, keputusan Admin),
 * dan Admin (ujian menunggu review, kursus baru dari Mentor).
 *
 * Bentuk data mengikuti kontrak frontend (lib/notifications.ts): kategori, judul, pesan,
 * pengirim, label aksi, dan tautan tujuan di aplikasi.
 */
class LearningNotification extends Notification
{
    public const CATEGORY_ASSESSMENT = 'assessment';
    public const CATEGORY_SCHEDULE = 'schedule';
    public const CATEGORY_ACHIEVEMENT = 'achievement';
    public const CATEGORY_SYSTEM = 'system';
    public const CATEGORY_SUBMISSION = 'submission';
    public const CATEGORY_ROSTER = 'roster';

    public function __construct(
        public string $category,
        public string $title,
        public string $message,
        public string $actorName = 'Sistem',
        public string $actorRole = 'Sistem',
        public ?string $actionLabel = null,
        public ?string $href = null,
    ) {}

    /** @return array<int,string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string,string|null> */
    public function toArray(object $notifiable): array
    {
        return [
            'category' => $this->category,
            'title' => $this->title,
            'message' => $this->message,
            'actor_name' => $this->actorName,
            'actor_role' => $this->actorRole,
            'action_label' => $this->actionLabel,
            'href' => $this->href,
        ];
    }
}
