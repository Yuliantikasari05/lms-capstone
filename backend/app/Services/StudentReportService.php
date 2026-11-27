<?php

namespace App\Services;

use App\Models\Assignment;
use App\Models\AssignmentSubmission;
use App\Models\ClassSession;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LearningDay;
use App\Models\SessionAttendance;
use App\Models\StudyLog;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Laporan belajar Siswa (FR-42, FR-47) dari data nyata: waktu belajar per bulan, hari aktif,
 * progres materi, pengumpulan & nilai tugas, kehadiran sesi, dan XP.
 *
 * Semua angka dihitung dari tabel progres; tidak ada angka contoh.
 */
class StudentReportService
{
    public function __construct(private readonly StudentLearningService $learning)
    {
    }

    public function build(User $student, ?string $month = null): array
    {
        $selected = $this->parseMonth($month);
        $courses = $this->learning->courses($student);
        $courseIds = $courses->pluck('id');
        $progressByCourse = $courses->mapWithKeys(fn (Course $course) => [$course->id => $this->learning->progress($student, $course)]);

        $assignments = $this->learning->availableAssignments($student)
            ->orderByDesc('due_at')
            ->get();

        $submissions = AssignmentSubmission::query()
            ->where('user_id', $student->id)
            ->whereIn('assignment_id', $assignments->pluck('id'))
            ->get()
            ->keyBy('assignment_id');

        // ---------------------------------------------------------------- baris per mata pelajaran (kursus)
        $subjectRows = $courses->map(function (Course $course) use ($student, $assignments, $submissions, $selected, $progressByCourse) {
            $courseAssignments = $assignments->where('course_id', $course->id);
            $scores = $courseAssignments
                ->map(fn (Assignment $assignment) => $submissions->get($assignment->id)?->score)
                ->filter(fn ($score) => $score !== null);

            $minutes = (int) StudyLog::query()
                ->where('user_id', $student->id)
                ->where('course_id', $course->id)
                ->whereBetween('studied_on', [$selected->copy()->startOfMonth()->toDateString(), $selected->copy()->endOfMonth()->toDateString()])
                ->sum('minutes');

            return [
                'course_id' => $course->id,
                'subject' => $course->title,
                'progress' => $progressByCourse[$course->id]['percent'],
                'submitted' => $courseAssignments->filter(fn (Assignment $assignment) => $submissions->has($assignment->id))->count(),
                'total' => $courseAssignments->count(),
                'average' => $scores->isEmpty() ? null : round($scores->sum() / $scores->count(), 1),
                'minutes' => $minutes,
            ];
        })->values();

        // ---------------------------------------------------------------- 12 bulan terakhir
        $studyByMonth = StudyLog::query()
            ->where('user_id', $student->id)
            ->where('studied_on', '>=', $selected->copy()->startOfMonth()->subMonths(11)->toDateString())
            ->get()
            ->groupBy(fn (StudyLog $log) => $log->studied_on->format('Y-m'));

        $activeByMonth = LearningDay::query()
            ->where('user_id', $student->id)
            ->where('day', '>=', $selected->copy()->startOfMonth()->subMonths(11)->toDateString())
            ->pluck('day')
            ->groupBy(fn ($day) => Carbon::parse($day)->format('Y-m'));

        $months = collect(range(11, 0))->map(function (int $back) use ($selected, $studyByMonth, $activeByMonth) {
            $month = $selected->copy()->startOfMonth()->subMonths($back);

            return [
                'month' => $month->format('Y-m'),
                'label' => $month->translatedFormat('M'),
                'minutes' => (int) ($studyByMonth[$month->format('Y-m')] ?? collect())->sum('minutes'),
                'hours' => round(((int) ($studyByMonth[$month->format('Y-m')] ?? collect())->sum('minutes')) / 60, 1),
                'active_days' => ($activeByMonth[$month->format('Y-m')] ?? collect())->count(),
            ];
        })->values();

        $selectedKey = $selected->format('Y-m');
        $selectedMonth = $months->firstWhere('month', $selectedKey) ?? $months->last();

        // ---------------------------------------------------------------- kehadiran
        $elapsedSessions = ClassSession::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', '!=', ClassSession::STATUS_CANCELLED)
            ->where('ends_at', '<', now())
            ->get();
        $attended = SessionAttendance::query()
            ->where('user_id', $student->id)
            ->whereIn('class_session_id', $elapsedSessions->pluck('id'))
            ->count();
        $attendancePercent = $elapsedSessions->isEmpty() ? null : (int) round($attended / $elapsedSessions->count() * 100);

        // ---------------------------------------------------------------- total
        $modulesDone = $progressByCourse->sum('modules_done');
        $modulesTotal = $progressByCourse->sum('modules_total');
        $submittedCount = $assignments->filter(fn (Assignment $assignment) => $submissions->has($assignment->id))->count();
        $scores = $submissions->pluck('score')->filter(fn ($score) => $score !== null);
        $xpThisMonth = (int) \App\Models\XpTransaction::query()
            ->where('user_id', $student->id)
            ->where('amount', '>', 0)
            ->whereBetween('created_at', [$selected->copy()->startOfMonth(), $selected->copy()->endOfMonth()])
            ->sum('amount');

        $tasks = $assignments->map(fn (Assignment $assignment) => [
            'id' => $assignment->id,
            'title' => $assignment->title,
            'subject' => $assignment->course?->title,
            'kind' => $assignment->kind,
            'kind_label' => $assignment->kindLabel(),
            'due_at' => $assignment->due_at?->toIso8601String(),
            'xp_points' => (int) $assignment->xp_points,
            'state' => $this->learning->submissionState($student, $assignment),
        ])->values();

        $sessions = ClassSession::query()
            ->whereIn('course_id', $courseIds)
            ->where('status', '!=', ClassSession::STATUS_CANCELLED)
            ->orderBy('starts_at')
            ->with('course.mentor')
            ->get()
            ->map(fn (ClassSession $session) => [
                'id' => $session->id,
                'title' => $session->title,
                'course_title' => $session->course?->title,
                'mentor_name' => $session->course?->mentor?->name,
                'starts_at' => $session->starts_at?->toIso8601String(),
                'ends_at' => $session->ends_at?->toIso8601String(),
                'attended' => SessionAttendance::query()
                    ->where('class_session_id', $session->id)->where('user_id', $student->id)->exists(),
            ])->values();

        return [
            'month' => $selectedKey,
            'month_label' => $selected->translatedFormat('F Y'),
            'study_minutes' => (int) $selectedMonth['minutes'],
            'study_hours' => (float) $selectedMonth['hours'],
            'active_days' => (int) $selectedMonth['active_days'],
            'courses_count' => $courses->count(),
            'attendance_percent' => $attendancePercent,
            'modules_done' => $modulesDone,
            'modules_total' => $modulesTotal,
            'assignments_submitted' => $submittedCount,
            'assignments_total' => $assignments->count(),
            'average_score' => $scores->isEmpty() ? null : round($scores->sum() / $scores->count(), 1),
            'xp_earned' => $xpThisMonth,
            'xp_total' => $this->learning->levelInfo($student)['total_xp'],
            'subjects' => $subjectRows,
            'months' => $months,
            'tasks' => $tasks,
            'sessions' => $sessions,
            'achievements' => $this->achievements($student, $courses, $progressByCourse, $submissions),
        ];
    }

