<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LearningDay;
use App\Models\Level;
use App\Models\Material;
use App\Models\MaterialCompletion;
use App\Models\Role;
use App\Models\SessionAttendance;
use App\Models\StudyLog;
use App\Models\User;
use App\Models\XpBalance;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Aturan belajar peserta (Siswa): progres materi, waktu belajar, kehadiran sesi, XP, hari aktif.
 *
 * Semua method menerima Siswa yang sudah lolos middleware izin + pemeriksaan enrollment.
 * Rumus yang dipakai konsisten dengan docs/tujuan-dan-kegunaan-sistem.md:
 *  - XP materi diberikan sekali saat materi diselesaikan (XpService, sumber "material").
 *  - Waktu belajar = jumlah sinyal 1 menit selama halaman materi terbuka.
 *  - Hari aktif = login pertama pada satu tanggal (kalender aplikasi), dasar streak dan laporan.
 */
class StudentLearningService
{
    public const JOIN_WINDOW_MINUTES = 15;

    public function __construct(private readonly XpService $xp)
    {
    }

    // ------------------------------------------------------------------ kursus & progres

    /** Kursus aktif yang diikuti peserta (enrollment aktif), urut pendaftaran terbaru. */
    public function courses(User $student): Collection
    {
        return Course::query()
            ->visibleTo($student)
            ->with(['mentor', 'creator', 'modules.materials'])
            ->withCount(['modules', 'sessions'])
            ->orderByDesc('id')
            ->get();
    }

    public function isEnrolled(User $student, Course $course): bool
    {
        return Enrollment::query()
            ->where('course_id', $course->id)
            ->where('user_id', $student->id)
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->exists();
    }

    /** @return array{total:int,done:int,percent:int,modules_done:int,modules_total:int} */
    public function progress(User $student, Course $course): array
    {
        $course->loadMissing('modules.materials');
        $materialIds = $course->modules->flatMap(fn ($module) => $module->materials->pluck('id'));
        $completed = $this->completedMaterialIds($student, $materialIds);

        $total = $materialIds->count();
        $done = $materialIds->filter(fn (int $id) => isset($completed[$id]))->count();

        $modulesTotal = $course->modules->count();
        $modulesDone = $course->modules->filter(function ($module) use ($completed) {
            return $module->materials->isNotEmpty()
                && $module->materials->every(fn (Material $material) => isset($completed[$material->id]));
        })->count();

        return [
            'total' => $total,
            'done' => $done,
            'percent' => $total === 0 ? 0 : (int) round($done / $total * 100),
            'modules_done' => $modulesDone,
            'modules_total' => $modulesTotal,
        ];
    }

    /** @param Collection<int,int>|null $materialIds */
    public function completedMaterialIds(User $student, ?Collection $materialIds = null): array
    {
        $query = MaterialCompletion::query()->where('user_id', $student->id);
        if ($materialIds !== null) {
            $query->whereIn('material_id', $materialIds->all());
        }

        return $query->pluck('material_id')->mapWithKeys(fn ($id) => [(int) $id => true])->all();
    }

