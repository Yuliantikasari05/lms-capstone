import { ArrowLeft, ChevronLeft, ChevronRight, Eye, MessageCircle, MessageSquare, Send } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'

interface DiscussionThread {
  id: number
  title: string
  author: string
  time: string
  status: 'SEDANG DISKUSI' | 'DIJAWAB' | 'TERTUTUP'
  body: string
  replies: number
  views: number
  avatar: string
}

const INITIAL_THREADS: DiscussionThread[] = [
  {
    id: 1,
    title: 'Tanya: Error saat instalasi Node.js',
    author: 'Putri Malika',
    time: '2 jam yang lalu',
    status: 'SEDANG DISKUSI',
    body: 'Halo Ibu Hanna, saya mengalami kendala saat mencoba menginstal Node.js di Windows 11. Muncul error “Access is denied” meskipun sudah menggunakan administrator. Apakah ada langkah khusus untuk versi LTS ini?',
    replies: 8,
    views: 42,
    avatar: 'PM',
  },
  {
    id: 2,
    title: 'Bagaimana struktur folder terbaik untuk Project React?',
    author: 'Novi Diana',
    time: '5 jam yang lalu',
    status: 'DIJAWAB',
    body: 'Ibu, saya masih bingung apakah folder hooks dan services harus dipisah atau dijadikan satu dalam folder core? Mohon sarannya.',
    replies: 3,
    views: 18,
    avatar: 'ND',
  },
  {
    id: 3,
    title: 'Tugas Module 4: Apakah boleh menggunakan Tailwind?',
    author: 'Melati Ayu',
    time: 'Kemarin',
    status: 'TERTUTUP',
    body: 'Di instruksi tugas disebutkan menggunakan CSS murni, tapi saya lebih terbiasa dengan Tailwind CSS. Apakah diperbolehkan untuk tugas akhir?',
    replies: 12,
    views: 124,
    avatar: 'MA',
  },
  {
    id: 4,
    title: 'Bagaimana cara mengatur environment variable?',
    author: 'Rizky Pratama',
    time: '2 hari yang lalu',
    status: 'DIJAWAB',
    body: 'Saya ingin memisahkan konfigurasi lokal dan production. Apakah ada pola yang direkomendasikan?',
    replies: 4,
    views: 37,
    avatar: 'RP',
  },
  {
    id: 5,
    title: 'Review desain database untuk aplikasi kursus',
    author: 'Alya Putri',
    time: '3 hari yang lalu',
    status: 'SEDANG DISKUSI',
    body: 'Saya sudah membuat rancangan tabel users, courses, dan enrollments. Apakah relasi many-to-many ini sudah tepat?',
    replies: 2,
    views: 29,
    avatar: 'AP',
  },
  {
    id: 6,
    title: 'Tips deployment aplikasi React',
    author: 'Dimas Saputra',
    time: '4 hari yang lalu',
    status: 'TERTUTUP',
    body: 'Platform apa yang cocok untuk deployment project akhir dengan konfigurasi sederhana?',
    replies: 6,
    views: 61,
    avatar: 'DS',
  },
  {
    id: 7,
    title: 'Perbedaan props dan state pada React',
    author: 'Nadia Putri',
    time: '5 hari yang lalu',
    status: 'DIJAWAB',
    body: 'Saya ingin memahami kapan sebaiknya data disimpan sebagai props dan kapan menjadi state komponen.',
    replies: 5,
    views: 47,
    avatar: 'NP',
  },
  {
    id: 8,
    title: 'Rekomendasi testing untuk REST API',
    author: 'Fajar Ramadhan',
    time: '1 minggu yang lalu',
    status: 'SEDANG DISKUSI',
    body: 'Tools apa yang biasa digunakan untuk menguji endpoint dan alur autentikasi API?',
    replies: 1,
    views: 23,
    avatar: 'FR',
  },
  {
    id: 9,
    title: 'Cara mengoptimalkan ukuran bundle',
    author: 'Siti Rahma',
    time: '1 minggu yang lalu',
    status: 'TERTUTUP',
    body: 'Adakah tips untuk mengurangi ukuran bundle sebelum build production?',
    replies: 7,
    views: 88,
    avatar: 'SR',
  },
]

