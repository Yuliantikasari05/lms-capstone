import {
  ArrowLeft,
  Bold,
  BookOpen,
  CheckCircle2,
  Eye,
  Image,
  Italic,
  Link2,
  List,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'
import { Avatar, StatusBadge } from './DiscussionsTab'
import { ModuleDetailHeader, type ModuleDetailTab } from './ModuleDetailHeader'
import { getModuleById, isManagedModule, type ManagedModule } from './moduleData'

interface Reply {
  id: number
  author: string
  initials: string
  time: string
  body: string
  instructor?: boolean
  verified?: boolean
}

const INITIAL_REPLIES: Reply[] = [
  {
    id: 1,
    author: 'Novi Diana',
    initials: 'ND',
    time: '1 hour ago',
    body: 'Sudah coba bersihkan folder temp di Windows? Kadang installer nyangkut di situ.',
  },
  {
    id: 2,
    author: 'Hanna Hasanah',
    initials: 'HH',
    time: '45 mins ago',
    body: 'Halo Putri, error 2503/2504 biasanya terkait dengan izin (permission) pada folder C:\\Windows\\Installer. Coba jalankan Command Prompt sebagai Administrator, lalu bersihkan cache npm.',
    instructor: true,
    verified: true,
  },
  {
    id: 3,
    author: 'Putri Malika',
    initials: 'PM',
    time: '10 mins ago',
    body: 'Wah, terima kasih Bu Hanna! Saya coba dulu caranya.',
  },
]

export default function DiscussionDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleId = '1' } = useParams()
  const routeState = location.state as { moduleData?: unknown } | null
  const routeModule = isManagedModule(routeState?.moduleData) && String(routeState.moduleData.id) === moduleId
    ? routeState.moduleData
    : undefined
  const [moduleOverride, setModuleOverride] = useState<ManagedModule | null>(null)
  const module = moduleOverride && String(moduleOverride.id) === moduleId
    ? moduleOverride
    : routeModule ?? getModuleById(moduleId)
  const [reportOpen, setReportOpen] = useState(false)
  const [replies, setReplies] = useState(INITIAL_REPLIES)
  const [replyText, setReplyText] = useState('')
  const [liked, setLiked] = useState(false)
  const [notice, setNotice] = useState('')
  const replyInputRef = useRef<HTMLTextAreaElement>(null)

  function changeTab(tab: ModuleDetailTab) {
    if (tab === 'Modules') navigate('/lembaga/modules')
    if (tab === 'Sessions') navigate(`/lembaga/modules/${moduleId}/sessions`)
  }

  function insertFormatting(before: string, after = '') {
    const textarea = replyInputRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = replyText.slice(start, end)
    const next = `${replyText.slice(0, start)}${before}${selected || 'teks'}${after}${replyText.slice(end)}`
    setReplyText(next)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = start + before.length + (selected || 'teks').length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = replyText.trim()
    if (!body) return
    setReplies((current) => [
      ...current,
      {
        id: Date.now(),
        author: 'Hanna Hasanah',
        initials: 'HH',
        time: 'Baru saja',
        body,
        instructor: true,
      },
    ])
    setReplyText('')
    setNotice('Balasan ditambahkan pada pratinjau diskusi.')
  }

  async function shareDiscussion() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice('Tautan diskusi disalin.')
    } catch {
      setNotice('Tautan tidak dapat disalin otomatis. Salin alamat halaman dari browser.')
    }
  }

  return (
    <div className="space-y-5">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />
      <ModuleDetailHeader
        activeTab="Discussions"
        onTabChange={changeTab}
        onAddModule={() => navigate('/lembaga/modules/new')}
        module={module}
        onRename={(title) => {
          if (module) setModuleOverride({ ...module, title })
        }}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(260px,0.9fr)]">
        <main className="min-w-0 space-y-5">
          <Link
            to={`/lembaga/modules/${moduleId}/sessions`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Discussions
          </Link>

          {notice && (
            <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} className="font-semibold hover:underline">
                Tutup
              </button>
            </div>
          )}

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <Avatar initials="PM" name="Putri Malika" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h1 className="text-lg font-bold leading-6 text-slate-900">Tanya: Error saat instalasi Node.js</h1>
                    <p className="mt-1 text-xs text-slate-500">Oleh Putri Malika <span aria-hidden>•</span> 2 hours ago</p>
                  </div>
                  <StatusBadge status="SEDANG DISKUSI" />
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
              <p>
                Halo semuanya, saya sedang mencoba menginstal Node.js versi terbaru (LTS) di sistem Windows saya, namun terus muncul pesan error “Internal Error 2503” saat proses instalasi hampir selesai.
              </p>
              <p>
                Saya sudah mencoba menjalankan installer sebagai Administrator tapi hasilnya tetap sama. Apakah ada yang pernah mengalami hal serupa atau punya solusi untuk masalah ini? Terima kasih!
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setLiked((current) => !current)}
                aria-pressed={liked}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  liked ? 'bg-blue-100 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ThumbsUp className="h-4 w-4" aria-hidden /> Bantu ({liked ? 5 : 4})
              </button>
              <button
                type="button"
                onClick={() => void shareDiscussion()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Bagikan
              </button>
            </div>
          </article>

          <section aria-labelledby="replies-title">
            <h2 id="replies-title" className="mb-3 text-lg font-bold text-slate-900">
              Balasan ({replies.length})
            </h2>
            <ol className="space-y-3">
              {replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </ol>
          </section>

          <section id="reply" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-bold text-slate-900">Tulis Balasan</h2>
            <form className="mt-3" onSubmit={submitReply}>
              <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
                <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
                  <EditorButton label="Tebal" onClick={() => insertFormatting('**', '**')}>
                    <Bold className="h-4 w-4" aria-hidden />
                  </EditorButton>
                  <EditorButton label="Miring" onClick={() => insertFormatting('_', '_')}>
                    <Italic className="h-4 w-4" aria-hidden />
                  </EditorButton>
                  <EditorButton label="Daftar peluru" onClick={() => insertFormatting('\n- ')}>
                    <List className="h-4 w-4" aria-hidden />
                  </EditorButton>
                  <EditorButton label="Sisipkan tautan" onClick={() => insertFormatting('[', '](https://)')}>
                    <Link2 className="h-4 w-4" aria-hidden />
                  </EditorButton>
                  <EditorButton label="Sisipkan gambar" onClick={() => insertFormatting('![deskripsi](', ')')}>
                    <Image className="h-4 w-4" aria-hidden />
                  </EditorButton>
                </div>
                <textarea
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Tuliskan saran atau jawaban Anda di sini..."
                  className="min-h-32 w-full resize-y border-0 px-3 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  maxLength={2000}
                  required
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="submit" icon={<Send className="h-4 w-4" aria-hidden />} className="px-3 py-2 text-sm">
                  Kirim Balasan
                </Button>
              </div>
            </form>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 text-brand-700" aria-hidden /> Statistik Diskusi
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MetricTile icon={<MessageCircle className="h-3.5 w-3.5" aria-hidden />} label="BALASAN" value={replies.length} />
              <MetricTile icon={<Eye className="h-3.5 w-3.5" aria-hidden />} label="DILIHAT" value={42} />
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Dibuat pada</dt>
                <dd className="font-medium text-slate-700">14 Mar 2024, 09:12</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Update terakhir</dt>
                <dd className="font-medium text-emerald-700">10 Menit lalu</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Siswa Terkait</h2>
            <div className="mt-4 flex items-center gap-3">
              <Avatar initials="PM" name="Putri Malika" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Putri Malika</p>
                <p className="mt-0.5 text-xs text-slate-500">Teknik Informatika 22</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <InfoMetric icon={<Star className="h-4 w-4 text-amber-500" aria-hidden />} label="Poin Reputasi" value="120" />
              <InfoMetric icon={<MessageCircle className="h-4 w-4 text-brand-600" aria-hidden />} label="Diskusi Dibuat" value="8" />
            </div>
            <Button
              variant="secondary"
              className="mt-4 w-full border-brand-200 text-brand-700 hover:bg-blue-50"
              onClick={() => setNotice('Profil lengkap belum tersedia di pratinjau statis.')}
            >
              Lihat Profil Lengkap
            </Button>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Modul Terkait</h2>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">Web Dev Frameworks</p>
                <p className="mt-0.5 text-xs text-slate-500">Materi: Setup Lingkungan Node.js</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-2/3 rounded-full bg-emerald-600" />
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  )
}

