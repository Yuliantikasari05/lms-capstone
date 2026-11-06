import { ChevronLeft, ChevronRight, Edit3, Plus, Search, UserRoundPlus } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'

export type StudentStatus = 'Aktif' | 'Nonaktif'

export interface Student {
  id: string
  name: string
  email: string
  programs: string[]
  status: StudentStatus
  initials: string
}

const COURSES = [
  'Fullstack Web Developer',
  'Desain Grafis Remaja',
  'UI/UX Design Masterclass',
  'Data Science Fundamentals',
]

const FIRST_STUDENTS: Student[] = [
  { id: 'UNI-2023-089', name: 'Arya Pratama', email: 'arya.p@example.com', programs: [COURSES[0]], status: 'Aktif', initials: 'AP' },
  { id: 'UNI-2023-090', name: 'Rendi Darmawan', email: 'rendi.d@example.com', programs: [COURSES[1]], status: 'Aktif', initials: 'RD' },
  { id: 'UNI-2023-091', name: 'Sinta Ratnasari', email: 'sinta.r@example.com', programs: [COURSES[2]], status: 'Nonaktif', initials: 'SR' },
  { id: 'UNI-2023-092', name: 'Lisa Amelia', email: 'lisa.a@example.com', programs: [COURSES[0]], status: 'Aktif', initials: 'LA' },
  { id: 'UNI-2023-093', name: 'Amanda Putri', email: 'amanda.p@example.com', programs: [COURSES[3]], status: 'Aktif', initials: 'AP' },
  { id: 'UNI-2023-094', name: 'Yudha Pratama', email: 'yudha.p@example.com', programs: [COURSES[1]], status: 'Nonaktif', initials: 'YP' },
  { id: 'UNI-2023-095', name: 'Julian Jacob', email: 'julian.j@example.com', programs: [COURSES[0]], status: 'Aktif', initials: 'JJ' },
]

const EXTRA_NAMES = [
  'Nadia Putri', 'Fajar Ramadhan', 'Alya Safitri', 'Dimas Saputra', 'Rizky Firmansyah',
  'Citra Maharani', 'Bagas Setiawan', 'Novi Diana', 'Melati Ayu', 'Andi Wijaya',
  'Putri Malika', 'Rafi Kurniawan', 'Dewi Anggraini', 'Yoga Pratama', 'Intan Permata',
  'Bima Aditya', 'Salsa Nabila', 'Farhan Akbar', 'Maya Lestari', 'Raka Maulana',
  'Vina Oktavia', 'Ilham Fauzi', 'Anisa Zahra', 'Kevin Jonathan', 'Tika Puspita',
  'Arif Hidayat', 'Nina Amelia', 'Reza Saputra', 'Lukman Hakim', 'Fitri Handayani',
  'Rian Kurnia', 'Wulan Sari', 'Hendra Gunawan', 'Naufal Rizki', 'Rosa Aprilia',
]

export function createInitialStudents(): Student[] {
  return [
    ...FIRST_STUDENTS,
    ...EXTRA_NAMES.map((name, index) => {
      const initials = name
        .split(' ')
        .map((part) => part[0])
        .join('')
      return {
        id: `UNI-2023-${String(96 + index).padStart(3, '0')}`,
        name,
        email: `${name.toLowerCase().replace(/ /g, '.')}@example.com`,
        programs: [COURSES[index % COURSES.length]],
        status: index % 5 === 2 ? 'Nonaktif' as const : 'Aktif' as const,
        initials,
      }
    }),
  ]
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
]