export function DiscussionsTab() {
  const navigate = useNavigate()
  const { moduleId = '1' } = useParams()
  const [threads, setThreads] = useState(INITIAL_THREADS)
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [notice, setNotice] = useState('')

  const pageSize = 3
  const pageCount = Math.ceil(threads.length / pageSize)
  const visibleThreads = useMemo(() => threads.slice((page - 1) * pageSize, page * pageSize), [threads, page])

  function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTitle.trim()
    const body = newBody.trim()
    if (!title || !body) return

    setThreads((current) => [
      {
        id: Date.now(),
        title,
        author: 'Hanna Hasanah',
        time: 'Baru saja',
        status: 'SEDANG DISKUSI',
        body,
        replies: 0,
        views: 0,
        avatar: 'HH',
      },
      ...current,
    ])
    setPage(1)
    setCreateOpen(false)
    setNewTitle('')
    setNewBody('')
    setNotice('Diskusi baru ditambahkan pada pratinjau.')
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {notice && (
          <div role="status" className="mb-4 flex justify-between rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {notice}
            <button type="button" onClick={() => setNotice('')} className="font-semibold hover:underline">
              Tutup
            </button>
          </div>
        )}

        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold tracking-[0.12em] text-slate-600">FORUM DISKUSI AKTIF</h2>
          <Button
            onClick={() => setCreateOpen(true)}
            icon={<MessageSquare className="h-4 w-4" aria-hidden />}
            className="px-3 py-2 text-sm"
          >
            Mulai Diskusi Baru
          </Button>
        </header>

        <ul className="space-y-3">
          {visibleThreads.map((thread) => (
            <li key={thread.id}>
              <ThreadCard
                thread={thread}
                onOpen={() => navigate(`/lembaga/modules/${moduleId}/discussions/${thread.id}`)}
                onReply={() => navigate(`/lembaga/modules/${moduleId}/discussions/${thread.id}#reply`)}
              />
            </li>
          ))}
        </ul>

        <nav aria-label="Paginasi diskusi" className="mt-5 flex items-center justify-center gap-1.5">
          <PaginationButton label="Halaman sebelumnya" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </PaginationButton>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <PaginationButton
              key={pageNumber}
              label={`Halaman ${pageNumber}`}
              active={page === pageNumber}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </PaginationButton>
          ))}
          <PaginationButton
            label="Halaman berikutnya"
            disabled={page === pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </PaginationButton>
        </nav>
      </section>

      <Modal
        open={createOpen}
        title="Mulai Diskusi Baru"
        description="Ajukan pertanyaan atau mulai percakapan dengan peserta modul."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="new-discussion-form" icon={<Send className="h-4 w-4" aria-hidden />}>
              Publikasikan
            </Button>
          </>
        }
      >
        <form id="new-discussion-form" className="space-y-4" onSubmit={createThread}>
          <Field id="discussion-title" label="Judul diskusi">
            <input
              id="discussion-title"
              className={inputClass()}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Contoh: Pertanyaan seputar materi"
              maxLength={120}
              required
              data-autofocus
            />
          </Field>
          <Field id="discussion-body" label="Pesan">
            <textarea
              id="discussion-body"
              className={`${inputClass()} min-h-28 resize-y`}
              value={newBody}
              onChange={(event) => setNewBody(event.target.value)}
              placeholder="Tulis detail diskusi Anda..."
              maxLength={1000}
              required
            />
          </Field>
          <p className="text-xs text-slate-500">Diskusi tersimpan sementara di pratinjau ini.</p>
        </form>
      </Modal>
    </div>
  )
}

function ThreadCard({
  thread,
  onOpen,
  onReply,
}: {
  thread: DiscussionThread
  onOpen: () => void
  onReply: () => void
}) {
  return (
    <article
      className={`rounded-xl border p-4 transition-colors sm:p-5 ${
        thread.id === 1 ? 'border-brand-200 bg-blue-50/40' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={thread.avatar} name={thread.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="text-left text-sm font-bold text-slate-900 hover:text-brand-700">
              {thread.title}
            </button>
            <StatusBadge status={thread.status} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {thread.author} <span aria-hidden>•</span> {thread.time}
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-700 sm:text-sm">{thread.body}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {thread.id === 1 && (
              <button type="button" onClick={onReply} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                <ArrowLeft className="h-3.5 w-3.5 -rotate-45" aria-hidden /> Balas
              </button>
            )}
            <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 hover:text-brand-700">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {thread.replies} Balasan
            </button>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden /> {thread.views} Dilihat
            </span>
          </div>
        </div>
      </div>

      {thread.id === 1 && (
        <div className="ml-0 mt-4 border-l-2 border-brand-200 pl-3 sm:ml-10 sm:pl-4">
          <div className="flex gap-2 rounded-lg bg-white p-3 shadow-sm">
            <Avatar initials="HH" name="Hanna Hasanah" instructor />
            <div className="min-w-0">
              <p className="text-xs font-bold text-brand-800">Hanna Hasanah (Instructor)</p>
              <p className="mt-1 text-xs leading-5 text-slate-700">
                Halo! Silakan coba matikan sementara antivirus atau jalankan Command Prompt sebagai Administrator. Coba juga perintah{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-rose-700">
                  npm cache clean --force
                </code>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export function Avatar({
  initials,
  name,
  instructor = false,
}: {
  initials: string
  name: string
  instructor?: boolean
}) {
  return (
    <span
      aria-label={name}
      title={name}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        instructor ? 'bg-blue-100 text-brand-800' : 'bg-gradient-to-br from-slate-200 to-blue-100 text-slate-700'
      }`}
    >
      {initials}
    </span>
  )
}

export function StatusBadge({ status }: { status: DiscussionThread['status'] }) {
  const classes =
    status === 'SEDANG DISKUSI'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'DIJAWAB'
        ? 'bg-slate-100 text-slate-600'
        : 'border border-slate-200 bg-white text-slate-500'
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${classes}`}>{status}</span>
}

function PaginationButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
      }`}
    >
      {children}
    </button>
  )
}