    /** Menit belajar peserta pada satu kursus dalam bulan berjalan. */
    public function studyMinutesThisMonth(User $student, Course $course): int
    {
        return (int) StudyLog::query()
            ->where('user_id', $student->id)
            ->where('course_id', $course->id)
            ->whereBetween('studied_on', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
            ->sum('minutes');
    }

    /** Total XP yang berasal dari materi kursus ini. */
    public function materialXp(User $student, Course $course): int
    {
        $materialIds = Material::query()
            ->whereIn('course_module_id', $course->modules()->pluck('id'))
            ->pluck('id');

        return (int) MaterialCompletion::query()
            ->where('user_id', $student->id)
            ->whereIn('material_id', $materialIds)
            ->sum('xp_awarded');
    }

    // ------------------------------------------------------------------ aksi peserta

    /**
     * Menandai materi selesai dan memberi XP sekali saja.
     *
     * @return array{completed:bool,xp_awarded:int,total_xp:int}
     */
    public function completeMaterial(User $student, Material $material): array
    {
        $completion = MaterialCompletion::query()
            ->where('user_id', $student->id)
            ->where('material_id', $material->id)
            ->first();

        $awarded = 0;

        if ($completion === null) {
            $awarded = (int) $material->xp_points;

            DB::transaction(function () use ($student, $material, $awarded) {
                MaterialCompletion::query()->create([
                    'user_id' => $student->id,
                    'material_id' => $material->id,
                    'completed_at' => now(),
                    'xp_awarded' => $awarded,
                ]);
            });

            if ($awarded > 0) {
                // Idempoten: satu sumber hanya memberi XP sekali, walau dua permintaan datang bersamaan.
                $this->xp->award($student, $awarded, XpService::SOURCE_MATERIAL, $material->id, 'Menyelesaikan materi: '.$material->title);
            }
        }

        return [
            'completed' => true,
            'xp_awarded' => $awarded,
            'total_xp' => $this->xp->balanceOf($student),
        ];
    }

    /** Menambah 1 menit waktu belajar (sinyal dari halaman materi). */
    public function recordStudyMinute(User $student, Course $course): int
    {
        $today = now()->toDateString();
        // whereDate: kolom tanggal disimpan sebagai tanggal-waktu oleh SQLite.
        $log = StudyLog::query()
            ->where('user_id', $student->id)
            ->where('course_id', $course->id)
            ->whereDate('studied_on', $today)
            ->first();

        if ($log === null) {
            $log = new StudyLog(['user_id' => $student->id, 'course_id' => $course->id, 'studied_on' => $today, 'minutes' => 0]);
        }

        $log->minutes = $log->minutes + 1;
        $log->save();

        return $log->minutes;
    }

    /** Mencatat hari aktif hari ini (sekali per tanggal). */
    public function recordActiveDay(User $student): void
    {
        LearningDay::query()->firstOrCreate(
            ['user_id' => $student->id, 'day' => now()->toDateString()],
        );
    }

    /** Jumlah hari beruntun yang berakhir hari ini atau kemarin. */
    public function streak(User $student): int
    {
        $days = LearningDay::query()
            ->where('user_id', $student->id)
            ->orderByDesc('day')
            ->limit(90)
            ->pluck('day')
            ->map(fn ($day) => $day->toDateString())
            ->all();

        if ($days === []) {
            return 0;
        }

        $cursor = now()->startOfDay();
        if (($days[0] ?? null) !== $cursor->toDateString()) {
            $cursor = $cursor->subDay();
            if (($days[0] ?? null) !== $cursor->toDateString()) {
                return 0;
            }
        }

        $streak = 0;
        foreach ($days as $day) {
            if ($day !== $cursor->toDateString()) {
                break;
            }
            $streak++;
            $cursor = $cursor->subDay();
        }

        return $streak;
    }

    /** @return array{total_xp:int,level:string|null,xp_to_next:int|null,next_level:string|null} */
    public function levelInfo(User $student): array
    {
        $xp = $this->xp->balanceOf($student);
        $levels = Level::query()->orderBy('min_xp')->get();
        $current = Level::resolve($levels, $xp);
        $next = $levels->first(fn (Level $level) => $level->min_xp > $xp);

        return [
            'total_xp' => $xp,
            'level' => $current?->name,
            'xp_to_next' => $next ? $next->min_xp - $xp : null,
            'next_level' => $next?->name,
        ];
    }

    // ------------------------------------------------------------------ sesi & kehadiran

    /** Sesi yang boleh diikuti: sudah terjadwal, belum selesai, dan masih dalam jendela waktu. */
    public function canJoin(ClassSession $session): bool
    {
        if (($session->status ?? ClassSession::STATUS_SCHEDULED) === ClassSession::STATUS_CANCELLED) {
            return false;
        }

        $opens = $session->starts_at?->copy()->subMinutes(self::JOIN_WINDOW_MINUTES);

        return $opens !== null && $session->ends_at !== null
            && now()->between($opens, $session->ends_at);
    }

    /** Sesi dan tenggat tugas yang relevan untuk peserta (dipakai Jadwal dan dashboard). */
    public function schedule(User $student): array
    {
        $courses = $this->courses($student);
        $courseIds = $courses->pluck('id');
        $courseById = $courses->keyBy('id');

        $sessions = ClassSession::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', '!=', ClassSession::STATUS_CANCELLED)
            ->where('ends_at', '>=', now()->startOfDay())
            ->orderBy('starts_at')
            ->get()
            ->map(function (ClassSession $session) use ($student, $courseById) {
                $course = $courseById->get($session->course_id);

                return [
                    'id' => $session->id,
                    'type' => 'bimbingan',
                    'title' => $session->title,
                    'description' => $session->description,
                    'course_id' => $session->course_id,
                    'course_title' => $course?->title,
                    'mentor_name' => $course?->mentor?->name,
                    'starts_at' => $session->starts_at?->toIso8601String(),
                    'ends_at' => $session->ends_at?->toIso8601String(),
                    'mode' => $session->mode,
                    'location' => $session->location,
                    'schedule_status' => $session->status,
                    'time_status' => $session->timeStatus(),
                    'can_join' => $this->canJoin($session),
                    'joined' => SessionAttendance::query()
                        ->where('class_session_id', $session->id)
                        ->where('user_id', $student->id)
                        ->exists(),
                ];
            });

        $assignments = $this->availableAssignments($student)
            ->whereNotNull('due_at')
            ->orderBy('due_at')
            ->get()
            ->map(fn (Assignment $assignment) => [
                'id' => $assignment->id,
                'type' => 'tugas',
                'title' => $assignment->title,
                'kind' => $assignment->kind,
                'kind_label' => $assignment->kindLabel(),
                'course_id' => $assignment->course_id,
                'course_title' => $assignment->course?->title,
                'due_at' => $assignment->due_at?->toIso8601String(),
                'submission' => $this->submissionState($student, $assignment),
            ]);

        return ['sessions' => $sessions, 'assignments' => $assignments];
    }

    // ------------------------------------------------------------------ tugas

    /** Tugas/kuis/ujian yang sudah disetujui (dan aktif) pada kursus yang diikuti. */
    public function availableAssignments(User $student)
    {
        $courseIds = Enrollment::query()
            ->where('user_id', $student->id)
            ->where('status', Enrollment::STATUS_ACTIVE)
            ->pluck('course_id');

        return Assignment::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', Assignment::STATUS_APPROVED)
            ->where('is_active', true)
            ->with(['course.mentor'])
            ->withCount('questions');
    }

    /**
     * Status pengerjaan seorang peserta untuk satu tugas.
     *
     * @return array{status:string,label:string,submitted_at:?string,score:?int,is_late:bool,feedback:?string}
     */
    public function submissionState(User $student, Assignment $assignment): array
    {
        $submission = AssignmentSubmission::query()
            ->where('assignment_id', $assignment->id)
            ->where('user_id', $student->id)
            ->first();

        if ($submission === null) {
            return ['status' => 'belum', 'label' => 'Belum Dikerjakan', 'submitted_at' => null, 'score' => null, 'is_late' => false, 'feedback' => null];
        }

        $graded = $submission->status === AssignmentSubmission::STATUS_GRADED;

        return [
            'status' => $graded ? 'selesai' : 'dikumpulkan',
            'label' => $graded ? 'Selesai' : 'Dikumpulkan',
            'submitted_at' => $submission->submitted_at?->toIso8601String(),
            'score' => $submission->score,
            'is_late' => $assignment->due_at !== null && $submission->submitted_at !== null
                && $submission->submitted_at->gt($assignment->due_at),
            'feedback' => $submission->feedback,
        ];
    }

    // ------------------------------------------------------------------ ringkasan dashboard

    public function summary(User $student): array
    {
        $courses = $this->courses($student);
        $progressByCourse = $courses->mapWithKeys(fn (Course $course) => [$course->id => $this->progress($student, $course)]);

        // Kursus utama = kursus terakhir yang dipelajari, selain itu kursus pertama yang belum selesai.
        $lastStudied = StudyLog::query()
            ->where('user_id', $student->id)
            ->orderByDesc('studied_on')
            ->orderByDesc('updated_at')
            ->value('course_id');

        $primary = $courses->firstWhere('id', $lastStudied)
            ?? $courses->first(fn (Course $course) => ($progressByCourse[$course->id]['percent'] ?? 0) < 100)
            ?? $courses->first();

        $schedule = $this->schedule($student);
        $upcoming = collect($schedule['sessions'])
            ->filter(fn (array $session) => ($session['time_status'] ?? 'finished') !== 'finished')
            ->take(3)
            ->values();

        $pendingAssignments = $this->availableAssignments($student)
            ->whereDoesntHave('submissions', fn ($query) => $query->where('user_id', $student->id))
            ->count();

        return [
            'progress' => $primary ? [
                'course_id' => $primary->id,
                'course_title' => $primary->title,
                'modules_done' => $progressByCourse[$primary->id]['modules_done'],
                'modules_total' => $progressByCourse[$primary->id]['modules_total'],
                'materials_done' => $progressByCourse[$primary->id]['done'],
                'materials_total' => $progressByCourse[$primary->id]['total'],
                'percent' => $progressByCourse[$primary->id]['percent'],
            ] : null,
            'streak' => ['days' => $this->streak($student)],
            'level' => $this->levelInfo($student),
            'upcoming_sessions' => $upcoming,
            'leaderboard' => $this->leaderboard($student, 'all', 5),
            'courses_total' => $courses->count(),
            'courses_completed' => $courses->filter(fn (Course $course) => $progressByCourse[$course->id]['percent'] === 100 && $progressByCourse[$course->id]['total'] > 0)->count(),
            'assignments_pending' => $pendingAssignments,
            'active_days_this_month' => LearningDay::query()
                ->where('user_id', $student->id)
                ->whereBetween('day', [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()])
                ->count(),
        ];
    }

    /**
     * Papan peringkat Siswa untuk satu periode.
     *
     * @return array<int, array{rank:int,user_id:int,name:string,xp:int,is_me:bool}>
     */
    public function leaderboard(User $student, string $period, int $limit = 50): array
    {
        $since = match ($period) {
            'week' => now()->startOfWeek(),
            'month' => now()->startOfMonth(),
            default => null,
        };

        $students = User::query()
            ->whereHas('roles', fn ($query) => $query->where('slug', Role::SISWA))
            ->where('users.status', User::STATUS_ACTIVE)
            ->select(['users.id', 'users.name'])
            ->get();

        if ($since !== null) {
            $xpByUser = DB::table('xp_transactions')
                ->whereIn('user_id', $students->pluck('id'))
                ->where('created_at', '>=', $since)
                ->where('amount', '>', 0)
                ->groupBy('user_id')
                ->selectRaw('user_id, sum(amount) as xp')
                ->pluck('xp', 'user_id');
        } else {
            $xpByUser = XpBalance::query()
                ->whereIn('user_id', $students->pluck('id'))
                ->pluck('total_xp', 'user_id');
        }

        $sorted = $students
            ->map(fn (User $user) => [
                'user_id' => $user->id,
                'name' => $user->name,
                'xp' => (int) ($xpByUser[$user->id] ?? 0),
            ])
            ->sortBy([['xp', 'desc'], ['name', 'asc']])
            ->values();

        $rows = [];
        $rank = 0;
        $position = 0;
        $previousXp = null;

        foreach ($sorted as $row) {
            $position++;
            if ($previousXp === null || $row['xp'] !== $previousXp) {
                $rank = $position;
                $previousXp = $row['xp'];
            }

            $rows[] = [
                'rank' => $rank,
                'user_id' => $row['user_id'],
                'name' => $row['name'],
                'xp' => $row['xp'],
                'is_me' => $row['user_id'] === $student->id,
            ];
        }

        return array_slice($rows, 0, $limit);
    }
}