export default function LembagaKelolaSiswa() {
  const navigate = useNavigate()
  const [students, setStudents] = useState(createInitialStudents)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<'student' | 'enrollment' | null>(null)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [studentProgram, setStudentProgram] = useState(COURSES[0])
  const [studentStatus, setStudentStatus] = useState<StudentStatus>('Aktif')
  const [enrollmentProgram, setEnrollmentProgram] = useState(COURSES[0])
  const [notice, setNotice] = useState('')
  const pageSize = 7

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('id-ID')
    if (!query) return students
    return students.filter((student) =>
      `${student.name} ${student.email} ${student.programs.join(' ')} ${student.id}`.toLocaleLowerCase('id-ID').includes(query),
    )
  }, [search, students])
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / pageSize))
  const visibleStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize)
  const start = filteredStudents.length === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, filteredStudents.length)

  function openCreateStudent() {
    setEditingStudentId(null)
    setStudentName('')
    setStudentEmail('')
    setStudentProgram(COURSES[0])
    setStudentStatus('Aktif')
    setDialog('student')
  }

  function openEditStudent(student: Student) {
    setEditingStudentId(student.id)
    setStudentName(student.name)
    setStudentEmail(student.email)
    setStudentProgram(student.programs[0] ?? COURSES[0])
    setStudentStatus(student.status)
    setDialog('student')
  }

  function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = studentName.trim()
    const email = studentEmail.trim()
    if (!name || !email) return
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

    if (editingStudentId) {
      setStudents((current) =>
        current.map((student) =>
          student.id === editingStudentId
            ? {
                ...student,
                name,
                email,
                programs: [studentProgram, ...student.programs.filter((program) => program !== studentProgram)],
                status: studentStatus,
                initials,
              }
            : student,
        ),
      )
      setNotice(`Data ${name} diperbarui pada pratinjau.`)
    } else {
      const id = `UNI-2026-${String(Date.now()).slice(-3)}`
      setStudents((current) => [
        { id, name, email, programs: [studentProgram], status: studentStatus, initials },
        ...current,
      ])
      setPage(1)
      setNotice(`Siswa ${name} ditambahkan pada pratinjau.`)
    }
    setDialog(null)
  }

  function addEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStudentId) return
    const student = students.find((item) => item.id === selectedStudentId)
    if (!student) return
    if (student.programs.includes(enrollmentProgram)) {
      setNotice(`${student.name} sudah terdaftar di ${enrollmentProgram}.`)
      setDialog(null)
      return
    }
    setStudents((current) =>
      current.map((item) => item.id === selectedStudentId ? { ...item, programs: [...item.programs, enrollmentProgram] } : item),
    )
    setNotice(`${enrollmentProgram} ditambahkan untuk ${student.name} pada pratinjau.`)
    setDialog(null)
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setNotice('Ringkasan laporan siswa belum tersedia di pratinjau.')} />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      <section aria-labelledby="students-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="students-title" className="text-2xl font-bold tracking-tight text-slate-900">Kelola Siswa</h1>
            <p className="mt-1 text-sm text-slate-500">Kelola siswa Anda</p>
          </div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <label className="relative min-w-0 flex-1 min-[420px]:w-56">
              <span className="sr-only">Cari siswa</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Cari siswa..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <Button onClick={openCreateStudent} icon={<UserRoundPlus className="h-4 w-4" aria-hidden />} className="shrink-0">
              Tambah
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left font-sans antialiased">
              <thead className="bg-gray-50/50">
                <tr className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th scope="col" className="px-6 py-4">NAMA SISWA</th>
                  <th scope="col" className="px-6 py-4">EMAIL</th>
                  <th scope="col" className="px-6 py-4">PROGRAM DIIKUTI</th>
                  <th scope="col" className="px-6 py-4">STATUS</th>
                  <th scope="col" className="px-6 py-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student, index) => (
                  <tr key={student.id} className="border-b border-gray-100 text-sm transition-colors duration-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/lembaga/students/${encodeURIComponent(student.id)}`)}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                          {student.initials}
                        </span>
                        <span className="whitespace-nowrap text-sm font-medium text-gray-900 hover:text-brand-700">{student.name}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{student.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {student.programs.map((program) => (
                          <span key={program} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{program}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4"><StudentStatus status={student.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <IconAction
                          label={`Tambah program untuk ${student.name}`}
                          onClick={() => {
                            setSelectedStudentId(student.id)
                            setEnrollmentProgram(COURSES.find((course) => !student.programs.includes(course)) ?? COURSES[0])
                            setDialog('enrollment')
                          }}
                          icon={<Plus className="h-4 w-4" aria-hidden />}
                          tone="blue"
                        />
                        <IconAction
                          label={`Edit ${student.name}`}
                          onClick={() => openEditStudent(student)}
                          icon={<Edit3 className="h-4 w-4" aria-hidden />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleStudents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                      Tidak ada siswa yang cocok dengan pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {start} hingga {end} dari {filteredStudents.length} siswa
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="px-3 py-1.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Sebelumnya
              </Button>
              <Button
                variant="secondary"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="px-3 py-1.5 text-xs"
              >
                Selanjutnya <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </footer>
        </div>
        <p className="mt-3 text-xs text-slate-500">Data siswa dan program merupakan contoh untuk pratinjau frontend.</p>
      </section>

      <Modal
        open={dialog === 'student'}
        title={editingStudentId ? 'Edit Data Siswa' : 'Tambah Siswa'}
        description="Kelola data siswa pada pratinjau."
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button type="submit" form="student-form">Simpan</Button>
          </>
        }
      >
        <form id="student-form" className="space-y-4" onSubmit={saveStudent}>
          <Field id="student-name" label="Nama siswa">
            <input id="student-name" className={inputClass()} value={studentName} onChange={(event) => setStudentName(event.target.value)} required maxLength={100} data-autofocus />
          </Field>
          <Field id="student-email" label="Email">
            <input id="student-email" type="email" className={inputClass()} value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} required maxLength={150} />
          </Field>
          <Field id="student-program" label="Program diikuti">
            <select id="student-program" className={inputClass()} value={studentProgram} onChange={(event) => setStudentProgram(event.target.value)}>
              {COURSES.map((course) => <option key={course}>{course}</option>)}
            </select>
          </Field>
          <Field id="student-status" label="Status">
            <select id="student-status" className={inputClass()} value={studentStatus} onChange={(event) => setStudentStatus(event.target.value as StudentStatus)}>
              <option>Aktif</option>
              <option>Nonaktif</option>
            </select>
          </Field>
          <p className="text-xs text-slate-500">Perubahan hanya disimpan sementara di pratinjau.</p>
        </form>
      </Modal>

      <Modal
        open={dialog === 'enrollment'}
        title="Tambah Program Siswa"
        description={`Pilih program untuk ${students.find((student) => student.id === selectedStudentId)?.name ?? 'siswa'}.`}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button type="submit" form="enrollment-form">Simpan</Button>
          </>
        }
      >
        <form id="enrollment-form" onSubmit={addEnrollment}>
          <Field id="enrollment-program" label="Program">
            <select id="enrollment-program" className={inputClass()} value={enrollmentProgram} onChange={(event) => setEnrollmentProgram(event.target.value)} data-autofocus>
              {COURSES.map((course) => (
                <option key={course} value={course} disabled={students.find((student) => student.id === selectedStudentId)?.programs.includes(course)}>
                  {course}{students.find((student) => student.id === selectedStudentId)?.programs.includes(course) ? ' (sudah diikuti)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-3 text-xs text-slate-500">Program siswa diperbarui untuk pratinjau lokal.</p>
        </form>
      </Modal>
    </div>
  )
}

export function StudentStatus({ status }: { status: StudentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status === 'Aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
      {status === 'Aktif' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
      {status}
    </span>
  )
}

function IconAction({
  label,
  onClick,
  icon,
  tone = 'slate',
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  tone?: 'slate' | 'blue'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline ${tone === 'blue' ? 'text-brand-700 hover:bg-blue-50' : 'text-slate-600 hover:bg-slate-100'}`}
    >
      {icon}
    </button>
  )
}
