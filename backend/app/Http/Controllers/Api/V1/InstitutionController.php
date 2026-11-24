<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreInstitutionRequest;
use App\Http\Requests\UpdateInstitutionRequest;
use App\Http\Resources\InstitutionResource;
use App\Models\AuditLog;
use App\Models\Enrollment;
use App\Models\Institution;
use App\Models\InstitutionPayout;
use App\Models\Role;
use App\Models\Transaction;
use App\Models\User;
use App\Notifications\EmailAddressChanged;
use App\Support\Like;
use App\Support\TemporaryPassword;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Manajemen Lembaga Bimbingan (Admin): daftar, tambah (profil + akun), ubah, hapus, pulihkan.
 * Satu akun Lembaga = satu lembaga. Status akun diubah di sini dan tersimpan di tabel users.
 */
class InstitutionController extends Controller
{
    private const BANK_FIELDS = ['bank_name', 'bank_account_holder', 'bank_account_number'];

    public function index(Request $request)
    {
        Gate::authorize('viewAny', Institution::class);

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(User::STATUSES)],
            'trashed' => ['nullable', Rule::in(['only', 'with'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $institutions = $this->financials(Institution::query())
            ->with('user')
            ->withCount('programs')
            ->when(($filters['trashed'] ?? null) === 'only', fn (Builder $q) => $q->onlyTrashed())
            ->when(($filters['trashed'] ?? null) === 'with', fn (Builder $q) => $q->withTrashed())
            ->when(filled($filters['q'] ?? null), function (Builder $query) use ($filters) {
                $like = Like::contains((string) $filters['q']);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(institutions.name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(institutions.phone) like ? escape '!'", [$like])
                    ->orWhereHas('user', fn (Builder $u) => $u->whereRaw("lower(users.email) like ? escape '!'", [$like])));
            })
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->whereHas('user', fn (Builder $u) => $u->where('users.status', $status)))
            ->orderBy('institutions.name')
            ->orderBy('institutions.id')
            ->paginate($filters['per_page'] ?? 15);

        return InstitutionResource::collection($institutions)->additional(['summary' => $this->summary()]);
    }

    /**
     * Membuat akun Lembaga beserta profilnya dalam satu transaksi. Seperti pembuatan pengguna, Admin tidak
     * memilih kata sandi: sistem membuat kata sandi sementara yang ditampilkan SEKALI di response ini.
     */
    public function store(StoreInstitutionRequest $request): JsonResponse
    {
        $data = $request->validated();
        $temporaryPassword = TemporaryPassword::generate();

        $institution = DB::transaction(function () use ($data, $temporaryPassword, $request) {
            $account = new User([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $temporaryPassword,
                'status' => $data['status'] ?? User::STATUS_ACTIVE,
            ]);
            $account->must_change_password = true;
            $account->save();
            $account->roles()->sync([Role::where('slug', Role::LEMBAGA)->firstOrFail()->id]);

            $institution = new Institution(collect($data)->except(['email', 'status'])->all());
            $institution->user_id = $account->id;
            $institution->created_by = $request->user()->id;
            $institution->save();

            AuditLog::record('institution.created', $institution, ['after' => $this->snapshot($institution, $account)], $request);

            return $institution;
        });

        return (new InstitutionResource($this->loaded($institution)))
            ->additional([
                'message' => 'Lembaga berhasil dibuat. Kata sandi sementara hanya ditampilkan sekali.',
                'temporary_password' => $temporaryPassword,
            ])
            ->response()
            ->setStatusCode(201)
            ->header('Cache-Control', 'no-store');
    }

    public function show(Institution $institution): InstitutionResource
    {
        Gate::authorize('view', $institution);

        return new InstitutionResource($this->loaded($institution));
    }

    public function update(UpdateInstitutionRequest $request, Institution $institution): InstitutionResource
    {
        $data = $request->validated();
        $account = $institution->user;
        $before = $this->snapshot($institution, $account);

        $this->ensureBankIsConsistent($institution, $data);

        DB::transaction(function () use ($institution, $account, $data, $request, $before) {
            $institution->fill(collect($data)->only(['name', 'description', 'phone', 'address', 'revenue_share_percent', ...self::BANK_FIELDS])->all());
            $institution->save();

            // Nama dan email lembaga sama dengan nama dan email akunnya.
            if (isset($data['name'])) {
                $account->name = $data['name'];
            }
            if (isset($data['email'])) {
                $account->email = $data['email'];
            }
            if (isset($data['status'])) {
                $account->status = $data['status'];
            }
            $account->save();

            if ($account->status !== User::STATUS_ACTIVE) {
                $account->revokeSessions();
            }

            $after = $this->snapshot($institution->refresh(), $account);
            $changed = array_keys(array_filter($after, fn ($value, $key) => $value !== $before[$key], ARRAY_FILTER_USE_BOTH));

            if ($changed !== []) {
                AuditLog::record('institution.updated', $institution, [
                    'before' => array_intersect_key($before, array_flip($changed)),
                    'after' => array_intersect_key($after, array_flip($changed)),
                ], $request);
            }
        });

        // Pemilik akun diberi tahu di email LAMA (kegagalan kirim tidak menggagalkan perubahan).
        if ($before['email'] !== $account->email) {
            try {
                Notification::route('mail', $before['email'])->notify(new EmailAddressChanged($account->email, now()));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return (new InstitutionResource($this->loaded($institution)))->additional(['message' => 'Lembaga berhasil diperbarui.']);
    }

    /**
     * Soft delete (akun dan profil). Lembaga dengan riwayat uang atau siswa aktif tidak dihapus:
     * riwayat keuangan harus tetap utuh dan siswa tidak boleh kehilangan programnya. Nonaktifkan saja.
     */
    public function destroy(Request $request, Institution $institution): JsonResponse
    {
        Gate::authorize('delete', $institution);

        if (Transaction::query()->where('institution_id', $institution->id)->exists()
            || InstitutionPayout::query()->where('institution_id', $institution->id)->exists()) {
            throw ValidationException::withMessages([
                'institution' => ['Lembaga sudah memiliki riwayat transaksi atau pencairan dana, sehingga tidak dapat dihapus. Nonaktifkan akunnya sebagai gantinya.'],
            ]);
        }

        $activeStudents = Enrollment::query()
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->whereIn('course_id', $institution->programs()->select('courses.id'))
            ->distinct()->count('user_id');

        if ($activeStudents > 0) {
            throw ValidationException::withMessages([
                'institution' => ["Lembaga masih memiliki {$activeStudents} siswa aktif pada programnya, sehingga tidak dapat dihapus. Nonaktifkan akunnya sebagai gantinya."],
            ]);
        }

        DB::transaction(function () use ($institution, $request) {
            $account = $institution->user;
            $account->revokeSessions();
            $account->delete();
            $institution->delete();

            AuditLog::record('institution.deleted', $institution, [], $request);
        });

        return response()->json(['message' => 'Lembaga berhasil dihapus.']);
    }

    public function restore(Request $request, Institution $institution): InstitutionResource
    {
        Gate::authorize('restore', $institution);

        if (! $institution->trashed()) {
            throw ValidationException::withMessages(['institution' => ['Lembaga ini tidak dalam kondisi dihapus.']]);
        }

        DB::transaction(function () use ($institution, $request) {
            $institution->user()->restore();
            $institution->restore();

            AuditLog::record('institution.restored', $institution, [], $request);
        });

        return (new InstitutionResource($this->loaded($institution)))->additional(['message' => 'Lembaga berhasil dipulihkan.']);
    }

    // ------------------------------------------------------------------ pembantu

    /** Menambah saldo per baris: total pendapatan lembaga dan dana yang sudah keluar/ditahan. */
    private function financials(Builder $query): Builder
    {
        return $query
            ->withSum(['transactions as earned_total' => fn (Builder $q) => $q->where('transactions.status', Transaction::STATUS_PAID)], 'institution_amount')
            ->withSum(['payouts as held_total' => fn (Builder $q) => $q->whereIn('institution_payouts.status', InstitutionPayout::HOLDING_STATUSES)], 'amount');
    }

    private function loaded(Institution $institution): Institution
    {
        return $this->financials(Institution::query()->withTrashed())
            ->with('user')
            ->withCount('programs')
            ->findOrFail($institution->id);
    }

    /** Kartu ringkasan di halaman daftar: tidak terpengaruh filter pencarian. */
    private function summary(): array
    {
        $paid = Transaction::query()->paid()->whereNotNull('institution_id');

        return [
            'total' => Institution::count(),
            'active' => Institution::whereHas('user', fn (Builder $q) => $q->where('users.status', User::STATUS_ACTIVE))->count(),
            'institution_revenue_total' => (int) (clone $paid)->sum('institution_amount'),
            // "Pemasukan kerja sama" bagi Maxy Academy (FR-16): bagian platform dari semua lembaga.
            'platform_revenue_total' => (int) (clone $paid)->sum('platform_amount'),
            'pending_payouts_total' => (int) InstitutionPayout::where('status', InstitutionPayout::STATUS_PENDING)->sum('amount'),
        ];
    }

    /**
     * Data rekening harus lengkap (bank, pemilik, nomor) atau kosong semuanya. Diperiksa terhadap
     * data AKHIR agar perubahan sebagian (mis. hanya nama bank) tetap sah bila yang lain sudah ada.
     *
     * @param  array<string,mixed>  $data
     */
    private function ensureBankIsConsistent(Institution $institution, array $data): void
    {
        $final = [];
        foreach (self::BANK_FIELDS as $field) {
            $final[$field] = array_key_exists($field, $data) ? $data[$field] : $institution->{$field};
        }

        $filled = count(array_filter($final, fn ($value) => filled($value)));

        if ($filled !== 0 && $filled !== count(self::BANK_FIELDS)) {
            throw ValidationException::withMessages([
                'bank_name' => ['Data rekening harus lengkap (bank, nama pemilik, dan nomor rekening) atau dikosongkan seluruhnya.'],
            ]);
        }
    }

    /** @return array<string,mixed> Nomor rekening hanya dicatat 4 digit terakhirnya. */
    private function snapshot(Institution $institution, User $account): array
    {
        return [
            'name' => $institution->name,
            'email' => $account->email,
            'status' => $account->status,
            'description' => $institution->description,
            'phone' => $institution->phone,
            'address' => $institution->address,
            'revenue_share_percent' => $institution->revenue_share_percent,
            'bank_name' => $institution->bank_name,
            'bank_account_holder' => $institution->bank_account_holder,
            'bank_account_last4' => $institution->bankAccountLast4(),
        ];
    }
}
