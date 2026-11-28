import { MessageCircle, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { EmptyState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import {
  createDiscussion,
  createReply,
  deleteDiscussion,
  deleteReply,
  fetchDiscussion,
  listDiscussions,
  updateDiscussion,
  updateReply,
  type Discussion,
  type DiscussionReply,
} from './api'

/**
 * Forum diskusi kursus untuk semua peran (Siswa, Karyawan, Mentor, Lembaga, Admin).
 * Server menentukan siapa yang boleh mengubah/menghapus lewat can_update/can_delete.
 */
export function CourseDiscussions({
  courseId,
  initialDiscussionId,
}: {
  courseId: number
  initialDiscussionId?: number
}) {
  const discussions = useApiData(() => listDiscussions(courseId), [courseId])
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const items = discussions.data ?? []

  async function submitDiscussion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    const nextBody = body.trim()
    if (!nextTitle || !nextBody || busy) return

    setBusy(true)
    try {
      await createDiscussion(courseId, { title: nextTitle, body: nextBody })
      setTitle('')
      setBody('')
      setCreateOpen(false)
      setNotice('Diskusi berhasil dibuat.')
      discussions.reload()
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageSquare className="h-5 w-5 text-brand-600" aria-hidden /> Forum Diskusi
          </h2>
          <p className="mt-1 text-sm text-slate-500">Tanyakan materi atau balas diskusi peserta lain di kelas ini.</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
          className="px-3 py-2 text-sm"
        >
          Mulai Diskusi
        </Button>
      </header>

      {discussions.loading && !discussions.data ? (
        <Spinner label="Memuat diskusi…" />
      ) : items.length === 0 ? (
        <EmptyState title="Belum ada diskusi" description="Jadilah yang pertama membuka pertanyaan di forum kelas ini." />
      ) : (
        <ul className="space-y-3">
          {items.map((discussion) => (
            <ThreadCard
              key={discussion.id}
              discussion={discussion}
              defaultOpen={discussion.id === initialDiscussionId}
              onChanged={discussions.reload}
            />
          ))}
        </ul>
      )}

      {discussions.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {discussions.error.message}
        </p>
      )}

      <Modal
        open={createOpen}
        title="Mulai Diskusi Baru"
        description="Ajukan pertanyaan atau mulai percakapan dengan peserta kursus."
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              form="new-discussion-form"
              disabled={busy}
              icon={<Send className="h-4 w-4" aria-hidden />}
            >
              Publikasikan
            </Button>
          </>
        }
      >
        <form id="new-discussion-form" className="space-y-4" onSubmit={submitDiscussion}>
          <Field id="discussion-title" label="Judul diskusi">
            <input
              id="discussion-title"
              className={inputClass()}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Pertanyaan seputar materi"
              maxLength={150}
              required
              data-autofocus
            />
          </Field>
          <Field id="discussion-body" label="Pesan">
            <textarea
              id="discussion-body"
              className={`${inputClass()} min-h-28 resize-y`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Tulis detail diskusi Anda..."
              maxLength={5000}
              required
            />
          </Field>
        </form>
      </Modal>
    </section>
  )
}

function ThreadCard({
  discussion,
  defaultOpen,
  onChanged,
}: {
  discussion: Discussion
  defaultOpen: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(discussion.title)
  const [editBody, setEditBody] = useState(discussion.body)
  const [replyText, setReplyText] = useState('')
  const [editingReply, setEditingReply] = useState<DiscussionReply | null>(null)
  const [editingReplyText, setEditingReplyText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  // Detail baru diambil saat topik dibuka (sekaligus menambah penghitung dilihat).
  const detail = useApiData(
    () => (open ? fetchDiscussion(discussion.id) : Promise.resolve<Discussion | null>(null)),
    [open, discussion.id],
  )
  const thread = detail.data ?? discussion
  const replies = thread.replies ?? []

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setNotice('')
    try {
      await action()
      setNotice(success)
      detail.reload()
      onChanged()
      return true
    } catch (error) {
      setNotice(toApiError(error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editTitle.trim() || !editBody.trim()) return
    const saved = await run(
      () => updateDiscussion(discussion.id, { title: editTitle.trim(), body: editBody.trim() }),
      'Diskusi berhasil diperbarui.',
    )
    if (saved) setEditing(false)
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = replyText.trim()
    if (!text) return
    const saved = await run(() => createReply(discussion.id, text), 'Balasan terkirim.')
    if (saved) setReplyText('')
  }

  async function saveReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingReply || !editingReplyText.trim()) return
    const saved = await run(
      () => updateReply(editingReply.id, editingReplyText.trim()),
      'Balasan diperbarui.',
    )
    if (saved) setEditingReply(null)
  }

  async function removeThread() {
    setBusy(true)
    try {
      await deleteDiscussion(discussion.id)
      setDeleting(false)
      onChanged()
    } catch (error) {
      setNotice(toApiError(error).message)
      setDeleting(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-blue-100 text-xs font-bold text-slate-700">
          {thread.author?.initials ?? '?'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              className="text-left text-sm font-bold text-slate-900 hover:text-brand-700"
            >
              {thread.title}
            </button>
            <span className="text-[11px] text-slate-500">{formatTime(thread.created_at)}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {thread.author?.name ?? 'Pengguna dihapus'}
            {thread.author?.role ? ` · ${thread.author.role}` : ''}
          </p>

          {editing ? (
            <form className="mt-3 space-y-2" onSubmit={saveEdit}>
              <input
                aria-label="Judul diskusi"
                className={inputClass()}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                maxLength={150}
                required
              />
              <textarea
                aria-label="Isi diskusi"
                className={`${inputClass()} min-h-24 resize-y`}
                value={editBody}
                onChange={(event) => setEditBody(event.target.value)}
                maxLength={5000}
                required
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy} className="px-3 py-1.5 text-xs">
                  Simpan
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs">
                  Batal
                </Button>
              </div>
            </form>
          ) : (
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{thread.body}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex items-center gap-1 hover:text-brand-700"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> {thread.replies_count ?? replies.length} Balasan
            </button>
            <span>{thread.views} Dilihat</span>
            {thread.can_update && !editing && (
              <button
                type="button"
                onClick={() => {
                  setEditTitle(thread.title)
                  setEditBody(thread.body)
                  setEditing(true)
                }}
                className="inline-flex items-center gap-1 hover:text-brand-700"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Ubah
              </button>
            )}
            {thread.can_delete && (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className="inline-flex items-center gap-1 text-rose-700 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
              </button>
            )}
          </div>

          {notice && (
            <p role="status" className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {notice}
            </p>
          )}

          {open && (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              {detail.loading && !detail.data ? (
                <Spinner label="Memuat balasan…" />
              ) : replies.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada balasan.</p>
              ) : (
                <ol className="space-y-2">
                  {replies.map((reply) => (
                    <li key={reply.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-slate-700">
                          {reply.author?.name ?? 'Pengguna dihapus'}
                          {reply.author?.role ? ` · ${reply.author.role}` : ''}
                        </p>
                        <span className="text-[11px] text-slate-500">{formatTime(reply.created_at)}</span>
                      </div>

                      {editingReply?.id === reply.id ? (
                        <form className="mt-2 space-y-2" onSubmit={saveReply}>
                          <textarea
                            aria-label="Isi balasan"
                            className={`${inputClass()} min-h-20 resize-y`}
                            value={editingReplyText}
                            onChange={(event) => setEditingReplyText(event.target.value)}
                            maxLength={5000}
                            required
                          />
                          <div className="flex gap-2">
                            <Button type="submit" disabled={busy} className="px-3 py-1.5 text-xs">
                              Simpan
                            </Button>
                            <Button variant="secondary" onClick={() => setEditingReply(null)} className="px-3 py-1.5 text-xs">
                              Batal
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-700">{reply.body}</p>
                          {(reply.can_update || reply.can_delete) && (
                            <div className="mt-2 flex gap-3 text-xs">
                              {reply.can_update && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReply(reply)
                                    setEditingReplyText(reply.body)
                                  }}
                                  className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Ubah
                                </button>
                              )}
                              {reply.can_delete && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void run(() => deleteReply(reply.id), 'Balasan dihapus.')}
                                  className="inline-flex items-center gap-1 font-medium text-rose-700 hover:underline"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitReply}>
                <label className="sr-only" htmlFor={`reply-${discussion.id}`}>
                  Balas diskusi {thread.title}
                </label>
                <input
                  id={`reply-${discussion.id}`}
                  className={inputClass()}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Tulis balasan…"
                  maxLength={5000}
                />
                <Button
                  type="submit"
                  disabled={busy || !replyText.trim()}
                  icon={<Send className="h-4 w-4" aria-hidden />}
                  className="px-4 py-2 text-sm"
                >
                  Balas
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={deleting}
        title="Hapus diskusi?"
        description={`"${thread.title}" beserta seluruh balasannya akan dihapus.`}
        onClose={() => setDeleting(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
              onClick={removeThread}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Tindakan ini tidak dapat dibatalkan.</p>
      </Modal>
    </li>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return ''

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
