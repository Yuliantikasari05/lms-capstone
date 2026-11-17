import {
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  UserRound,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { EmptyState } from '../../components/ui/States'

type Audience = 'Siswa' | 'Karyawan'
type SubmissionStatus = 'Belum dinilai' | 'Sudah dinilai'

interface SubmittedQuestion {
  id: number
  type: 'Pilihan ganda' | 'Essay' | 'Upload file'
  prompt: string
  points: number
  maxPoints: number
  answer: string
  options?: { label: string; text: string; correct?: boolean; selected?: boolean }[]
  fileName?: string
}

interface AssignmentSubmission {
  id: number
  audience: Audience
  studentName: string
  assignmentTitle: string
  courseTitle: string
  submittedAt: string
  status: SubmissionStatus
  score: number | null
  feedback: string
  questions: SubmittedQuestion[]
}

const INITIAL_QUESTION_SET: SubmittedQuestion[] = [
  {
    id: 1,
    type: 'Pilihan ganda',
    prompt: 'Kalimat di bawah ini yang menggunakan penulisan kata depan yang tepat adalah',
    points: 0,
    maxPoints: 30,
    answer: 'B',
    options: [
      { label: 'A', text: 'Kucing itu tidur diatas kasur.' },
      { label: 'B', text: 'Ayah pergi ke kantor setiap pagi.', correct: true, selected: true },
      { label: 'C', text: 'Buku itu diletakkan dimeja.' },
    ],
  },
  {
    id: 2,
    type: 'Essay',
    prompt: 'Tuliskan kembali kalimat berikut dengan memperbaiki penulisan kata serapan dan tanda baca yang salah.',
    points: 0,
    maxPoints: 30,
    answer: 'Jadwal ujian apotek akan diumumkan hari ini, tetapi para siswa belum mengetahuinya.',
  },
  {
    id: 3,
    type: 'Upload file',
    prompt: 'Buatlah 5 paragraf dengan tema liburan akhir semester dengan ejaan dan tanda baca yang benar.',
    points: 0,
    maxPoints: 40,
    answer: 'Tugas bahasa Indonesia.pdf · 1.5 MB',
    fileName: 'Tugas bahasa Indonesia.pdf',
  },
]

const FIRST_STUDENT_ROWS: Omit<AssignmentSubmission, 'id' | 'audience' | 'questions'>[] = [
  { studentName: 'Syamsul Amilien', assignmentTitle: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseTitle: 'Bahasa Indonesia Lanjutan', submittedAt: '10 Jun 2026, 13:02', status: 'Sudah dinilai', score: 88, feedback: 'Jawaban baik, perhatikan kembali penggunaan kata depan.' },
  { studentName: 'Syamsul Amilien', assignmentTitle: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseTitle: 'Bahasa Indonesia Lanjutan', submittedAt: '10 Jun 2026, 13:02', status: 'Sudah dinilai', score: 88, feedback: 'Pekerjaan sudah sesuai instruksi.' },
  { studentName: 'Auditya Wira A', assignmentTitle: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseTitle: 'Bahasa Indonesia Lanjutan', submittedAt: '10 Jun 2026, 13:02', status: 'Belum dinilai', score: null, feedback: '' },
  { studentName: 'Syamsul Amilien', assignmentTitle: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseTitle: 'Bahasa Indonesia Lanjutan', submittedAt: '10 Jun 2026, 13:02', status: 'Belum dinilai', score: null, feedback: '' },
  { studentName: 'Syamsul Amilien', assignmentTitle: 'Tugas 1: Ejaan dalam bahasa Indonesia', courseTitle: 'Bahasa Indonesia Lanjutan', submittedAt: '10 Jun 2026, 13:02', status: 'Sudah dinilai', score: 88, feedback: 'Terus pertahankan hasil belajarnya.' },
]

const FIRST_EMPLOYEE_ROWS: Omit<AssignmentSubmission, 'id' | 'audience' | 'questions'>[] = [
  { studentName: 'Alya Putri', assignmentTitle: 'Kuis 3: Membuat API Google Meet', courseTitle: 'Fullstack web developer professional', submittedAt: '12 Jun 2026, 10:15', status: 'Sudah dinilai', score: 92, feedback: 'Pemahaman API sudah sangat baik.' },
  { studentName: 'Rizky Pratama', assignmentTitle: 'Kuis 3: Membuat API Google Meet', courseTitle: 'Fullstack web developer professional', submittedAt: '12 Jun 2026, 11:20', status: 'Sudah dinilai', score: 84, feedback: 'Perhatikan detail alur autentikasi.' },
  { studentName: 'Dina Maharani', assignmentTitle: 'Analisis keamanan jaringan', courseTitle: 'Cyber security fundamental', submittedAt: '13 Jun 2026, 09:30', status: 'Belum dinilai', score: null, feedback: '' },
  { studentName: 'Rizky Pratama', assignmentTitle: 'Kuis 3: Membuat API Google Meet', courseTitle: 'Fullstack web developer professional', submittedAt: '13 Jun 2026, 14:02', status: 'Belum dinilai', score: null, feedback: '' },
  { studentName: 'Syamsul Amilien', assignmentTitle: 'Kuis 3: Membuat API Google Meet', courseTitle: 'Fullstack web developer professional', submittedAt: '14 Jun 2026, 13:02', status: 'Sudah dinilai', score: 88, feedback: 'Hasil baik, lanjutkan latihan.' },
]

const MORE_STUDENTS = ['Lisa Amelia', 'Nadia Safitri', 'Fajar Ramadhan', 'Sinta Ratnasari', 'Putri Maharani', 'Dentri Aprilia', 'Yudha Pratama', 'Auditya Wira A']
const MORE_EMPLOYEES = ['Rizky Pratama', 'Dina Maharani', 'Syamsul Amilien', 'Dentri Aprilia', 'Yudha Pratama', 'Putri Maharani', 'Alya Putri', 'Fajar Ramadhan']
const STUDENT_TASKS = ['Kuis: Struktur teks', 'Tugas: Analisis paragraf', 'Latihan ejaan bahasa Indonesia', 'Tugas: Membuat ringkasan']
const EMPLOYEE_TASKS = ['Kuis: Struktur basis data', 'Tugas: Membuat API sederhana', 'Latihan keamanan jaringan', 'Tugas: Analisis data']

function questionsForScore(score: number | null): SubmittedQuestion[] {
  const questions = INITIAL_QUESTION_SET.map((question) => ({ ...question }))
  const multipleChoicePoints = getMultipleChoicePoints(questions[0])
  questions[0].points = multipleChoicePoints
  if (score === null) return questions

  const remainingScore = Math.max(0, score - multipleChoicePoints)
  const essayPoints = Math.min(30, Math.round(remainingScore / 2))
  questions[1].points = essayPoints
  questions[2].points = Math.min(40, Math.max(0, remainingScore - essayPoints))
  return questions
}

function getMultipleChoicePoints(question: SubmittedQuestion): number {
  const options = question.options ?? []
  const correctOptions = options.filter((option) => option.correct)
  const selectedOptions = options.filter((option) => option.selected)
  const isCorrect = correctOptions.length > 0
    && selectedOptions.length === correctOptions.length
    && selectedOptions.every((option) => option.correct)
  return isCorrect ? question.maxPoints : 0
}

function createSubmissions(audience: Audience): AssignmentSubmission[] {
  const firstRows = audience === 'Siswa' ? FIRST_STUDENT_ROWS : FIRST_EMPLOYEE_ROWS
  const names = audience === 'Siswa' ? MORE_STUDENTS : MORE_EMPLOYEES
  const tasks = audience === 'Siswa' ? STUDENT_TASKS : EMPLOYEE_TASKS
  const extras = Array.from({ length: 33 }, (_, index) => {
    const id = index + 6
    const pending = index === 4 || index === 13 || index === 24
    const task = tasks[index % tasks.length]
    return {
      studentName: names[index % names.length],
      assignmentTitle: task,
      courseTitle: audience === 'Siswa' ? 'Bahasa Indonesia Lanjutan' : 'Fullstack web developer professional',
      submittedAt: `${15 + index % 12} Jun 2026, ${String(9 + index % 8).padStart(2, '0')}:${String(index * 7 % 60).padStart(2, '0')}`,
      status: pending ? 'Belum dinilai' as const : 'Sudah dinilai' as const,
      score: pending ? null : 72 + (index * 7) % 29,
      feedback: pending ? '' : 'Pengerjaan sudah ditinjau oleh Mentor.',
      id,
      audience,
      questions: questionsForScore(pending ? null : 72 + (index * 7) % 29),
    }
  })

  return [
    ...firstRows.map((row, index) => ({ ...row, id: index + 1, audience, questions: questionsForScore(row.score) })),
    ...extras,
  ]
}

const SUBMISSIONS: Record<Audience, AssignmentSubmission[]> = {
  Siswa: createSubmissions('Siswa'),
  Karyawan: createSubmissions('Karyawan'),
}

const PAGE_SIZE = 5

const STATUS_STYLES: Record<SubmissionStatus, string> = {
  'Sudah dinilai': 'bg-green-50 text-green-700',
  'Belum dinilai': 'bg-amber-50 text-amber-700',
}

export function AssignmentSubmissions({ audience }: { audience: Audience }) {
  const [rows, setRows] = useState(SUBMISSIONS[audience])
  const [taskFilter, setTaskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const tasks = useMemo(() => [...new Set(rows.map((row) => row.assignmentTitle))], [rows])
  const filteredRows = rows.filter((row) =>
    (taskFilter === 'all' || row.assignmentTitle === taskFilter)
    && (statusFilter === 'all' || row.status === statusFilter),
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedSubmission = rows.find((row) => row.id === selectedId)

  const saveAssessment = (submissionId: number, score: number, feedback: string, questions: SubmittedQuestion[]) => {
    setRows((current) => current.map((row) => row.id === submissionId
      ? { ...row, status: 'Sudah dinilai', score, feedback, questions }
      : row))
  }

  if (selectedSubmission) {
    return (
      <AssessmentReview
        key={selectedSubmission.id}
        submission={selectedSubmission}
        onBack={() => setSelectedId(null)}
        onSelect={(id) => setSelectedId(id)}
        onSave={saveAssessment}
        submissionIds={filteredRows.map((row) => row.id)}
      />
    )
  }

  const totalCount = rows.length
  const waitingCount = rows.filter((row) => row.status === 'Belum dinilai').length
  const gradedCount = totalCount - waitingCount

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Pengumpulan tugas {audience.toLowerCase()}</h1>
          <p className="mt-1 text-xs text-slate-500">Pantau dan nilai seluruh tugas yang dikumpulkan {audience.toLowerCase()}.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SubmissionMetric icon={ClipboardCheck} value={totalCount} label="Pengumpulan" tone="blue" />
          <SubmissionMetric icon={Clock3} value={waitingCount} label="Belum dinilai" tone="amber" />
          <SubmissionMetric icon={CalendarCheck} value={gradedCount} label="Sudah dinilai" tone="green" />
        </div>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <label>
          <span className="sr-only">Filter tugas</span>
          <select value={taskFilter} onChange={(event) => { setTaskFilter(event.target.value); setPage(1) }} className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500">
            <option value="all">Semua tugas</option>
            {tasks.map((task) => <option key={task} value={task}>{task}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter status penilaian</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as 'all' | SubmissionStatus); setPage(1) }} className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-500">
            <option value="all">Semua status</option>
            <option value="Belum dinilai">Belum dinilai</option>
            <option value="Sudah dinilai">Sudah dinilai</option>
          </select>
        </label>
      </div>

      {visibleRows.length === 0 ? (
        <div className="mt-4"><EmptyState title="Pengumpulan tidak ditemukan" description="Coba ubah filter tugas atau status." /></div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[54rem] text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Nama {audience === 'Siswa' ? 'siswa' : 'karyawan'}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Tugas</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Waktu pengumpulan</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Nilai</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><UserRound className="h-4 w-4" aria-hidden /></span>
                        <span className="font-medium text-slate-800">{row.studentName}</span>
                      </div>
                    </td>
                    <td className="max-w-56 truncate px-3 py-3 text-slate-700" title={row.assignmentTitle}>{row.assignmentTitle}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.submittedAt}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[10px] font-medium ${STATUS_STYLES[row.status]}`}>{row.status}</span></td>
                    <td className="px-3 py-3 text-center font-medium text-slate-700">{row.score ?? '--'}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${
                          row.status === 'Belum dinilai' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {row.status === 'Belum dinilai' ? 'Nilai' : 'Lihat nilai'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>Menampilkan {filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredRows.length)} dari {filteredRows.length} pengumpulan</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} type="button" aria-current={pageNumber === page ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`min-w-7 rounded px-2 py-1.5 ${pageNumber === page ? 'bg-brand-600 font-semibold text-white' : 'hover:bg-slate-100'}`}>{pageNumber}</button>
              ))}
              <button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} className="rounded border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          </footer>
        </>
      )}
      <p className="mt-4 text-center text-[10px] text-slate-400">Pratinjau statis · data pengumpulan dan nilai hanya contoh.</p>
    </section>
  )
}

function AssessmentReview({
  submission,
  submissionIds,
  onBack,
  onSelect,
  onSave,
}: {
  submission: AssignmentSubmission
  submissionIds: number[]
  onBack: () => void
  onSelect: (id: number) => void
  onSave: (id: number, score: number, feedback: string, questions: SubmittedQuestion[]) => void
}) {
  const [questions, setQuestions] = useState(submission.questions.map((question) => ({ ...question })))
  const [feedback, setFeedback] = useState(submission.feedback)
  const [notice, setNotice] = useState<string | null>(null)
  const graded = submission.status === 'Sudah dinilai'
  const reviewedQuestions = questions.map((question) => question.type === 'Pilihan ganda'
    ? { ...question, points: getMultipleChoicePoints(question) }
    : question)
  const totalScore = reviewedQuestions.reduce((sum, question) => sum + question.points, 0)
  const maxScore = questions.reduce((sum, question) => sum + question.maxPoints, 0)
  const currentIndex = submissionIds.indexOf(submission.id)

  const setQuestionPoints = (questionId: number, points: number) => {
    setQuestions((current) => current.map((question) => question.id === questionId
      && question.type !== 'Pilihan ganda'
      ? { ...question, points: Math.min(question.maxPoints, Math.max(0, points || 0)) }
      : question))
  }

  const submitGrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(submission.id, totalScore, feedback, reviewedQuestions)
    setNotice('Penilaian berhasil disimpan pada pratinjau.')
  }

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><UserRound className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{submission.studentName}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${STATUS_STYLES[submission.status]}`}>{submission.status}</span>
            </div>
            <p className="mt-1 truncate text-[10px] text-slate-500">{submission.assignmentTitle} · Dikumpulkan pada: {submission.submittedAt}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"><ArrowLeft className="mr-1 inline h-3.5 w-3.5" aria-hidden />Kembali</button>
          <button type="button" disabled={currentIndex <= 0} onClick={() => onSelect(submissionIds[currentIndex - 1])} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">‹ Sebelumnya</button>
          <button type="button" disabled={currentIndex < 0 || currentIndex >= submissionIds.length - 1} onClick={() => onSelect(submissionIds[currentIndex + 1])} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">Selanjutnya ›</button>
        </div>
      </div>

      {notice && <p role="status" aria-live="polite" className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">{notice}</p>}

      <form onSubmit={submitGrade} className="mentor-assignment-layout">
        <div className="min-w-0 space-y-3">
          {reviewedQuestions.map((question, index) => (
            <SubmittedQuestionCard
              key={question.id}
              question={question}
              index={index}
              readOnly={graded}
              onPointsChange={(points) => setQuestionPoints(question.id, points)}
            />
          ))}
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Penilaian</h3>
          <label className="block text-[10px] text-slate-600" htmlFor="student-grade">
            Nilai {submission.audience.toLowerCase()}
            <span className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800" id="student-grade">{totalScore}</span>
          </label>
          <div>
            <p className="text-[10px] text-slate-600">Rincian poin</p>
            <ul className="mt-2 space-y-2 border-b border-slate-200 pb-3">
              {reviewedQuestions.map((question) => (
                <li key={question.id} className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span>{question.type} (1 soal)</span>
                  <span className="shrink-0">{question.points}/{question.maxPoints} poin</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex justify-between text-[10px] font-semibold text-slate-600"><span>Total poin</span><span>{totalScore} poin</span></p>
            <p className="mt-1 text-right text-[9px] text-slate-400">Maksimal {maxScore} poin</p>
          </div>
          <label className="block text-[10px] text-slate-600" htmlFor="student-feedback">
            Feedback untuk {submission.audience.toLowerCase()}
            <textarea
              id="student-feedback"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              disabled={graded}
              rows={3}
              placeholder="Tulis feedback untuk peserta"
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </label>
          <button type="submit" disabled={graded} className="w-full rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
            {graded ? 'Penilaian sudah disimpan' : 'Simpan nilai'}
          </button>
          {!graded && reviewedQuestions.some((question) => question.type === 'Pilihan ganda') && (
            <p className="text-center text-[10px] leading-4 text-slate-500">
              Nilai pilihan ganda dihitung otomatis. Klik Simpan nilai untuk menyelesaikan review dan mengubah status tugas.
            </p>
          )}
          {graded && <p className="text-center text-[10px] text-slate-400">Mode lihat hasil · nilai dan feedback tidak dapat diubah dari halaman ini.</p>}
        </aside>
      </form>
    </div>
  )
}

function SubmittedQuestionCard({
  question,
  index,
  readOnly,
  onPointsChange,
}: {
  question: SubmittedQuestion
  index: number
  readOnly: boolean
  onPointsChange: (points: number) => void
}) {
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <header className="flex items-center justify-between gap-2 text-[10px] text-slate-600">
        <span>Soal {index + 1} · {question.type}</span>
        <span>Poin: {question.points}/{question.maxPoints}</span>
      </header>
      <p className="text-xs font-medium leading-5 text-slate-800">{question.prompt}</p>
      {question.options && (
        <ul className="space-y-2">
          {question.options.map((option) => (
            <li key={option.label} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[10px] ${
              option.correct ? 'border-green-300 bg-green-50 text-green-700' : option.selected ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-700'
            }`}>
              <span><strong className="mr-2">{option.label}.</strong>{option.text}</span>
              <span className="shrink-0 text-[9px] font-semibold">
                {option.correct && option.selected ? 'Dipilih · Jawaban benar' : option.correct ? 'Jawaban benar' : option.selected ? 'Dipilih peserta' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {question.type === 'Essay' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-[9px] font-semibold text-green-700">Jawaban peserta</p>
          <p className="mt-1 text-[10px] leading-5 text-green-800">{question.answer}</p>
        </div>
      )}
      {question.type === 'Upload file' && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
          <FileText className="h-5 w-5 text-brand-600" aria-hidden />
          <div><p className="text-[10px] font-medium text-slate-800">{question.fileName}</p><p className="mt-1 text-[9px] text-slate-500">{question.answer}</p></div>
        </div>
      )}
      {question.type === 'Pilihan ganda' ? (
        <p className="text-[10px] font-medium text-green-700">
          Nilai otomatis oleh sistem: {question.points}/{question.maxPoints} poin
        </p>
      ) : (
        <label className="flex items-center gap-2 text-[10px] text-slate-600">
          Nilai anda
          <input type="number" min="0" max={question.maxPoints} value={question.points} disabled={readOnly} onChange={(event) => onPointsChange(Number(event.target.value))} aria-label={`Nilai soal ${index + 1}`} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-xs disabled:bg-slate-50" />
          / {question.maxPoints} poin
        </label>
      )}
    </article>
  )
}

function SubmissionMetric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof ClipboardCheck
  value: number
  label: string
  tone: 'blue' | 'amber' | 'green'
}) {
  const styles = {
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    green: 'text-green-600 bg-green-50',
  }
  return (
    <div className="flex min-w-20 flex-col items-center rounded-lg border border-slate-200 px-2 py-2">
      <Icon className={`h-4 w-4 ${styles[tone].split(' ')[0]}`} aria-hidden />
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
      <p className="text-[9px] text-slate-500">{label}</p>
    </div>
  )
}