function ReplyCard({ reply }: { reply: Reply }) {
  return (
    <li
      className={`rounded-xl border p-4 ${
        reply.instructor ? 'border-blue-200 border-l-4 border-l-brand-600 bg-blue-50/60' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar initials={reply.initials} name={reply.author} instructor={reply.instructor} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-sm font-semibold ${reply.instructor ? 'text-brand-800' : 'text-slate-800'}`}>
                {reply.author}
              </span>
              {reply.instructor && (
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[9px] font-bold text-white">INSTRUCTOR</span>
              )}
            </div>
            <time className="text-[11px] text-slate-500">{reply.time}</time>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{reply.body}</p>
          {reply.instructor && (
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-100">
              <code>msiexec /i &quot;path_to_your_node_installer.msi&quot;</code>
            </pre>
          )}
          {reply.verified && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Jawaban Terverifikasi
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

function MetricTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-3 text-center">
      <p className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-slate-500">
        {icon} {label}
      </p>
      <p className="mt-1 text-lg font-bold text-brand-800">{value}</p>
    </div>
  )
}

function InfoMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
      {icon}
      <span className="flex-1 text-xs text-slate-600">{label}</span>
      <span className="text-xs font-bold text-slate-800">{value}</span>
    </div>
  )
}

function EditorButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-200"
    >
      {children}
    </button>
  )
}

function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Laporan Lembaga" onClose={onClose}>
      <p className="text-sm leading-6 text-slate-600">Data laporan belum tersedia di pratinjau statis.</p>
    </Modal>
  )
}
