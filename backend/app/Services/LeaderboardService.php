<?php

namespace App\Services;

use App\Models\Level;
use App\Models\Role;
use App\Models\User;
use App\Support\Like;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Papan peringkat dan ringkasan XP. Yang dihitung adalah seluruh Siswa AKTIF yang belum dihapus
 * (Siswa tanpa XP dihitung 0, sehingga rata-rata XP per pengguna konsisten).
 */
class LeaderboardService
{
    /** Siswa aktif yang belum dihapus (soft delete otomatis dikecualikan). */
    public function eligible(): Builder
    {
        return User::query()
            ->whereHas('roles', fn (Builder $q) => $q->where('slug', Role::SISWA))
            ->where('users.status', User::STATUS_ACTIVE);
    }

    private function withBalance(Builder $query): Builder
    {
        return $query->leftJoin('xp_balances', 'xp_balances.user_id', '=', 'users.id');
    }

    /** @return array{students_count:int,total_xp:int,average_xp:float,highest_xp:int,levels_count:int} */
    public function summary(): array
    {
        $row = $this->withBalance($this->eligible())
            ->selectRaw('count(*) as students, coalesce(sum(coalesce(xp_balances.total_xp, 0)), 0) as total, coalesce(max(coalesce(xp_balances.total_xp, 0)), 0) as highest')
            ->first();

        $students = (int) $row->students;
        $total = (int) $row->total;

        return [
            'students_count' => $students,
            'total_xp' => $total,
            'average_xp' => $students === 0 ? 0.0 : round($total / $students, 1),
            'highest_xp' => (int) $row->highest,
            'levels_count' => Level::count(),
        ];
    }

    /**
     * Peringkat kompetisi: skor sama berbagi nomor, nomor berikutnya melompat (1, 2, 2, 4).
     * Dihitung dari sebaran XP seluruh Siswa, sehingga tidak tergantung halaman atau pencarian.
     *
     * @return array<int,int> xp => peringkat
     */
    public function rankMap(): array
    {
        $distribution = $this->withBalance($this->eligible())
            ->selectRaw('coalesce(xp_balances.total_xp, 0) as xp, count(*) as total')
            ->groupBy(DB::raw('coalesce(xp_balances.total_xp, 0)'))
            ->orderByDesc('xp')
            ->get();

        $map = [];
        $ahead = 0;
        foreach ($distribution as $row) {
            $map[(int) $row->xp] = $ahead + 1;
            $ahead += (int) $row->total;
        }

        return $map;
    }

    /** Satu halaman papan peringkat. Setiap pengguna diberi atribut: xp, rank, level_data. */
    public function paginate(?string $search, int $perPage): LengthAwarePaginator
    {
        $paginator = $this->withBalance($this->eligible())
            ->select('users.*')
            ->selectRaw('coalesce(xp_balances.total_xp, 0) as xp')
            ->when(filled($search), function (Builder $query) use ($search) {
                $like = Like::contains((string) $search);
                $query->where(fn (Builder $q) => $q
                    ->whereRaw("lower(users.name) like ? escape '!'", [$like])
                    ->orWhereRaw("lower(users.email) like ? escape '!'", [$like]));
            })
            ->orderByDesc('xp')
            ->orderBy('users.name')
            ->orderBy('users.id')
            ->paginate($perPage);

        $ranks = $this->rankMap();
        $levels = Level::all();

        $paginator->getCollection()->transform(function (User $user) use ($ranks, $levels) {
            $xp = (int) $user->xp;
            $level = Level::resolve($levels, $xp);

            $user->setAttribute('rank', $ranks[$xp] ?? null);
            $user->setAttribute('level_data', $level ? ['id' => $level->id, 'name' => $level->name] : null);

            return $user;
        });

        return $paginator;
    }
}
