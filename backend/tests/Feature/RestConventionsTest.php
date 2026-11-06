<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Mengunci konvensi REST untuk SELURUH API (bukan satu modul). Bila ada rute atau galat baru yang menyimpang,
 * test ini gagal dan menjelaskan alasannya. Lihat docs/standar-rest-api.md.
 */
class RestConventionsTest extends TestCase
{
    use RefreshDatabase;

    /** Rute yang memang boleh diakses tanpa login. */
    private const PUBLIC_ROUTES = ['api/v1/health', 'api/v1/auth/login'];

    /** Kata kerja yang tidak boleh menjadi segmen URL: aksinya sudah dinyatakan oleh metode HTTP. */
    private const FORBIDDEN_VERBS = ['get', 'fetch', 'list', 'create', 'add', 'update', 'edit', 'save', 'set', 'delete', 'remove'];

    /** @return array<int, LaravelRoute> */
    private function apiRoutes(): array
    {
        return array_values(array_filter(
            Route::getRoutes()->getRoutes(),
            fn (LaravelRoute $route) => str_starts_with($route->uri(), 'api/v1/'),
        ));
    }

    public function test_url_paths_are_nouns_without_verbs_in_them(): void
    {
        $violations = [];

        foreach ($this->apiRoutes() as $route) {
            foreach (explode('/', $route->uri()) as $segment) {
                if (str_starts_with($segment, '{')) {
                    continue;
                }

                if (! preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $segment)) {
                    $violations[] = "{$route->uri()}: segmen \"{$segment}\" harus huruf kecil dengan tanda hubung (kebab-case)";
                }

                if (in_array(explode('-', $segment)[0], self::FORBIDDEN_VERBS, true)) {
                    $violations[] = "{$route->uri()}: segmen \"{$segment}\" memuat kata kerja; gunakan metode HTTP";
                }
            }
        }

        $this->assertSame([], $violations, implode("\n", $violations));
    }

    public function test_every_route_except_the_public_ones_requires_login(): void
    {
        $open = [];

        foreach ($this->apiRoutes() as $route) {
            if (! in_array($route->uri(), self::PUBLIC_ROUTES, true) && ! in_array('auth:sanctum', $route->gatherMiddleware(), true)) {
                $open[] = $route->methods()[0].' '.$route->uri();
            }
        }

        $this->assertSame([], $open, "Rute tanpa auth:sanctum:\n".implode("\n", $open));
    }

    public function test_every_collection_route_answers_401_json_when_not_logged_in(): void
    {
        $checked = 0;

        foreach ($this->apiRoutes() as $route) {
            if (! in_array('GET', $route->methods(), true) || str_contains($route->uri(), '{') || in_array($route->uri(), self::PUBLIC_ROUTES, true)) {
                continue;
            }

            $this->getJson('/'.$route->uri())->assertUnauthorized()->assertJsonStructure(['message']);
            $checked++;
        }

        $this->assertGreaterThan(5, $checked);
    }

    public function test_missing_record_returns_clean_404_without_internal_details(): void
    {
        $this->seedRbac();
        config(['app.debug' => true]); // bahkan saat debug menyala, detail internal tidak boleh keluar

        $response = $this->actingAs($this->userWithRole(Role::ADMIN), 'web')->getJson('/api/v1/courses/999999');

        $response->assertNotFound()->assertExactJson(['message' => 'Data tidak ditemukan.']);
    }

    public function test_unknown_endpoint_returns_clean_404(): void
    {
        config(['app.debug' => true]);

        $this->getJson('/api/v1/tidak-ada')->assertNotFound()->assertExactJson(['message' => 'Endpoint tidak ditemukan.']);
    }

    public function test_wrong_method_returns_405_with_allow_header(): void
    {
        config(['app.debug' => true]);

        $response = $this->putJson('/api/v1/health');

        $response->assertStatus(405)->assertJsonStructure(['message'])->assertJsonMissingPath('trace');
        $this->assertStringContainsString('GET', (string) $response->headers->get('Allow'));
    }

    public function test_forbidden_returns_only_a_message_even_in_debug(): void
    {
        $this->seedRbac();
        config(['app.debug' => true]);

        $response = $this->actingAs($this->userWithRole(Role::SISWA), 'web')->getJson('/api/v1/users');

        $response->assertForbidden();
        $this->assertSame(['message'], array_keys($response->json()));
    }

    public function test_custom_abort_message_is_kept(): void
    {
        Route::get('/api/_uji-pesan', fn () => abort(404, 'Pesan khusus.'));

        $this->getJson('/api/_uji-pesan')->assertNotFound()->assertExactJson(['message' => 'Pesan khusus.']);
    }

    public function test_non_api_404_is_not_affected(): void
    {
        $this->get('/halaman-tidak-ada')->assertNotFound();
    }

    public function test_deleted_resource_is_gone_afterwards(): void
    {
        $this->seedRbac();
        $admin = $this->userWithRole(Role::ADMIN);
        $course = Course::factory()->create();

        $this->actingAs($admin, 'web')->deleteJson('/api/v1/courses/'.$course->id)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin, 'web')->getJson('/api/v1/courses/'.$course->id)->assertNotFound();
    }
}
