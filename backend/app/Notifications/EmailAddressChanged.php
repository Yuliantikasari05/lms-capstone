<?php

namespace App\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Dikirim ke email LAMA saat Admin mengganti email sebuah akun, agar pemilik akun mengetahuinya.
 * Email baru disamarkan; identitas Admin tidak ditampilkan.
 */
class EmailAddressChanged extends Notification
{
    public function __construct(
        public string $newEmail,
        public CarbonInterface $changedAt,
    ) {}

    /** @return array<int,string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $when = $this->changedAt->copy()->timezone(config('app.timezone'))->format('d/m/Y H:i');

        return (new MailMessage)
            ->subject('Email akun LMS Anda diubah')
            ->greeting('Halo,')
            ->line("Alamat email akun LMS Anda diubah oleh Administrator pada {$when} ({$this->timezoneLabel()}).")
            ->line('Email baru: '.self::mask($this->newEmail))
            ->line('Jika Anda tidak mengharapkan perubahan ini, segera hubungi Administrator.');
    }

    /** "budi.santoso@gmail.com" menjadi "bu***@gmail.com". */
    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return mb_substr($local, 0, 2).'***'.($domain !== '' ? '@'.$domain : '');
    }

    private function timezoneLabel(): string
    {
        return (string) config('app.timezone');
    }
}