    /**
     * Pencapaian dihitung dari peristiwa nyata yang tersedia (bukan tabel pencapaian,
     * karena aturan pemberian lencana belum diputuskan di blueprint).
     */
    private function achievements(User $student, $courses, $progressByCourse, $submissions): array
    {
        $items = [];

        foreach ($courses as $course) {
            if (($progressByCourse[$course->id]['percent'] ?? 0) === 100 && $progressByCourse[$course->id]['total'] > 0) {
                $latest = StudyLog::query()
                    ->where('user_id', $student->id)
                    ->where('course_id', $course->id)
                    ->max('studied_on');

                $items[] = [
                    'type' => 'course_completed',
                    'title' => 'Menyelesaikan '.$course->title,
                    'achieved_at' => $latest ? Carbon::parse($latest)->toIso8601String() : null,
                ];
            }
        }

        $best = $submissions
            ->filter(fn (AssignmentSubmission $submission) => $submission->score !== null && $submission->score >= 80)
            ->sortByDesc('score')
            ->first();

        if ($best !== null) {
            $items[] = [
                'type' => 'best_score',
                'title' => 'Nilai Terbaik '.$best->score.' ('.$best->assignment?->title.')',
                'achieved_at' => $best->graded_at?->toIso8601String(),
            ];
        }

        $firstSubmission = $submissions->sortBy('submitted_at')->first();
        if ($firstSubmission !== null) {
            $items[] = [
                'type' => 'first_submission',
                'title' => 'Tugas Pertama Dikumpulkan',
                'achieved_at' => $firstSubmission->submitted_at?->toIso8601String(),
            ];
        }

        return collect($items)->filter(fn (array $item) => $item['achieved_at'] !== null)->take(3)->values()->all();
    }

    private function parseMonth(?string $month): Carbon
    {
        if ($month !== null && preg_match('/^\d{4}-\d{2}$/', $month)) {
            return Carbon::createFromFormat('Y-m-d', $month.'-01')->startOfMonth();
        }

        return now()->startOfMonth();
    }
}
