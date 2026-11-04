<?php

namespace App\Support;

use App\Models\Course;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Penyimpanan file materi. File disimpan di disk PRIVAT (bukan folder publik) dengan nama acak;
 * nama asli hanya disimpan sebagai metadata untuk ditampilkan. Pengunduhan selalu lewat endpoint berizin.
 */
class MaterialFiles
{
    public const DIRECTORY = 'course-materials';

    /** MIME yang dikirim saat file ditampilkan/diunduh, hanya untuk jenis yang diizinkan (sama dengan validasi upload). */
    private const MIME_BY_EXTENSION = [
        'pdf' => 'application/pdf',
        'mp4' => 'video/mp4',
        'webm' => 'video/webm',
        'txt' => 'text/plain',
        'csv' => 'text/csv',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    public static function disk(): Filesystem
    {
        return Storage::disk((string) config('lms.uploads.disk', 'local'));
    }

    /**
     * @return array{file_path:string,file_name:string,file_size:int,mime_type:string}
     */
    public function store(UploadedFile $file, Course $course): array
    {
        $extension = strtolower((string) ($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'bin'));
        // MIME diturunkan dari ekstensi yang sudah lolos validasi isi file (bukan dari input pengguna),
        // sehingga selalu salah satu jenis yang diizinkan dan benar untuk pemutar/penampil di browser.
        $mime = self::MIME_BY_EXTENSION[$extension] ?? 'application/octet-stream';
        $size = (int) $file->getSize();
        $name = $this->cleanName($file->getClientOriginalName(), $extension);

        $path = self::disk()->putFileAs(self::DIRECTORY.'/'.$course->id, $file, Str::random(40).'.'.$extension);

        return ['file_path' => (string) $path, 'file_name' => $name, 'file_size' => $size, 'mime_type' => $mime];
    }

    public function delete(?string $path): void
    {
        if ($path !== null && $path !== '' && self::disk()->exists($path)) {
            self::disk()->delete($path);
        }
    }

    /** Nama tampilan yang aman (tanpa path dan karakter aneh). */
    private function cleanName(string $original, string $extension): string
    {
        $base = pathinfo(basename($original), PATHINFO_FILENAME);
        $base = trim((string) preg_replace('/[^\pL\pN\s._()-]+/u', '', $base));
        $base = Str::limit($base !== '' ? $base : 'berkas', 120, '');

        return $base.'.'.$extension;
    }
}
