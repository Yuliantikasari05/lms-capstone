import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleHelp,
  File,
  FileText,
  Film,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { LembagaPageHeader } from './LembagaPageHeader'

type MaterialType = 'video' | 'pdf' | 'file'

interface LearningMaterial {
  id: number
  title: string
  type: MaterialType
  detail: string
}

interface Chapter {
  id: number
  title: string
  materials: LearningMaterial[]
}

interface UploadedFile {
  id: string
  file: File
}

const INITIAL_CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'Bab 1: Pendahuluan',
    materials: [
      { id: 11, title: 'Pengenalan Konsep Dasar', type: 'video', detail: '05:30' },
      { id: 12, title: 'Silabus Kelas', type: 'pdf', detail: '1.2 MB' },
    ],
  },
]

const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_EXTENSIONS = ['pdf', 'ppt', 'pptx', 'mp4']

export default function TambahModul() {
  const [reportOpen, setReportOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [chapters, setChapters] = useState(INITIAL_CHAPTERS)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploadError, setUploadError] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [chapterDialog, setChapterDialog] = useState<'create' | 'edit' | null>(null)
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false)
  const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null)
  const [chapterTitle, setChapterTitle] = useState('')
  const [materialChapterId, setMaterialChapterId] = useState<number | null>(null)
  const [materialTitle, setMaterialTitle] = useState('')
  const [materialType, setMaterialType] = useState<MaterialType>('video')
  const [materialDetail, setMaterialDetail] = useState('')
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | File[]) {
    const accepted: UploadedFile[] = []
    const errors: string[] = []

    Array.from(files).forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
        errors.push(`${file.name}: format file tidak didukung.`)
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ukuran file melebihi 50 MB.`)
      } else {
        accepted.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file })
      }
    })

    if (accepted.length > 0) setUploadedFiles((current) => [...current, ...accepted])
    setUploadError(errors.join(' '))
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) addFiles(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  function onDropFiles(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    addFiles(event.dataTransfer.files)
  }

  function openCreateChapter() {
    setEditingChapterId(null)
    setChapterTitle(`Bab ${chapters.length + 1}: `)
    setChapterDialog('create')
  }

  function openEditChapter(chapter: Chapter) {
    setEditingChapterId(chapter.id)
    setChapterTitle(chapter.title)
    setChapterDialog('edit')
  }

  function saveChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = chapterTitle.trim()
    if (!title) return

    if (chapterDialog === 'edit' && editingChapterId !== null) {
      setChapters((current) =>
        current.map((chapter) => (chapter.id === editingChapterId ? { ...chapter, title } : chapter)),
      )
    } else {
      setChapters((current) => [...current, { id: Date.now(), title, materials: [] }])
    }

    setChapterDialog(null)
    setChapterTitle('')
    setEditingChapterId(null)
  }

  function openMaterialDialog(chapterId: number) {
    setMaterialChapterId(chapterId)
    setMaterialTitle('')
    setMaterialType('video')
    setMaterialDetail('')
    setMaterialDialogOpen(true)
  }

  function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (materialChapterId === null || !materialTitle.trim()) return

    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === materialChapterId
          ? {
              ...chapter,
              materials: [
                ...chapter.materials,
                {
                  id: Date.now(),
                  title: materialTitle.trim(),
                  type: materialType,
                  detail: materialDetail.trim() || (materialType === 'video' ? '00:00' : 'Belum ada ukuran'),
                },
              ],
            }
          : chapter,
      ),
    )
    setMaterialDialogOpen(false)
  }

  function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormMessage(`Modul "${moduleName.trim()}" berhasil disimpan dalam pratinjau. Data belum dikirim ke server.`)
  }

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />

      <div>
        <Link
          to="/lembaga/modules"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 transition hover:text-brand-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke Kelola Modul
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Tambah Modul Baru</h1>
        <p className="mt-1 text-sm text-slate-500">Buat struktur dan konten untuk modul baru Anda.</p>
      </div>

      <form className="space-y-5" onSubmit={saveModule}>
        <FormCard
          icon={<BookOpen className="h-5 w-5" aria-hidden />}
          title="Identitas Modul"
          description="Tentukan nama, kategori, dan ringkasan pembelajaran."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="module-name" label="Nama Modul">
              <input
                id="module-name"
                className={inputClass()}
                value={moduleName}
                onChange={(event) => {
                  setModuleName(event.target.value)
                  setFormMessage('')
                }}
                placeholder="Contoh: Desain Grafis Remaja"
                maxLength={100}
                required
              />
            </Field>
            <Field id="module-category" label="Kategori">
              <select
                id="module-category"
                className={inputClass()}
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value)
                  setFormMessage('')
                }}
                required
              >
                <option value="">Pilih Kategori...</option>
                <option value="teknologi">Teknologi</option>
                <option value="desain">Desain Kreatif</option>
                <option value="bisnis">Bisnis</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field id="module-description" label="Deskripsi Singkat">
              <textarea
                id="module-description"
                className={`${inputClass()} min-h-28 resize-y`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Jelaskan secara singkat apa yang akan dipelajari di modul ini..."
                maxLength={500}
                rows={4}
              />
            </Field>
          </div>
        </FormCard>

        <FormCard
          icon={<Upload className="h-5 w-5" aria-hidden />}
          title="Materi Pembelajaran"
          description="Unggah materi pendukung untuk modul Anda."
        >
          <input
            ref={pdfInputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.ppt,.pptx"
            multiple
            onChange={onFileInputChange}
            aria-label="Pilih file PDF atau presentasi"
          />
          <input
            ref={videoInputRef}
            className="sr-only"
            type="file"
            accept=".mp4"
            multiple
            onChange={onFileInputChange}
            aria-label="Pilih file video"
          />
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropFiles}
            className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center transition-colors hover:border-brand-400 hover:bg-blue-50/50 sm:px-8"
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-brand-700">
              <File className="h-6 w-6" aria-hidden />
            </span>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-slate-700">
              Tarik dan lepas file di sini atau klik untuk menelusuri dari komputer Anda.
            </p>
            <p className="mt-1 text-xs text-slate-500">Mendukung PDF, PPT, MP4 (Max 50MB)</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={<FileText className="h-4 w-4" aria-hidden />}
                onClick={() => pdfInputRef.current?.click()}
              >
                Upload PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<Film className="h-4 w-4" aria-hidden />}
                onClick={() => videoInputRef.current?.click()}
              >
                Upload Video
              </Button>
            </div>
          </div>
          {uploadError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </p>
          )}
          {uploadedFiles.length > 0 && (
            <ul className="mt-3 space-y-2" aria-label="File yang dipilih">
              {uploadedFiles.map(({ id, file }) => (
                <li key={id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{file.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    aria-label={`Hapus ${file.name}`}
                    onClick={() => setUploadedFiles((current) => current.filter((item) => item.id !== id))}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FormCard>

        <FormCard
          icon={<FolderPlus className="h-5 w-5" aria-hidden />}
          title="Struktur Kurikulum"
          description="Susun bab utama dan materi pembelajaran."
          action={
            <Button
              type="button"
              onClick={openCreateChapter}
              icon={<Plus className="h-4 w-4" aria-hidden />}
              className="px-3 py-1.5 text-sm"
            >
              Tambah Bab
            </Button>
          }
        >
          {chapters.length > 0 ? (
            <div className="space-y-3">
              {chapters.map((chapter) => (
                <article key={chapter.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-3 sm:flex-nowrap sm:px-4">
                    <h3 className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{chapter.title}</h3>
                    <div className="flex items-center gap-1">
                      <IconAction
                        label={`Tambah sub-materi ke ${chapter.title}`}
                        onClick={() => openMaterialDialog(chapter.id)}
                        icon={<Plus className="h-4 w-4" aria-hidden />}
                      />
                      <IconAction
                        label={`Edit ${chapter.title}`}
                        onClick={() => openEditChapter(chapter)}
                        icon={<Pencil className="h-4 w-4" aria-hidden />}
                      />
                      <IconAction
                        label={`Hapus ${chapter.title}`}
                        onClick={() => setChapterToDelete(chapter)}
                        icon={<Trash2 className="h-4 w-4" aria-hidden />}
                        danger
                      />
                    </div>
                  </div>
                  {chapter.materials.length > 0 && (
                    <ul className="border-t border-slate-100 bg-slate-50/70 px-3 sm:px-4">
                      {chapter.materials.map((material) => (
                        <li
                          key={material.id}
                          className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              material.type === 'video'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {material.type === 'video' ? (
                              <Film className="h-4 w-4" aria-hidden />
                            ) : (
                              <FileText className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{material.title}</span>
                          <span className="shrink-0 text-xs text-slate-500">{material.detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {chapter.materials.length === 0 && (
                    <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
                      Belum ada materi di bab ini.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-600">
              <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
              <p>Klik &quot;Tambah Bab&quot; untuk mulai menyusun materi Anda.</p>
            </div>
          )}
          {chapters.length > 0 && (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Klik &quot;Tambah Bab&quot; untuk menambahkan bagian kurikulum, lalu gunakan tombol tambah untuk mengisi sub-materi.
            </p>
          )}
        </FormCard>

        {formMessage && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {formMessage}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3 pb-2">
          <Link
            to="/lembaga/modules"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Batal
          </Link>
          <Button
            type="submit"
            icon={<Check className="h-4 w-4" aria-hidden />}
            className="px-4 py-2 text-sm"
            onClick={() => setFormMessage('')}
          >
            Simpan Modul
          </Button>
        </div>
      </form>

      <Modal
        open={chapterDialog !== null}
        title={chapterDialog === 'edit' ? 'Edit Bab' : 'Tambah Bab'}
        onClose={() => setChapterDialog(null)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setChapterDialog(null)}>
              Batal
            </Button>
            <Button type="submit" form="chapter-form" icon={<Check className="h-4 w-4" aria-hidden />}>
              Simpan Bab
            </Button>
          </>
        }
      >
        <form id="chapter-form" onSubmit={saveChapter}>
          <Field id="chapter-title" label="Nama bab">
            <input
              id="chapter-title"
              className={inputClass()}
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              required
              maxLength={100}
              data-autofocus
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={materialDialogOpen}
        title="Tambah Sub-materi"
        onClose={() => setMaterialDialogOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMaterialDialogOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="material-form" icon={<Plus className="h-4 w-4" aria-hidden />}>
              Tambah Materi
            </Button>
          </>
        }
      >
        <form id="material-form" className="space-y-4" onSubmit={saveMaterial}>
          <Field id="material-title" label="Nama materi">
            <input
              id="material-title"
              className={inputClass()}
              value={materialTitle}
              onChange={(event) => setMaterialTitle(event.target.value)}
              placeholder="Contoh: Pengenalan konsep"
              required
              maxLength={100}
              data-autofocus
            />
          </Field>
          <Field id="material-type" label="Jenis materi">
            <select
              id="material-type"
              className={inputClass()}
              value={materialType}
              onChange={(event) => setMaterialType(event.target.value as MaterialType)}
            >
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="file">File lainnya</option>
            </select>
          </Field>
          <Field id="material-detail" label={materialType === 'video' ? 'Durasi' : 'Ukuran file'} hint="Contoh: 05:30 atau 1.2 MB">
            <input
              id="material-detail"
              className={inputClass()}
              value={materialDetail}
              onChange={(event) => setMaterialDetail(event.target.value)}
              placeholder={materialType === 'video' ? '05:30' : '1.2 MB'}
              maxLength={30}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={chapterToDelete !== null}
        title="Hapus Bab?"
        description={`Bab "${chapterToDelete?.title ?? ''}" dan daftar materi di dalamnya akan dihapus dari pratinjau.`}
        onClose={() => setChapterToDelete(null)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setChapterToDelete(null)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (chapterToDelete) setChapters((current) => current.filter((chapter) => chapter.id !== chapterToDelete.id))
                setChapterToDelete(null)
              }}
            >
              Hapus Bab
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Tindakan ini hanya mengubah data sementara pada halaman.</p>
      </Modal>

      <Modal
        open={reportOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan belum tersedia di pratinjau statis."
        onClose={() => setReportOpen(false)}
      >
        <p className="text-sm leading-6 text-slate-600">Data laporan akan tersedia setelah terhubung ke backend.</p>
      </Modal>
    </div>
  )
}

function FormCard({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-brand-700">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  )
}

function IconAction({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white transition focus-visible:outline ${
        danger
          ? 'text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'text-slate-500 hover:border-brand-200 hover:bg-blue-50 hover:text-brand-700'
      }`}
    >
      {icon}
    </button>
  )
}

function formatFileSize(size: number): string {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`
}
