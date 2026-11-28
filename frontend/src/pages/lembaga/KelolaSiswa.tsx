import { ChevronLeft, ChevronRight, Edit3, Plus, Search, UserRoundPlus } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { fetchStudents } from './api'

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-amber-100 text-amber-800',
  'bg-indigo-100 text-indigo-800',
  'bg-emerald-100 text-emerald-800',
  'bg-rose-100 text-rose-800',
  'bg-violet-100 text-violet-800',
]

const PAGE_SIZE = 7

export default function LembagaKelolaSiswa() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<'student' | 'enrollment' | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const students = useApiData(
    () => fetchStudents({ q: search, page, per_page: PAGE_SIZE }),
    [search, page],
  )

  const rows = students.data?.data ?? []
  const meta = students.data?.meta
  const pageCount = meta?.last_page ?? 1
  const total = meta?.total ?? 0
  const start = total === 0 || !meta ? 0 : (meta.current_page - 1) * PAGE_SIZE + 1
  const end = Math.min((meta?.current_page ?? 1) * PAGE_SIZE, total)
  const selectedStudent = rows.find((student) => student.id === selectedStudentId) ?? null

  function openCreateStudent() {
    setNotice('Akun siswa dibuat oleh Admin melalui Manajemen Pengguna. Di sini Anda hanya dapat melihat siswa program lembaga.')
    setDialog(null)
  }

  function openEditStudent() {
    setNotice('Perubahan data akun siswa dilakukan Admin melalui Manajemen Pengguna.')
    setDialog(null)
  }

  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDialog(null)
    setNotice('Pendaftaran siswa ke program dilakukan Admin melalui halaman peserta kursus.')
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setNotice('Ringkasan laporan siswa tersedia di halaman Jelajahi.')} />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>Tutup</button>
        </div>
      )}

      {students.error && <ErrorState error={students.error} onRetry={students.reload} />}

      <section aria-labelledby="students-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 id="students-title" className="text-2xl font-bold tracking-tight text-slate-900">Kelola Siswa</h1>
            <p className="mt-1 text-sm text-slate-500">Siswa yang mengikuti program lembaga Anda</p>
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
                {rows.map((student, index) => (
                  <tr key={student.id} className="border-b border-gray-100 text-sm transition-colors duration-200 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/lembaga/students/${student.id}`)}
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
                          <span key={program.id} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{program.title}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4"><StudentStatus status={student.status_label} /></td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <IconAction
                          label={`Tambah program untuk ${student.name}`}
                          onClick={() => {
                            setSelectedStudentId(student.id)
                            setDialog('enrollment')
                          }}
                          icon={<Plus className="h-4 w-4" aria-hidden />}
                          tone="blue"
                        />
                        <IconAction
                          label={`Edit ${student.name}`}
                          onClick={openEditStudent}
                          icon={<Edit3 className="h-4 w-4" aria-hidden />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {students.loading && !students.data && (
                  <tr><td colSpan={5} className="px-6 py-12"><Spinner label="Memuat siswa…" /></td></tr>
                )}
                {students.data && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                      {search ? 'Tidak ada siswa yang cocok dengan pencarian.' : 'Belum ada siswa pada program lembaga Anda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              Menampilkan {start} hingga {end} dari {total} siswa
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
      </section>

      <Modal
        open={dialog === 'student'}
        title="Tambah Siswa"
        description="Akun siswa dikelola Admin."
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button type="submit" form="student-form">Simpan</Button>
          </>
        }
      >
        <form id="student-form" className="space-y-4" onSubmit={submitDialog}>
          <Field id="student-name" label="Nama siswa">
            <input id="student-name" className={inputClass()} required maxLength={100} data-autofocus />
          </Field>
          <Field id="student-email" label="Email">
            <input id="student-email" type="email" className={inputClass()} required maxLength={150} />
          </Field>
        </form>
      </Modal>

      <Modal
        open={dialog === 'enrollment'}
        title="Tambah Program Siswa"
        description={`Pilih program untuk ${selectedStudent?.name ?? 'siswa'}.`}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button type="submit" form="enrollment-form">Simpan</Button>
          </>
        }
      >
        <form id="enrollment-form" onSubmit={submitDialog}>
          <p className="text-sm text-slate-600">
            Pendaftaran peserta ke program dilakukan Admin melalui halaman peserta kursus, agar kuota dan transaksi tercatat di satu tempat.
          </p>
        </form>
      </Modal>
    </div>
  )
}

export function StudentStatus({ status }: { status: string }) {
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
