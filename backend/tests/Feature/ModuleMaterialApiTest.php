<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Material;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class ModuleMaterialApiTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seedRbac();
        $this->admin = $this->userWithRole(Role::ADMIN, ['name' => 'Admin Uji', 'email' => 'admin.uji@example.test']);
        $this->course = Course::factory()->active()->mentoredBy($this->userWithRole(Role::MENTOR))->create(['title' => 'Kursus Uji']);
    }

    private function as(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->actingAs($user, 'web');
    }

    private function asAdmin(): static
    {
        return $this->as($this->admin);
    }

    private function module(array $attrs = [], ?Course $course = null): CourseModule
    {
        return CourseModule::factory()->create(array_merge(['course_id' => ($course ?? $this->course)->id], $attrs));
    }

    private function pdf(string $name = 'Panduan Belajar.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
    }

    private function mp4(string $name = 'video.mp4'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom".str_repeat("\x00", 64));
    }

    /**
     * Upload NYATA: tipe file dideteksi dari isinya. (UploadedFile::fake() menebak dari nama file,
     * sehingga tidak cocok untuk menguji pemalsuan ekstensi.)
     */
    private function realUpload(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'lms');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, null, null, true);
    }

    private function lastLog(string $action): AuditLog
    {
        return AuditLog::where('action', $action)->latest('id')->firstOrFail();
    }

    // ================================================================== MODUL

    public function test_index_lists_modules_with_their_materials_in_order(): void
    {
        $second = $this->module(['title' => 'Laravel', 'position' => 2]);
        $first = $this->module(['title' => 'Intro', 'position' => 1]);
        Material::factory()->create(['course_module_id' => $first->id, 'title' => 'Dua', 'position' => 2]);
        Material::factory()->create(['course_module_id' => $first->id, 'title' => 'Satu', 'position' => 1]);
        Material::factory()->create(['course_module_id' => $first->id, 'title' => 'Dihapus'])->delete();
        $this->module(['title' => 'Modul Terhapus'])->delete();

        $response = $this->asAdmin()->getJson('/api/v1/courses/'.$this->course->id.'/modules')->assertOk();

        $this->assertSame(['Intro', 'Laravel'], collect($response->json('data'))->pluck('title')->all());
        $this->assertSame(['Satu', 'Dua'], collect($response->json('data.0.materials'))->pluck('title')->all());
        $response->assertJsonPath('data.1.materials', []);
    }

    public function test_creating_a_module_appends_it_and_is_logged(): void
    {
        $this->module(['position' => 4]);

        $this->asAdmin()->postJson('/api/v1/courses/'.$this->course->id.'/modules', ['title' => 'Modul Baru'])
            ->assertCreated()
            ->assertJsonPath('message', 'Modul berhasil dibuat.')
            ->assertJsonPath('data.title', 'Modul Baru')
            ->assertJsonPath('data.position', 5);

        $log = $this->lastLog('module.created');
        $this->assertSame('Modul Baru', $log->target_label);
        $this->assertSame('course_module', $log->target_type);
        $this->assertSame($this->course->id, $log->changes['course_id']);
    }

    public function test_module_title_is_validated(): void
    {
        $url = '/api/v1/courses/'.$this->course->id.'/modules';

        $this->asAdmin()->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->asAdmin()->postJson($url, ['title' => str_repeat('a', 151)])->assertStatus(422)->assertJsonValidationErrors(['title']);
        $this->assertSame(0, CourseModule::count());
    }

    public function test_updating_a_module_logs_only_real_changes(): void
    {
        $module = $this->module(['title' => 'Lama']);

        $this->asAdmin()->patchJson('/api/v1/modules/'.$module->id, ['title' => 'Baru'])->assertOk()->assertJsonPath('data.title', 'Baru');
        $log = $this->lastLog('module.updated');
        $this->assertSame(['title' => 'Lama'], $log->changes['before']);
        $this->assertSame(['title' => 'Baru'], $log->changes['after']);

        $this->asAdmin()->patchJson('/api/v1/modules/'.$module->id, ['title' => 'Baru'])->assertOk();
        $this->assertSame(1, AuditLog::where('action', 'module.updated')->count());
    }

    public function test_deleting_a_module_soft_deletes_its_materials_but_keeps_the_files(): void
    {
        $module = $this->module();
        Storage::disk('local')->put('course-materials/1/a.pdf', 'x');
        $material = Material::factory()->pdf('course-materials/1/a.pdf')->create(['course_module_id' => $module->id]);

        $this->asAdmin()->deleteJson('/api/v1/modules/'.$module->id)->assertOk()->assertJsonPath('message', 'Modul berhasil dihapus.');

        $this->assertSoftDeleted($module);
        $this->assertSoftDeleted($material);
        Storage::disk('local')->assertExists('course-materials/1/a.pdf');
        $this->assertSame($this->course->id, $this->lastLog('module.deleted')->changes['course_id']);
        $this->asAdmin()->patchJson('/api/v1/modules/'.$module->id, ['title' => 'X'])->assertNotFound();
    }

    public function test_reordering_modules(): void
    {
        $a = $this->module(['title' => 'A', 'position' => 1]);
        $b = $this->module(['title' => 'B', 'position' => 2]);
        $c = $this->module(['title' => 'C', 'position' => 3]);

        $response = $this->asAdmin()->putJson('/api/v1/courses/'.$this->course->id.'/modules/order', ['ids' => [$c->id, $a->id, $b->id]])
            ->assertOk()->assertJsonPath('message', 'Urutan modul berhasil disimpan.');

        $this->assertSame(['C', 'A', 'B'], collect($response->json('data'))->pluck('title')->all());
        $this->assertSame(['C', 'A', 'B'], $this->course->fresh()->modules->pluck('title')->all());
        $this->assertSame([$c->id, $a->id, $b->id], $this->lastLog('module.reordered')->changes['order']);
    }

    public function test_reordering_rejects_incomplete_duplicate_or_foreign_ids(): void
    {
        $a = $this->module(['title' => 'A', 'position' => 1]);
        $b = $this->module(['title' => 'B', 'position' => 2]);
        $foreign = $this->module([], Course::factory()->create());
        $url = '/api/v1/courses/'.$this->course->id.'/modules/order';

        foreach ([[$a->id], [$a->id, $b->id, $foreign->id], [$a->id, 999999], []] as $ids) {
            $this->asAdmin()->putJson($url, ['ids' => $ids])->assertStatus(422)->assertJsonValidationErrors(['ids']);
        }
        $this->asAdmin()->putJson($url, ['ids' => [$a->id, $a->id]])->assertStatus(422); // ganda: kesalahan pada ids.N
        $this->asAdmin()->putJson($url, [])->assertStatus(422);

        $this->assertSame(['A', 'B'], $this->course->fresh()->modules->pluck('title')->all(), 'Urutan awal tidak berubah.');
    }

    public function test_modules_of_an_institution_program_are_read_only_for_admin(): void
    {
        $program = Course::factory()->institution($this->userWithRole(Role::LEMBAGA))->create();
        $module = $this->module(['title' => 'Modul Lembaga'], $program);

        $this->asAdmin()->getJson('/api/v1/courses/'.$program->id.'/modules')->assertOk()->assertJsonPath('data.0.title', 'Modul Lembaga');
        $this->asAdmin()->postJson('/api/v1/courses/'.$program->id.'/modules', ['title' => 'X'])->assertForbidden();
        $this->asAdmin()->patchJson('/api/v1/modules/'.$module->id, ['title' => 'X'])->assertForbidden();
        $this->asAdmin()->deleteJson('/api/v1/modules/'.$module->id)->assertForbidden();
        $this->asAdmin()->putJson('/api/v1/courses/'.$program->id.'/modules/order', ['ids' => [$module->id]])->assertForbidden();
    }

    public function test_a_deleted_course_has_no_manageable_content(): void
    {
        $module = $this->module();
        $this->course->delete();

        $this->asAdmin()->postJson('/api/v1/courses/'.$this->course->id.'/modules', ['title' => 'X'])->assertNotFound();
        $this->asAdmin()->patchJson('/api/v1/modules/'.$module->id, ['title' => 'X'])->assertNotFound();
        $this->asAdmin()->deleteJson('/api/v1/modules/'.$module->id)->assertNotFound();
    }

    // ================================================================== MATERI: tambah

    public function test_adding_a_pdf_stores_a_private_random_named_file(): void
    {
        $module = $this->module();

        $response = $this->asAdmin()->post('/api/v1/modules/'.$module->id.'/materials', [
            'type' => 'pdf', 'title' => 'Panduan', 'description' => 'Baca ini', 'xp_points' => 10, 'file' => $this->pdf('Panduan Belajar.pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $response->assertJsonPath('message', 'Materi berhasil ditambahkan.')
            ->assertJsonPath('data.type', 'pdf')
            ->assertJsonPath('data.type_label', 'PDF')
            ->assertJsonPath('data.xp_points', 10)
            ->assertJsonPath('data.position', 1)
            ->assertJsonPath('data.has_file', true)
            ->assertJsonPath('data.file.name', 'Panduan Belajar.pdf')
            ->assertJsonPath('data.file.mime_type', 'application/pdf');

        $this->assertStringNotContainsString('course-materials', json_encode($response->json()), 'Path penyimpanan tidak boleh bocor ke API.');

        $material = Material::firstOrFail();
        $this->assertMatchesRegularExpression('#^course-materials/'.$this->course->id.'/[A-Za-z0-9]{40}\.pdf$#', $material->file_path);
        $this->assertStringNotContainsString('Panduan', $material->file_path, 'Nama file disimpan acak, bukan nama asli.');
        Storage::disk('local')->assertExists($material->file_path);
        $this->assertSame(Storage::disk('local')->size($material->file_path), $material->file_size);
        $this->assertSame($this->course->id, $this->lastLog('material.created')->changes['course_id']);
    }

    public function test_adding_other_material_types(): void
    {
        $module = $this->module();
        $url = '/api/v1/modules/'.$module->id.'/materials';
        $json = ['Accept' => 'application/json'];

        $this->asAdmin()->post($url, ['type' => 'link', 'title' => 'Artikel', 'external_url' => 'https://contoh.test/artikel'], $json)
            ->assertCreated()->assertJsonPath('data.external_url', 'https://contoh.test/artikel')->assertJsonPath('data.has_file', false)->assertJsonPath('data.position', 1);

        $this->asAdmin()->post($url, ['type' => 'video', 'title' => 'Video URL', 'external_url' => 'https://youtu.be/abc', 'duration_minutes' => 10], $json)
            ->assertCreated()->assertJsonPath('data.duration_minutes', 10)->assertJsonPath('data.position', 2);

        $this->asAdmin()->post($url, ['type' => 'video', 'title' => 'Video File', 'file' => $this->mp4()], $json)
            ->assertCreated()->assertJsonPath('data.has_file', true)->assertJsonPath('data.file.mime_type', 'video/mp4');

        $this->asAdmin()->post($url, ['type' => 'document', 'title' => 'Catatan', 'file' => UploadedFile::fake()->createWithContent('catatan.txt', 'Halo dunia')], $json)
            ->assertCreated()->assertJsonPath('data.type_label', 'Dokumen');

        $this->assertSame([1, 2, 3, 4], $module->materials()->pluck('position')->all());
    }

    #[DataProvider('invalidMaterials')]
    public function test_material_validation(array $payload, string $errorField): void
    {
        $module = $this->module();
        $payload = array_map(fn ($v) => $v instanceof \Closure ? $v($this) : $v, $payload);

        $this->asAdmin()->post('/api/v1/modules/'.$module->id.'/materials', $payload, ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors([$errorField]);

        $this->assertSame(0, Material::count());
        $this->assertSame([], Storage::disk('local')->allFiles(), 'Penolakan tidak boleh meninggalkan file.');
    }

    public static function invalidMaterials(): array
    {
        $pdf = fn (self $t) => $t->pdf();

        return [
            'tanpa tipe' => [['title' => 'X'], 'type'],
            'tipe ngawur' => [['type' => 'game', 'title' => 'X'], 'type'],
            'tanpa judul' => [['type' => 'link', 'external_url' => 'https://a.test'], 'title'],
            'link tanpa url' => [['type' => 'link', 'title' => 'X'], 'external_url'],
            'link dengan file' => [['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test', 'file' => $pdf], 'file'],
            'url javascript' => [['type' => 'link', 'title' => 'X', 'external_url' => 'javascript:alert(1)'], 'external_url'],
            'url ftp' => [['type' => 'link', 'title' => 'X', 'external_url' => 'ftp://a.test/x'], 'external_url'],
            'url bukan url' => [['type' => 'link', 'title' => 'X', 'external_url' => 'bukan url'], 'external_url'],
            'pdf tanpa file' => [['type' => 'pdf', 'title' => 'X'], 'file'],
            'pdf dengan url' => [['type' => 'pdf', 'title' => 'X', 'file' => $pdf, 'external_url' => 'https://a.test'], 'external_url'],
            'video tanpa file dan url' => [['type' => 'video', 'title' => 'X'], 'file'],
            'video file dan url' => [['type' => 'video', 'title' => 'X', 'external_url' => 'https://a.test', 'file' => fn (self $t) => $t->mp4()], 'file'],
            'durasi untuk non-video' => [['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test', 'duration_minutes' => 5], 'duration_minutes'],
            'xp negatif' => [['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test', 'xp_points' => -1], 'xp_points'],
            'xp lebih dari 100' => [['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test', 'xp_points' => 101], 'xp_points'],
        ];
    }

    public function test_files_are_checked_by_content_not_by_extension(): void
    {
        $module = $this->module();
        $url = '/api/v1/modules/'.$module->id.'/materials';

        foreach ([
            'skrip PHP bernama .pdf' => $this->realUpload('jahat.pdf', "<?php echo 'x'; ?>"),
            'HTML bernama .pdf' => $this->realUpload('x.pdf', '<html><body><script>alert(1)</script></body></html>'),
            'teks biasa bernama .pdf' => $this->realUpload('catatan.pdf', 'ini hanya teks biasa'),
            'PDF sungguhan bernama .php' => $this->realUpload('x.php', "%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n"),
        ] as $label => $file) {
            $this->asAdmin()->post($url, ['type' => 'pdf', 'title' => 'X', 'file' => $file], ['Accept' => 'application/json'])
                ->assertStatus(422, $label)->assertJsonValidationErrors(['file']);
        }

        // Dokumen: skrip dan HTML tidak diterima.
        foreach ([$this->realUpload('a.txt', "<?php system('ls'); ?>"), $this->realUpload('a.html', '<html><body>x</body></html>')] as $file) {
            $this->asAdmin()->post($url, ['type' => 'document', 'title' => 'X', 'file' => $file], ['Accept' => 'application/json'])
                ->assertStatus(422)->assertJsonValidationErrors(['file']);
        }

        // Video: berkas non-video ditolak.
        $this->asAdmin()->post($url, ['type' => 'video', 'title' => 'X', 'file' => $this->realUpload('v.mp4', 'bukan video sungguhan')], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['file']);

        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertSame(0, Material::count());
    }

    public function test_real_uploads_are_accepted_and_the_stored_mime_is_derived_from_the_validated_extension(): void
    {
        $module = $this->module();
        $url = '/api/v1/modules/'.$module->id.'/materials';
        $json = ['Accept' => 'application/json'];

        $this->asAdmin()->post($url, ['type' => 'pdf', 'title' => 'P', 'file' => $this->realUpload('Nama Asli.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n")], $json)
            ->assertCreated()->assertJsonPath('data.file.mime_type', 'application/pdf');

        $this->asAdmin()->post($url, ['type' => 'video', 'title' => 'V', 'file' => $this->realUpload('v.mp4', "\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom".str_repeat("\x00", 64))], $json)
            ->assertCreated()->assertJsonPath('data.file.mime_type', 'video/mp4');

        // Nama file menyesatkan tidak berpengaruh: yang dipakai ekstensi hasil deteksi isi.
        $stored = Material::where('type', 'pdf')->firstOrFail();
        $this->assertStringEndsWith('.pdf', $stored->file_path);
    }

    public function test_the_upload_size_limit_comes_from_config(): void
    {
        config(['lms.uploads.max_kb' => 1]);
        $module = $this->module();

        $big = UploadedFile::fake()->createWithContent('besar.pdf', "%PDF-1.4\n".str_repeat('a', 3000)."\n%%EOF\n");

        $this->asAdmin()->post('/api/v1/modules/'.$module->id.'/materials', ['type' => 'pdf', 'title' => 'X', 'file' => $big], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['file']);
    }

    public function test_the_file_name_is_sanitised(): void
    {
        $module = $this->module();

        $this->asAdmin()->post('/api/v1/modules/'.$module->id.'/materials', [
            'type' => 'pdf', 'title' => 'X', 'file' => $this->pdf('../../etc/<b>Laporan</b> Akhir; rm -rf.pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $name = Material::firstOrFail()->file_name;
        $this->assertStringNotContainsString('/', $name);
        $this->assertStringNotContainsString('<', $name);
        $this->assertStringNotContainsString(';', $name);
        $this->assertStringEndsWith('.pdf', $name);
    }

    public function test_xp_is_only_for_academic_courses(): void
    {
        $training = Course::factory()->training()->active()->mentoredBy($this->userWithRole(Role::MENTOR))->create();
        $module = $this->module([], $training);
        $url = '/api/v1/modules/'.$module->id.'/materials';
        $payload = ['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test'];

        $this->asAdmin()->post($url, $payload + ['xp_points' => 10], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors(['xp_points']);

        // 0 dan tanpa XP tetap boleh.
        $this->asAdmin()->post($url, $payload + ['xp_points' => 0], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.xp_points', 0);
        $this->asAdmin()->post($url, $payload, ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.xp_points', 0);
    }

    public function test_orphan_file_is_removed_when_saving_fails(): void
    {
        $module = $this->module();
        AuditLog::creating(fn () => throw new RuntimeException('log gagal'));

        try {
            $this->asAdmin()->post('/api/v1/modules/'.$module->id.'/materials', ['type' => 'pdf', 'title' => 'X', 'file' => $this->pdf()], ['Accept' => 'application/json'])
                ->assertStatus(500);
        } finally {
            AuditLog::flushEventListeners();
            AuditLog::clearBootedModels();
        }

        $this->assertSame(0, Material::count());
        $this->assertSame([], Storage::disk('local')->allFiles(), 'File yatim harus dibersihkan.');
    }

    // ================================================================== MATERI: ubah, hapus, urut

    public function test_updating_text_fields_and_xp(): void
    {
        $module = $this->module();
        $material = Material::factory()->create(['course_module_id' => $module->id, 'title' => 'Lama', 'xp_points' => 5]);

        $this->asAdmin()->patchJson('/api/v1/materials/'.$material->id, ['title' => 'Baru', 'xp_points' => 20, 'description' => 'Ket'])
            ->assertOk()->assertJsonPath('message', 'Materi berhasil diperbarui.')->assertJsonPath('data.title', 'Baru')->assertJsonPath('data.xp_points', 20);

        $log = $this->lastLog('material.updated');
        $this->assertSame(['title' => 'Lama', 'xp_points' => 5], collect($log->changes['before'])->only(['title', 'xp_points'])->all());
        $this->assertSame(20, $log->changes['after']['xp_points']);

        $count = AuditLog::count();
        $this->asAdmin()->patchJson('/api/v1/materials/'.$material->id, ['title' => 'Baru'])->assertOk();
        $this->assertSame($count, AuditLog::count(), 'Tanpa perubahan tidak ada catatan.');
    }

    public function test_replacing_a_file_removes_the_old_one(): void
    {
        $module = $this->module();
        Storage::disk('local')->put('course-materials/1/lama.pdf', 'lama');
        $material = Material::factory()->pdf('course-materials/1/lama.pdf')->create(['course_module_id' => $module->id]);

        $this->asAdmin()->post('/api/v1/materials/'.$material->id, ['_method' => 'PATCH', 'file' => $this->pdf('Revisi.pdf')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.file.name', 'Revisi.pdf');

        $material->refresh();
        $this->assertNotSame('course-materials/1/lama.pdf', $material->file_path);
        Storage::disk('local')->assertMissing('course-materials/1/lama.pdf');
        Storage::disk('local')->assertExists($material->file_path);
        $this->assertTrue($this->lastLog('material.updated')->changes['file_replaced']);
    }

    public function test_switching_a_video_between_file_and_link_cleans_up(): void
    {
        $module = $this->module();
        $url = '/api/v1/modules/'.$module->id.'/materials';

        $id = $this->asAdmin()->post($url, ['type' => 'video', 'title' => 'V', 'file' => $this->mp4()], ['Accept' => 'application/json'])->json('data.id');
        $oldPath = Material::findOrFail($id)->file_path;
        Storage::disk('local')->assertExists($oldPath);

        // File -> tautan
        $this->asAdmin()->patchJson('/api/v1/materials/'.$id, ['external_url' => 'https://youtu.be/xyz'])
            ->assertOk()->assertJsonPath('data.has_file', false)->assertJsonPath('data.external_url', 'https://youtu.be/xyz');
        Storage::disk('local')->assertMissing($oldPath);

        // Tautan -> file
        $this->asAdmin()->post('/api/v1/materials/'.$id, ['_method' => 'PATCH', 'file' => $this->mp4('baru.mp4')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.has_file', true)->assertJsonPath('data.external_url', null);
    }

    public function test_material_type_cannot_change_and_rules_follow_the_type(): void
    {
        $module = $this->module();
        $pdf = Material::factory()->pdf()->create(['course_module_id' => $module->id]);
        $link = Material::factory()->create(['course_module_id' => $module->id]);

        $this->asAdmin()->patchJson('/api/v1/materials/'.$pdf->id, ['type' => 'link'])->assertStatus(422)->assertJsonValidationErrors(['type']);
        $this->asAdmin()->patchJson('/api/v1/materials/'.$pdf->id, ['external_url' => 'https://a.test'])->assertStatus(422)->assertJsonValidationErrors(['external_url']);
        $this->asAdmin()->patchJson('/api/v1/materials/'.$link->id, ['external_url' => 'javascript:alert(1)'])->assertStatus(422)->assertJsonValidationErrors(['external_url']);
        $this->asAdmin()->post('/api/v1/materials/'.$link->id, ['_method' => 'PATCH', 'file' => $this->pdf()], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors(['file']);
    }

    public function test_deleting_a_material_is_soft_and_keeps_the_file(): void
    {
        $module = $this->module();
        Storage::disk('local')->put('course-materials/1/x.pdf', 'x');
        $material = Material::factory()->pdf('course-materials/1/x.pdf')->create(['course_module_id' => $module->id, 'title' => 'Hapus Saya']);

        $this->asAdmin()->deleteJson('/api/v1/materials/'.$material->id)->assertOk()->assertJsonPath('message', 'Materi berhasil dihapus.');

        $this->assertSoftDeleted($material);
        Storage::disk('local')->assertExists('course-materials/1/x.pdf');
        $this->assertSame('Hapus Saya', $this->lastLog('material.deleted')->target_label);
        $this->asAdmin()->getJson('/api/v1/materials/'.$material->id.'/file')->assertNotFound();
    }

    public function test_reordering_materials(): void
    {
        $module = $this->module();
        $a = Material::factory()->create(['course_module_id' => $module->id, 'title' => 'A', 'position' => 1]);
        $b = Material::factory()->create(['course_module_id' => $module->id, 'title' => 'B', 'position' => 2]);

        $response = $this->asAdmin()->putJson('/api/v1/modules/'.$module->id.'/materials/order', ['ids' => [$b->id, $a->id]])
            ->assertOk()->assertJsonPath('message', 'Urutan materi berhasil disimpan.');

        $this->assertSame(['B', 'A'], collect($response->json('data'))->pluck('title')->all());
        $this->asAdmin()->putJson('/api/v1/modules/'.$module->id.'/materials/order', ['ids' => [$a->id]])->assertStatus(422)->assertJsonValidationErrors(['ids']);
    }

    // ================================================================== MATERI: unduh

    private function materialWithFile(string $type, string $path, string $name, string $mime, string $content): Material
    {
        Storage::disk('local')->put($path, $content);

        return Material::factory()->create([
            'course_module_id' => $this->module()->id, 'type' => $type, 'external_url' => null,
            'file_path' => $path, 'file_name' => $name, 'file_size' => strlen($content), 'mime_type' => $mime,
        ]);
    }

    public function test_admin_downloads_a_file_pdf_inline_and_documents_as_attachment(): void
    {
        $pdf = $this->materialWithFile('pdf', 'course-materials/1/a.pdf', 'Panduan.pdf', 'application/pdf', '%PDF-ISI');
        $doc = $this->materialWithFile('document', 'course-materials/1/b.txt', 'Catatan.txt', 'text/plain', 'ISI CATATAN');

        $r1 = $this->asAdmin()->get('/api/v1/materials/'.$pdf->id.'/file')->assertOk();
        $this->assertSame('%PDF-ISI', $r1->streamedContent());
        $this->assertStringContainsString('inline', $r1->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Panduan.pdf', $r1->headers->get('Content-Disposition'));
        $this->assertSame('application/pdf', $r1->headers->get('Content-Type'));
        $this->assertSame('nosniff', $r1->headers->get('X-Content-Type-Options'));
        $this->assertStringContainsString('private', $r1->headers->get('Cache-Control'));

        $r2 = $this->asAdmin()->get('/api/v1/materials/'.$doc->id.'/file')->assertOk();
        $this->assertSame('ISI CATATAN', $r2->streamedContent());
        $this->assertStringContainsString('attachment', $r2->headers->get('Content-Disposition'));
    }

    public function test_download_is_not_available_for_link_materials_or_missing_files(): void
    {
        $link = Material::factory()->create(['course_module_id' => $this->module()->id]);
        $missing = Material::factory()->pdf('course-materials/1/hilang.pdf')->create(['course_module_id' => $this->module()->id]);

        $this->asAdmin()->getJson('/api/v1/materials/'.$link->id.'/file')->assertNotFound();
        $this->asAdmin()->getJson('/api/v1/materials/'.$missing->id.'/file')->assertNotFound();
        $this->asAdmin()->getJson('/api/v1/materials/999999/file')->assertNotFound();
    }

    public function test_files_are_not_reachable_through_a_public_url(): void
    {
        $material = $this->materialWithFile('pdf', 'course-materials/1/a.pdf', 'a.pdf', 'application/pdf', 'RAHASIA');

        // Tidak ada symlink publik ke storage.
        $this->assertDirectoryDoesNotExist(public_path('storage/course-materials'));

        // Rute bawaan /storage (disk lokal) tidak mau melayani tanpa tanda tangan, bahkan untuk Admin yang login.
        $response = $this->asAdmin()->get('/storage/'.$material->file_path);
        $this->assertContains($response->getStatusCode(), [403, 404]);
        $this->assertStringNotContainsString('RAHASIA', (string) $response->getContent());
    }

    #[DataProvider('nonAdminRoles')]
    public function test_other_roles_cannot_use_content_endpoints(string $role): void
    {
        $module = $this->module();
        $material = $this->materialWithFile('pdf', 'course-materials/1/a.pdf', 'a.pdf', 'application/pdf', 'x');
        $actor = $this->userWithRole($role);

        $this->as($actor)->getJson('/api/v1/courses/'.$this->course->id.'/modules')->assertForbidden();
        $this->as($actor)->postJson('/api/v1/courses/'.$this->course->id.'/modules', ['title' => 'X'])->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/modules/'.$module->id, ['title' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/modules/'.$module->id)->assertForbidden();
        $this->as($actor)->postJson('/api/v1/modules/'.$module->id.'/materials', ['type' => 'link', 'title' => 'X', 'external_url' => 'https://a.test'])->assertForbidden();
        $this->as($actor)->patchJson('/api/v1/materials/'.$material->id, ['title' => 'X'])->assertForbidden();
        $this->as($actor)->deleteJson('/api/v1/materials/'.$material->id)->assertForbidden();
        $this->as($actor)->get('/api/v1/materials/'.$material->id.'/file')->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['mentor'], ['siswa'], ['karyawan'], ['lembaga']];
    }

    public function test_guests_are_rejected(): void
    {
        $this->getJson('/api/v1/courses/1/modules')->assertUnauthorized();
        $this->getJson('/api/v1/materials/1/file')->assertUnauthorized();
        $this->postJson('/api/v1/modules/1/materials', [])->assertUnauthorized();
    }

    public function test_a_future_mentor_manages_and_downloads_only_own_course_content(): void
    {
        Role::where('slug', Role::MENTOR)->firstOrFail()->permissions()->syncWithoutDetaching(
            Permission::whereIn('slug', ['courses.view', 'courses.update', 'content.manage'])->pluck('id')
        );
        $mentor = $this->userWithRole(Role::MENTOR);
        $own = Course::factory()->active()->mentoredBy($mentor)->create();
        $ownModule = $this->module(['title' => 'Milik Saya'], $own);
        $foreignModule = $this->module(['title' => 'Milik Orang']);
        $ownFile = $this->materialWithFile('pdf', 'course-materials/1/own.pdf', 'own.pdf', 'application/pdf', 'MILIK');
        $ownFile->forceFill(['course_module_id' => $ownModule->id])->save();
        $foreignFile = $this->materialWithFile('pdf', 'course-materials/1/foreign.pdf', 'foreign.pdf', 'application/pdf', 'ORANG');

        $this->as($mentor)->getJson('/api/v1/courses/'.$own->id.'/modules')->assertOk();
        $this->as($mentor)->postJson('/api/v1/courses/'.$own->id.'/modules', ['title' => 'Baru'])->assertCreated();
        $this->as($mentor)->get('/api/v1/materials/'.$ownFile->id.'/file')->assertOk();

        $this->as($mentor)->getJson('/api/v1/courses/'.$this->course->id.'/modules')->assertForbidden();
        $this->as($mentor)->patchJson('/api/v1/modules/'.$foreignModule->id, ['title' => 'Curang'])->assertForbidden();
        $this->as($mentor)->get('/api/v1/materials/'.$foreignFile->id.'/file')->assertForbidden();
    }

    // ================================================================== PEMBERSIHAN FILE

    public function test_purge_command_removes_only_old_deleted_files(): void
    {
        $module = $this->module();
        $mk = function (string $name, ?string $deletedAt) use ($module) {
            Storage::disk('local')->put("course-materials/1/{$name}.pdf", $name);
            $m = Material::factory()->pdf("course-materials/1/{$name}.pdf")->create(['course_module_id' => $module->id]);
            if ($deletedAt) {
                $m->forceFill(['deleted_at' => $deletedAt])->saveQuietly();
            }

            return $m;
        };
        $lama = $mk('lama', now()->subDays(40)->toDateTimeString());
        $baru = $mk('baru', now()->subDays(5)->toDateTimeString());
        $aktif = $mk('aktif', null);

        $this->artisan('lms:purge-material-files', ['--days' => 30])->expectsOutputToContain('1 file dibersihkan')->assertSuccessful();

        Storage::disk('local')->assertMissing('course-materials/1/lama.pdf');
        Storage::disk('local')->assertExists('course-materials/1/baru.pdf');
        Storage::disk('local')->assertExists('course-materials/1/aktif.pdf');
        $this->assertNull(Material::withTrashed()->find($lama->id)->file_path, 'Baris tetap ada, hanya file_path dikosongkan.');
        $this->assertNotNull(Material::withTrashed()->find($baru->id)->file_path);
        $this->assertNotNull($aktif->fresh()->file_path);

        $this->artisan('lms:purge-material-files', ['--days' => 30])->expectsOutputToContain('Tidak ada file')->assertSuccessful();
    }

    public function test_purge_command_covers_deleted_modules_and_courses_and_supports_dry_run(): void
    {
        $oldCourse = Course::factory()->create();
        $moduleOfDeletedCourse = $this->module([], $oldCourse);
        Storage::disk('local')->put('course-materials/9/kursus.pdf', 'x');
        Material::factory()->pdf('course-materials/9/kursus.pdf')->create(['course_module_id' => $moduleOfDeletedCourse->id]);
        $oldCourse->forceFill(['deleted_at' => now()->subDays(60)])->saveQuietly();

        $deletedModule = $this->module();
        Storage::disk('local')->put('course-materials/9/modul.pdf', 'x');
        Material::factory()->pdf('course-materials/9/modul.pdf')->create(['course_module_id' => $deletedModule->id]);
        $deletedModule->forceFill(['deleted_at' => now()->subDays(60)])->saveQuietly();

        $this->artisan('lms:purge-material-files', ['--days' => 30, '--dry-run' => true])->expectsOutputToContain('2 file akan dibersihkan')->assertSuccessful();
        Storage::disk('local')->assertExists('course-materials/9/kursus.pdf');

        $this->artisan('lms:purge-material-files', ['--days' => 30])->expectsOutputToContain('2 file dibersihkan')->assertSuccessful();
        Storage::disk('local')->assertMissing('course-materials/9/kursus.pdf');
        Storage::disk('local')->assertMissing('course-materials/9/modul.pdf');
    }
}
