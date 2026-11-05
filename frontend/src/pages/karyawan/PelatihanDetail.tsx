import { CornerDownRight, MessageCircle, Pencil, Send, ThumbsUp, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import { AskQuestionButton, BackLink, CourseHero, MaterialRow, ModuleRow, ModuleStats } from './detailParts'
import { TRAININGS, type Discussion, type Training } from './pelatihanData'

type Tab = 'kurikulum' | 'diskusi' | 'resource'

const TABS: { key: Tab; label: string }[] = [
  { key: 'kurikulum', label: 'Kurikulum' },
  { key: 'diskusi', label: 'Diskusi' },
  { key: 'resource', label: 'Resource' },
]

const LIST_PATH = '/karyawan/trainings'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const compactFormat = new Intl.NumberFormat('id-ID', { notation: 'compact' })

/** Contoh: 1000000 → "1jt", 500000 → "500rb". */
const formatCount = (value: number) => compactFormat.format(value).replace(/\s/g, '')

/** Detail pelatihan (/karyawan/trainings/:courseId). */
export default function KaryawanPelatihanDetail() {
  const { courseId } = useParams()
  const [tab, setTab] = useState<Tab>('kurikulum')
  const training = TRAININGS.find((item) => String(item.id) === courseId)

  if (!training) {
    return (
      <>
        <BackLink to={LIST_PATH} />
        <div className="mt-6 rounded-3xl bg-white shadow-md">
          <EmptyState title="Pelatihan tidak ditemukan" description="Pelatihan yang Anda buka tidak tersedia." />
        </div>
      </>
    )
  }

  return (
    <>
      <CourseHero
        backTo={LIST_PATH}
        label={training.level}
        title={training.title}
        tagline={training.tagline}
        owner={training.mentor}
        rating={training.rating}
        duration={`${training.hours} jam`}
        purchased={training.purchased}
        certificateEligible={training.certificateEligible}
        price={training.price}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex border-b border-slate-800" role="tablist" aria-label="Isi pelatihan">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-4 px-4 pb-3 text-xl font-bold sm:px-9 sm:text-2xl ${
                tab === key ? 'border-[#0085FF] text-[#0085FF]' : 'border-transparent text-slate-800 hover:text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-col lg:col-start-1">
          {tab === 'kurikulum' && (
            <div className="flex-1 rounded-2xl border border-slate-300 bg-white p-5">
              <ul className="space-y-5">
                {training.modules.map((module) => (
                  <ModuleRow key={module.id} module={module} />
                ))}
              </ul>
            </div>
          )}
          {tab === 'diskusi' && <DiscussionTab training={training} />}
          {tab === 'resource' && <ResourceTab training={training} />}
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <ModuleStats total={training.modules.length} />
        </div>
      </div>
    </>
  )
}

function ResourceTab({ training }: { training: Training }) {
  return (
    <>
      <h2 className="px-5 text-xl font-bold text-slate-900">Materi Pendukung</h2>
      <ul className="mt-3 space-y-4">
        {training.materials.map((material) => (
          <MaterialRow key={material.id} material={material} locked={!training.purchased} />
        ))}
      </ul>
    </>
  )
}

function DiscussionTab({ training }: { training: Training }) {
  if (!training.purchased) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-white">
        <EmptyState title="Diskusi terkunci" description="Bayar pelatihan ini untuk mengikuti diskusi." />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5">
        <h2 className="text-xl font-bold text-slate-900">Diskusi Modul({training.discussions.length})</h2>
        <AskQuestionButton />
      </div>
      <div className="mt-3 flex-1 rounded-2xl bg-white shadow-md">
        {training.discussions.length === 0 ? (
          <EmptyState title="Belum ada diskusi" description="Jadilah yang pertama membuat pertanyaan." />
        ) : (
          <ul className="divide-y divide-slate-200 px-5 sm:px-10">
            {training.discussions.map((discussion) => (
              <DiscussionThread key={discussion.id} discussion={discussion} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** Satu pertanyaan beserta balasannya. Suka, balas, ubah, dan hapus dihubungkan saat forum diskusi dibuat. */
function DiscussionThread({ discussion }: { discussion: Discussion }) {
  return (
    <li className="flex gap-4 py-8 sm:gap-6">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-400 text-white">
        <User className="h-8 w-8 fill-current" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-xl font-bold text-slate-900">{discussion.title}</h3>
        <p className="italic text-slate-500">
          {discussion.author} | {dateFormat.format(new Date(discussion.date))}
        </p>
        <p className="mt-1 text-lg text-slate-900">{discussion.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 italic text-slate-500">
          <span className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 fill-current text-slate-400" aria-hidden />
            {formatCount(discussion.likes)} Likes
          </span>
          <span className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 fill-current text-slate-400" aria-hidden />
            {formatCount(discussion.comments)} komentar
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <CornerDownRight className="mt-2 hidden h-6 w-6 shrink-0 text-slate-400 sm:block" strokeWidth={3} aria-hidden />
          <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 p-5">
            {discussion.replies.map((reply) => (
              <div key={reply.id} className="mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-400 text-white">
                    <User className="h-4 w-4 fill-current" aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 font-semibold text-slate-900">
                    {reply.author} | {dateFormat.format(new Date(reply.date))}
                  </p>
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-800">
                    Balas
                  </button>
                  {/* Karyawan hanya boleh mengubah dan menghapus balasannya sendiri; backend tetap wajib memeriksa. */}
                  {reply.isMine && (
                    <>
                      <button type="button" className="text-slate-500 hover:text-slate-800" aria-label="Ubah balasan">
                        <Pencil className="h-3.5 w-3.5 fill-current" aria-hidden />
                      </button>
                      <button type="button" className="text-slate-500 hover:text-red-600" aria-label="Hapus balasan">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-2 text-lg text-slate-900 sm:pl-10">{reply.body}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Tulis balasan</span>
                <input
                  type="text"
                  placeholder="Tulis balasan anda"
                  className="w-full rounded-lg border border-slate-400 bg-slate-50 px-4 py-2 text-slate-900 placeholder:text-slate-500 focus:border-[#0085FF] focus:outline-none"
                />
              </label>
              <button
                type="button"
                className="flex w-11 shrink-0 items-center justify-center rounded-lg bg-slate-300 text-white hover:bg-slate-400"
                aria-label="Kirim balasan"
              >
                <Send className="h-5 w-5 fill-current" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
