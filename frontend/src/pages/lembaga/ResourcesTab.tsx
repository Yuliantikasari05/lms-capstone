import {
  BookOpen,
  BookText,
  Check,
  CloudUpload,
  Download,
  FilePlus2,
  FileText,
  Folder,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'

type DocumentType = 'PDF' | 'DOCX' | 'MP4'

interface ResourceDocument {
  id: number
  title: string
  type: DocumentType
  date: string
  size: string
  description?: string
  externalUrl?: string
}

interface ExternalLink {
  id: number
  title: string
  url: string
}

const INITIAL_DOCUMENTS: ResourceDocument[] = [
  { id: 1, title: 'Modul 1: Introduction to Backend PDF', type: 'PDF', date: '12 Okt 2023', size: '2.4 MB' },
  { id: 2, title: 'Backend Development Guidelines', type: 'DOCX', date: '10 Okt 2023', size: '840 KB' },
  { id: 3, title: 'Modul 2: API & Database Reference', type: 'PDF', date: '08 Okt 2023', size: '1.8 MB' },
]

const INITIAL_LINKS: ExternalLink[] = [
  { id: 1, title: 'Official React Documentation', url: 'https://react.dev/learn/describing-the-ui' },
  { id: 2, title: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web' },
]

export function ResourcesTab() {
  const [documents, setDocuments] = useState(INITIAL_DOCUMENTS)
  const [links, setLinks] = useState(INITIAL_LINKS)
  const [dialog, setDialog] = useState<'document' | 'link' | null>(null)
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(null)
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('PDF')
  const [documentSize, setDocumentSize] = useState('')
  const [documentDescription, setDocumentDescription] = useState('')
  const [documentExternalUrl, setDocumentExternalUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'document' | 'link'; id: number; title: string } | null>(null)
  const [readingListOpen, setReadingListOpen] = useState(false)
  const [notice, setNotice] = useState('')

  function openCreateDocument() {
    setEditingDocumentId(null)
    setDocumentTitle('')
    setDocumentType('PDF')
    setDocumentSize('')
    setDocumentDescription('')
    setDocumentExternalUrl('')
    setSelectedFile(null)
    setFileError('')
    setDialog('document')
  }

  function editDocument(document: ResourceDocument) {
    setEditingDocumentId(document.id)
    setDocumentTitle(document.title)
    setDocumentType(document.type)
    setDocumentSize(document.size)
    setDocumentDescription(document.description ?? '')
    setDocumentExternalUrl(document.externalUrl ?? '')
    setSelectedFile(null)
    setFileError('')
    setDialog('document')
  }

  function selectFile(file: File | undefined) {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    const supportedType: DocumentType | undefined =
      extension === 'pdf' ? 'PDF' : extension === 'docx' ? 'DOCX' : extension === 'mp4' ? 'MP4' : undefined

    if (!supportedType) {
      setFileError('Format file tidak didukung. Pilih PDF, DOCX, atau MP4.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError('Ukuran file melebihi batas maksimal 50 MB.')
      return
    }

    setFileError('')
    setSelectedFile(file)
    setDocumentType(supportedType)
    setDocumentTitle((current) => current || file.name.replace(/\.[^.]+$/, ''))
    setDocumentSize(formatResourceFileSize(file.size))
  }

  function onResourceFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  function onResourceFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    selectFile(event.dataTransfer.files[0])
  }

  function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = documentTitle.trim()
    if (!title) return

    if (editingDocumentId !== null) {
      setDocuments((current) =>
        current.map((document) =>
          document.id === editingDocumentId
            ? {
                ...document,
                title,
                type: documentType,
                size: documentSize.trim() || document.size,
                description: documentDescription.trim(),
                externalUrl: documentExternalUrl.trim(),
              }
            : document,
        ),
      )
      setNotice('Informasi dokumen diperbarui pada pratinjau.')
    } else {
      setDocuments((current) => [
        ...current,
        {
          id: Date.now(),
          title,
          type: documentType,
          date: 'Baru saja',
          size: selectedFile ? formatResourceFileSize(selectedFile.size) : documentSize.trim() || 'Belum diketahui',
          description: documentDescription.trim(),
          externalUrl: documentExternalUrl.trim(),
        },
      ])
      setNotice(
        selectedFile
          ? `Resource "${title}" ditambahkan pada pratinjau. File belum dikirim ke server.`
          : `Resource "${title}" ditambahkan pada pratinjau. Belum ada file fisik yang diunggah.`,
      )
    }
    setDialog(null)
  }

  function openCreateLink() {
    setEditingLinkId(null)
    setLinkTitle('')
    setLinkUrl('')
    setDialog('link')
  }

  function editLink(link: ExternalLink) {
    setEditingLinkId(link.id)
    setLinkTitle(link.title)
    setLinkUrl(link.url)
    setDialog('link')
  }

  function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = linkTitle.trim()
    const url = linkUrl.trim()
    if (!title || !url) return

    if (editingLinkId !== null) {
      setLinks((current) => current.map((link) => (link.id === editingLinkId ? { ...link, title, url } : link)))
      setNotice('Tautan diperbarui pada pratinjau.')
    } else {
      setLinks((current) => [...current, { id: Date.now(), title, url }])
      setNotice('Tautan ditambahkan pada pratinjau.')
    }
    setDialog(null)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.type === 'document') {
      setDocuments((current) => current.filter((document) => document.id !== deleteTarget.id))
    } else {
      setLinks((current) => current.filter((link) => link.id !== deleteTarget.id))
    }
    setNotice(`"${deleteTarget.title}" dihapus dari pratinjau.`)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <span>{notice}</span>
          <button type="button" className="font-semibold hover:underline" onClick={() => setNotice('')}>
            Tutup
          </button>
        </div>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Learning Materials</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage additional resources and reading lists for students.
          </p>
        </div>
        <Button
          onClick={openCreateDocument}
          icon={<FilePlus2 className="h-4 w-4" aria-hidden />}
          className="shrink-0 self-start px-3 py-2 sm:self-auto"
        >
          Tambah Resource
        </Button>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4 sm:px-5">
            <Folder className="h-5 w-5 text-emerald-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900">Dokumen Modul</h3>
              <p className="mt-0.5 text-xs text-slate-500">{documents.length} dokumen pendukung</p>
            </div>
          </header>
          <ul className="divide-y divide-slate-100">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <FileTypeIcon type={document.type} />
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-slate-800">{document.title}</h4>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{document.date}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {document.type === 'PDF' ? document.size : document.type}
                    </span>
                    {document.type !== 'PDF' && (
                      <span className="text-xs text-slate-500">{document.size}</span>
                    )}
                  </div>
                  {document.externalUrl && (
                    <a
                      href={document.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand-700 hover:underline"
                    >
                      <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                      {displayUrl(document.externalUrl)}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <ResourceIconAction
                    label={`Edit ${document.title}`}
                    onClick={() => editDocument(document)}
                    icon={<Pencil className="h-4 w-4" aria-hidden />}
                  />
                  <ResourceIconAction
                    label={`Hapus ${document.title}`}
                    onClick={() => setDeleteTarget({ type: 'document', id: document.id, title: document.title })}
                    icon={<Trash2 className="h-4 w-4" aria-hidden />}
                    danger
                  />
                  <button
                    type="button"
                    onClick={() => setNotice(`File contoh "${document.title}" belum tersedia untuk diunduh.`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 text-xs font-semibold text-brand-700 transition hover:bg-blue-100 sm:px-3"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Dokumen yang tampil adalah data contoh. File fisik belum tersimpan atau terhubung ke server.
          </p>
        </section>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
              <Link2 className="h-5 w-5 text-brand-600" aria-hidden />
              <h3 className="flex-1 font-semibold text-slate-900">External Links</h3>
              <button
                type="button"
                onClick={openCreateLink}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add Link
              </button>
            </header>
            {links.length > 0 ? (
              <ul className="divide-y divide-slate-100 px-4">
                {links.map((link) => (
                  <li key={link.id} className="flex items-start gap-2 py-3.5">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 group"
                    >
                      <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">
                        {link.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{displayUrl(link.url)}</span>
                    </a>
                    <div className="flex shrink-0">
                      <ResourceIconAction label={`Edit ${link.title}`} onClick={() => editLink(link)} icon={<Pencil className="h-3.5 w-3.5" aria-hidden />} />
                      <ResourceIconAction
                        label={`Hapus ${link.title}`}
                        onClick={() => setDeleteTarget({ type: 'link', id: link.id, title: link.title })}
                        icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
                        danger
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Belum ada tautan eksternal.</p>
            )}
          </section>

          <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <BookOpen className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rotate-12 text-blue-50" aria-hidden />
            <header className="relative flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
              <BookText className="h-5 w-5 text-brand-600" aria-hidden />
              <h3 className="font-semibold text-slate-900">Reading List</h3>
            </header>
            <div className="relative space-y-3 p-4">
              <ReadingBook title="Clean Code: A Handbook of Agile Software Craftsmanship" author="Robert C. Martin" />
              <ReadingBook title="The Pragmatic Programmer" author="Andrew Hunt & David Thomas" />
            </div>
            <button
              type="button"
              onClick={() => setReadingListOpen(true)}
              className="relative w-full border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-brand-700 transition hover:bg-blue-50"
            >
              View Full List
            </button>
          </section>
        </div>
      </div>

      <Modal
        open={dialog === 'document'}
        title={editingDocumentId === null ? 'Tambah Resource Baru' : 'Edit Resource'}
        onClose={() => setDialog(null)}
        size="xl"
        centered
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button type="submit" form="document-form" icon={<Check className="h-4 w-4" aria-hidden />}>
              Simpan Resource
            </Button>
          </>
        }
      >
        <form id="document-form" className="space-y-4" onSubmit={saveDocument}>
          <Field id="resource-title" label="Nama Resource">
            <input
              id="resource-title"
              className={inputClass()}
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="Contoh: Panduan Instalasi Laravel"
              required
              maxLength={120}
              data-autofocus
            />
          </Field>
          <Field id="resource-type" label="Tipe Resource">
            <select
              id="resource-type"
              className={inputClass()}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            >
                <option value="PDF">File PDF</option>
                <option value="DOCX">File DOCX</option>
                <option value="MP4">Video MP4</option>
              </select>
          </Field>
          <Field id="resource-description" label="Deskripsi">
            <textarea
              id="resource-description"
              className={`${inputClass()} min-h-[76px] resize-y`}
              value={documentDescription}
              onChange={(event) => setDocumentDescription(event.target.value)}
              placeholder="Berikan penjelasan singkat mengenai resource ini..."
              maxLength={500}
              rows={3}
            />
          </Field>
          <Field id="resource-file" label="Upload File">
            <input
              ref={fileInputRef}
              id="resource-file"
              type="file"
              accept=".pdf,.docx,.mp4"
              className="sr-only"
              onChange={onResourceFileChange}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  fileInputRef.current?.click()
                }
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onResourceFileDrop}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-center transition-colors hover:border-brand-400 hover:bg-blue-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <CloudUpload className="mx-auto h-8 w-8 text-brand-600" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {selectedFile?.name ?? 'Pilih file atau tarik ke sini'}
              </p>
              <p className="mt-1 text-xs text-slate-500">PDF, DOCX, atau MP4 (Maks. 50MB)</p>
              {selectedFile && (
                <p className="mt-1 text-xs font-medium text-brand-700">{formatResourceFileSize(selectedFile.size)}</p>
              )}
            </div>
            {fileError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {fileError}
              </p>
            )}
          </Field>
          <Field id="resource-external-url" label="Tautan Eksternal (Opsional)">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="resource-external-url"
                type="url"
                className={`${inputClass()} pl-9`}
                value={documentExternalUrl}
                onChange={(event) => setDocumentExternalUrl(event.target.value)}
                placeholder="https://example.com/resource"
              />
            </div>
          </Field>
          <p className="text-xs leading-5 text-slate-500">
            Data dan pilihan file hanya disimpan sementara di pratinjau ini, belum diunggah ke server.
          </p>
        </form>
      </Modal>

      <Modal
        open={dialog === 'link'}
        title={editingLinkId === null ? 'Tambah External Link' : 'Edit External Link'}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button type="submit" form="link-form" icon={<Check className="h-4 w-4" aria-hidden />}>Simpan Link</Button>
          </>
        }
      >
        <form id="link-form" className="space-y-4" onSubmit={saveLink}>
          <Field id="link-title" label="Nama tautan">
            <input id="link-title" className={inputClass()} value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} required maxLength={100} data-autofocus />
          </Field>
          <Field id="link-url" label="URL">
            <input id="link-url" type="url" className={inputClass()} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" required />
          </Field>
          <p className="text-xs text-slate-500">Tautan hanya ditampilkan pada pratinjau lokal.</p>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Hapus resource?"
        description={`"${deleteTarget?.title ?? ''}" akan dihapus dari daftar pratinjau.`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={confirmDelete} icon={<Trash2 className="h-4 w-4" aria-hidden />}>Hapus</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Perubahan hanya berlaku sementara di halaman ini.</p>
      </Modal>

      <Modal
        open={readingListOpen}
        title="Reading List"
        description="Daftar bacaan yang direkomendasikan untuk siswa."
        onClose={() => setReadingListOpen(false)}
      >
        <div className="space-y-3">
          <ReadingBook title="Clean Code: A Handbook of Agile Software Craftsmanship" author="Robert C. Martin" />
          <ReadingBook title="The Pragmatic Programmer" author="Andrew Hunt & David Thomas" />
          <ReadingBook title="You Don't Know JS Yet" author="Kyle Simpson" />
        </div>
      </Modal>
    </div>
  )
}

function FileTypeIcon({ type }: { type: DocumentType }) {
  const isPdf = type === 'PDF'
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
      <FileText className="h-5 w-5" aria-hidden />
      <span className="sr-only">{type}</span>
    </span>
  )
}

function ReadingBook({ title, author }: { title: string; author: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{title}</h4>
      <p className="mt-1 text-xs text-slate-500">{author}</p>
    </article>
  )
}

function ResourceIconAction({
  label,
  onClick,
  icon,
  danger = false,
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition ${
        danger ? 'text-slate-500 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-blue-50 hover:text-brand-700'
      }`}
    >
      {icon}
    </button>
  )
}

function displayUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}`
  } catch {
    return value
  }
}

function formatResourceFileSize(size: number): string {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
