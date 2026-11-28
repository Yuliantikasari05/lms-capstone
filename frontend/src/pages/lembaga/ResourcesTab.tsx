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
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import type { CourseModule, Material } from '../../features/courses/types'
import { toApiError } from '../../lib/api'
import { createMaterial, deleteMaterial, materialFileUrl, updateMaterial } from './api'

type DocumentType = 'PDF' | 'DOCX' | 'MP4'

interface ResourceDocument {
  id: number
  title: string
  /** Label jenis berkas mengikuti ekstensinya (PDF, DOCX, PPTX, MP4, …). */
  type: string
  date: string
  size: string
  description: string
  externalUrl: string
}

interface ReadingItem {
  id: number
  title: string
  author: string
  href: string | null
}

interface ExternalLink {
  id: number
  title: string
  url: string
}

const DOCUMENT_TYPES: Record<DocumentType, 'pdf' | 'document' | 'video'> = {
  PDF: 'pdf',
  DOCX: 'document',
  MP4: 'video',
}

const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Tab ini menampilkan materi dari modul program yang sedang dibuka (GET /courses/{id}/modules). */
export function ResourcesTab({ modules, onChanged }: { modules: CourseModule[]; onChanged: () => void }) {
  const materials = useMemo(() => modules.flatMap((module) => module.materials ?? []), [modules])
  const documents = useMemo(() => materials.filter(isStoredDocument).map(toResourceDocument), [materials])
  const links = useMemo(() => materials.filter(isExternalLink).map(toExternalLink), [materials])
  // Reading list = seluruh materi program, lengkap dengan modul asalnya.
  const readingList = useMemo<ReadingItem[]>(() => modules.flatMap((module) => (module.materials ?? []).map((material) => ({
    id: material.id,
    title: material.title,
    author: module.title,
    href: material.external_url ?? (material.has_file ? materialFileUrl(material.id) : null),
  }))), [modules])

  const [dialog, setDialog] = useState<'document' | 'link' | null>(null)
  const [editingDocument, setEditingDocument] = useState<ResourceDocument | null>(null)
  const [editingLink, setEditingLink] = useState<ExternalLink | null>(null)
  const [targetModuleId, setTargetModuleId] = useState<number | ''>('')
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('PDF')
  const [documentDescription, setDocumentDescription] = useState('')
  const [documentExternalUrl, setDocumentExternalUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)
  const [readingListOpen, setReadingListOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function openCreateDocument() {
    setEditingDocument(null)
    setTargetModuleId(modules[0]?.id ?? '')
    setDocumentTitle('')
    setDocumentType('PDF')
    setDocumentDescription('')
    setDocumentExternalUrl('')
    setSelectedFile(null)
    setFileError('')
    setDialog('document')
  }

  function editDocument(document: ResourceDocument) {
    setEditingDocument(document)
    setDocumentTitle(document.title)
    setDocumentType(documentTypeOf(document.type))
    setDocumentDescription(document.description)
    setDocumentExternalUrl(document.externalUrl)
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
    if (file.size > MAX_FILE_BYTES) {
      setFileError('Ukuran file melebihi batas maksimal 50 MB.')
      return
    }

    setFileError('')
    setSelectedFile(file)
    setDocumentType(supportedType)
    setDocumentTitle((current) => current || file.name.replace(/\.[^.]+$/, ''))
  }

  function onResourceFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  function onResourceFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    selectFile(event.dataTransfer.files[0])
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = documentTitle.trim()
    if (!title || busy || (!editingDocument && targetModuleId === '')) return

    setBusy(true)
    try {
      if (editingDocument) {
        await updateMaterial(editingDocument.id, {
          title,
          description: documentDescription.trim() || null,
          file: selectedFile,
          // Tautan hanya untuk materi video dan hanya bila tidak ada berkas baru.
          externalUrl:
            editingDocument.type === 'MP4' && !selectedFile ? documentExternalUrl.trim() : undefined,
        })
        setNotice('Resource berhasil diperbarui.')
      } else {
        await createMaterial(Number(targetModuleId), {
          title,
          type: DOCUMENT_TYPES[documentType],
          description: documentDescription.trim() || null,
          file: selectedFile,
          externalUrl: documentType === 'MP4' && !selectedFile ? documentExternalUrl.trim() || null : null,
        })
        setNotice(`Resource "${title}" berhasil disimpan.`)
      }
      onChanged()
      setDialog(null)
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  function openCreateLink() {
    setEditingLink(null)
    setTargetModuleId(modules[0]?.id ?? '')
    setLinkTitle('')
    setLinkUrl('')
    setDialog('link')
  }

  function editLink(link: ExternalLink) {
    setEditingLink(link)
    setLinkTitle(link.title)
    setLinkUrl(link.url)
    setDialog('link')
  }

  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = linkTitle.trim()
    const url = linkUrl.trim()
    if (!title || !url || busy || (!editingLink && targetModuleId === '')) return

    setBusy(true)
    try {
      if (editingLink) {
        await updateMaterial(editingLink.id, { title, externalUrl: url })
        setNotice('Tautan berhasil diperbarui.')
      } else {
        await createMaterial(Number(targetModuleId), { title, type: 'link', externalUrl: url })
        setNotice('Tautan berhasil ditambahkan.')
      }
      onChanged()
      setDialog(null)
    } catch (error) {
      setNotice(toApiError(error).message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return

    setBusy(true)
    try {
      await deleteMaterial(deleteTarget.id)
      setNotice(`"${deleteTarget.title}" berhasil dihapus.`)
      setDeleteTarget(null)
      onChanged()
    } catch (error) {
      setNotice(toApiError(error).message)
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
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
                    onClick={() => setDeleteTarget({ id: document.id, title: document.title })}
                    icon={<Trash2 className="h-4 w-4" aria-hidden />}
                    danger
                  />
                  <a
                    href={materialFileUrl(document.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 text-xs font-semibold text-brand-700 transition hover:bg-blue-100 sm:px-3"
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </a>
                </div>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500 sm:px-5">Belum ada dokumen pada modul ini.</li>
            )}
          </ul>
          <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs leading-5 text-slate-500 sm:px-5">
            Dokumen diambil dari materi modul program ini dan langsung terlihat oleh siswa.
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
                        onClick={() => setDeleteTarget({ id: link.id, title: link.title })}
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
              {readingList.slice(0, 2).map((item) => (
                <ReadingBook key={item.id} title={item.title} author={item.author} href={item.href} />
              ))}
              {readingList.length === 0 && (
                <p className="text-center text-sm text-slate-500">Belum ada materi untuk dibaca.</p>
              )}
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
        title={editingDocument === null ? 'Tambah Resource Baru' : 'Edit Resource'}
        onClose={() => setDialog(null)}
        size="xl"
        centered
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button
              type="submit"
              form="document-form"
              disabled={busy}
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
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
          {editingDocument === null && (
            <Field id="resource-module" label="Modul">
              <select
                id="resource-module"
                className={inputClass()}
                value={targetModuleId}
                onChange={(event) => setTargetModuleId(Number(event.target.value))}
                required
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id="resource-type" label="Tipe Resource">
            <select
              id="resource-type"
              className={inputClass()}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
              disabled={editingDocument !== null}
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
                {selectedFile?.name ??
                  (editingDocument
                    ? 'Pilih file baru untuk mengganti'
                    : 'Pilih file atau tarik ke sini')}
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
                disabled={documentType !== 'MP4'}
              />
            </div>
          </Field>
          <p className="text-xs leading-5 text-slate-500">
            File dan tautan langsung dikirim ke server dan menjadi materi modul yang dipilih.
          </p>
        </form>
      </Modal>

      <Modal
        open={dialog === 'link'}
        title={editingLink === null ? 'Tambah External Link' : 'Edit External Link'}
        onClose={() => setDialog(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Batal</Button>
            <Button
              type="submit"
              form="link-form"
              disabled={busy}
              icon={<Check className="h-4 w-4" aria-hidden />}
            >
              Simpan Link
            </Button>
          </>
        }
      >
        <form id="link-form" className="space-y-4" onSubmit={saveLink}>
          <Field id="link-title" label="Nama tautan">
            <input id="link-title" className={inputClass()} value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} required maxLength={100} data-autofocus />
          </Field>
          {editingLink === null && (
            <Field id="link-module" label="Modul">
              <select
                id="link-module"
                className={inputClass()}
                value={targetModuleId}
                onChange={(event) => setTargetModuleId(Number(event.target.value))}
                required
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id="link-url" label="URL">
            <input id="link-url" type="url" className={inputClass()} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://example.com" required />
          </Field>
          <p className="text-xs text-slate-500">Tautan menjadi materi modul dan dapat dibuka siswa.</p>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Hapus resource?"
        description={`"${deleteTarget?.title ?? ''}" akan dihapus dari materi modul.`}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Batal</Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={busy}
              icon={<Trash2 className="h-4 w-4" aria-hidden />}
            >
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Siswa tidak akan melihat materi ini lagi.</p>
      </Modal>

      <Modal
        open={readingListOpen}
        title="Reading List"
        description="Daftar bacaan yang direkomendasikan untuk siswa."
        onClose={() => setReadingListOpen(false)}
      >
        <div className="space-y-3">
          {readingList.map((item) => (
            <ReadingBook key={item.id} title={item.title} author={item.author} href={item.href} />
          ))}
          {readingList.length === 0 && (
            <p className="text-center text-sm text-slate-500">Belum ada materi untuk dibaca.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}

/** Materi bertipe link atau video tanpa berkas ditampilkan pada daftar tautan eksternal. */
function isExternalLink(material: Material): boolean {
  return material.type === 'link' || (!material.has_file && material.external_url !== null)
}

function isStoredDocument(material: Material): boolean {
  return !isExternalLink(material)
}

function toResourceDocument(material: Material): ResourceDocument {
  return {
    id: material.id,
    title: material.title,
    type: documentLabel(material),
    date: formatResourceDate(material.created_at),
    size: material.file?.size ? formatResourceFileSize(material.file.size) : '—',
    description: material.description ?? '',
    externalUrl: material.external_url ?? '',
  }
}

function toExternalLink(material: Material): ExternalLink {
  return {
    id: material.id,
    title: material.title,
    url: material.external_url ?? materialFileUrl(material.id),
  }
}

function FileTypeIcon({ type }: { type: string }) {
  const isPdf = type === 'PDF'
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isPdf ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
      <FileText className="h-5 w-5" aria-hidden />
      <span className="sr-only">{type}</span>
    </span>
  )
}

function ReadingBook({ title, author, href }: { title: string; author: string; href: string | null }) {
  const body = (
    <>
      <h4 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{title}</h4>
      <p className="mt-1 text-xs text-slate-500">{author}</p>
    </>
  )

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300">
      {body}
    </a>
  ) : (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">{body}</article>
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

function documentTypeOf(label: string): DocumentType {
  return label === 'PDF' ? 'PDF' : label === 'MP4' || label === 'WEBM' ? 'MP4' : 'DOCX'
}

/** Jenis berkas ditampilkan dari ekstensi nama file; tipe materi saja tidak cukup spesifik. */
function documentLabel(material: Material): string {
  const extension = material.file?.name?.split('.').pop()?.toUpperCase()

  if (extension) return extension

  return material.type === 'pdf' ? 'PDF' : material.type === 'video' ? 'MP4' : 'DOCX'
}

function formatResourceDate(iso: string | null | undefined): string {
  if (!iso) return 'Baru saja'

  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

function formatResourceFileSize(size: number): string {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
