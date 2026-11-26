import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorState, Spinner } from '../../components/ui/States'
import { toApiError } from '../../lib/api'
import { useApiData } from '../../lib/useApiData'
import { fetchAssignments } from './assignmentApi'
import {
  createMaterial,
  createModule,
  createSession,
  fetchCurriculum,
  materialTypeFor,
  removeMaterial,
  removeModule,
  removeSession,
  updateMaterial,
  updateModule,
  updateSession,
  type CurriculumClass,
  type CurriculumDiscussion,
  type CurriculumItem,
  type CurriculumItemType,
  type CurriculumModule,
  type ItemPublicationStatus,
} from './curriculumApi'
import { SessionScheduleFields } from './SessionScheduleFields'
import type { SessionScheduleDetails } from './sessionData'

type ItemSelection = CurriculumItemType
type ItemWizardStep = 1 | 2 | 3
type CurriculumTab = 'modul' | 'sesi' | 'materi' | 'diskusi'

interface ModuleDialogState {
  classId: number
  moduleId?: number
}

interface ItemDialogState {
  classId: number
  moduleId: number
  itemId?: string
}

const ITEM_TYPES: { type: CurriculumItemType; label: string; icon: LucideIcon }[] = [
  { type: 'materi', label: 'Materi', icon: BookOpen },
  { type: 'tugas', label: 'Tugas', icon: ClipboardList },
  { type: 'ujian', label: 'Ujian', icon: FileText },
  { type: 'sesi', label: 'Sesi bimbingan', icon: Video },
]

const ITEM_SELECTIONS: { value: ItemSelection; label: string; description: string }[] = [
  { value: 'materi', label: 'Materi', description: 'Bagikan PDF atau slide PPT sebagai bahan belajar.' },
  { value: 'ujian', label: 'Ujian', description: 'Pilih ujian aktif dari menu Tugas.' },
  { value: 'tugas', label: 'Tugas', description: 'Pilih tugas atau kuis aktif dari menu Tugas.' },
  { value: 'sesi', label: 'Sesi bimbingan', description: 'Jadwalkan sesi bimbingan untuk modul.' },
]

const TAB_ITEMS: { value: CurriculumTab; label: string; icon: LucideIcon }[] = [
  { value: 'modul', label: 'Modul', icon: BookOpen },
  { value: 'sesi', label: 'Sesi', icon: CalendarDays },
  { value: 'materi', label: 'Materi', icon: FileText },
  { value: 'diskusi', label: 'Diskusi', icon: MessageSquare },
]

const ITEM_STYLES: Record<CurriculumItemType, string> = {
  materi: 'bg-blue-50 text-blue-700',
  tugas: 'bg-amber-50 text-amber-700',
  ujian: 'bg-violet-50 text-violet-700',
  sesi: 'bg-emerald-50 text-emerald-700',
}

export default function MentorKurikulum() {
  const curriculum = useApiData(fetchCurriculum, [])
  const [classes, setClasses] = useState<CurriculumClass[]>([])
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<CurriculumTab>('modul')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [moduleDialog, setModuleDialog] = useState<ModuleDialogState | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [moduleError, setModuleError] = useState('')
  const [itemDialog, setItemDialog] = useState<ItemDialogState | null>(null)
  const [previewMaterial, setPreviewMaterial] = useState<CurriculumItem | null>(null)

  // Data server adalah sumber kebenaran; status buka/tutup modul tetap dipertahankan saat reload.
  useEffect(() => {
    if (!curriculum.data) return

    setClasses((previous) => curriculum.data!.map((next) => {
      const old = previous.find((item) => item.id === next.id)
      return {
        ...next,
        modules: next.modules.map((module) => ({
          ...module,
          expanded: old?.modules.find((item) => item.id === module.id)?.expanded ?? module.expanded,
        })),
      }
    }))
  }, [curriculum.data])

  const filteredClasses = useMemo(() => classes.filter((item) =>
    `${item.title} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [classes, search])

  function openAddModule(classId: number) {
    setModuleDialog({ classId })
    setModuleTitle('')
    setModuleDescription('')
    setModuleError('')
  }

  function openEditModule(classId: number, module: CurriculumModule) {
    setModuleDialog({ classId, moduleId: module.id })
    setModuleTitle(module.title)
    setModuleDescription(module.description)
    setModuleError('')
  }

  async function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moduleDialog || !moduleTitle.trim()) return
    const title = moduleTitle.trim()
    const description = moduleDescription.trim()
    setModuleError('')

    try {
      if (moduleDialog.moduleId !== undefined) {
        await updateModule(moduleDialog.moduleId, { title, description })
      } else {
        await createModule(moduleDialog.classId, { title, description })
      }
      setNotice(moduleDialog.moduleId ? `Modul "${title}" diperbarui.` : `Modul "${title}" ditambahkan.`)
      setExpandedClassId(moduleDialog.classId)
      setActiveTab('modul')
      setModuleDialog(null)
      curriculum.reload()
    } catch (failure) {
      setModuleError(toApiError(failure).message)
    }
  }

  async function deleteModule(module: CurriculumModule) {
    setError('')

    try {
      await removeModule(module.id)
      setNotice(`Modul "${module.title}" dihapus.`)
      curriculum.reload()
    } catch (failure) {
      setError(toApiError(failure).message)
    }
  }

  function openItemDialog(classId: number, moduleId: number, item?: CurriculumItem) {
    setItemDialog({ classId, moduleId, itemId: item?.id })
  }

  async function saveItems(dialog: ItemDialogState, addedItems: CurriculumItem[]): Promise<string | null> {
    const next = addedItems[0]
    const curriculumClass = classes.find((item) => item.id === dialog.classId)
    const oldItem = curriculumClass?.modules
      .find((module) => module.id === dialog.moduleId)
      ?.items.find((item) => item.id === dialog.itemId)

    if (!next || !curriculumClass) return 'Item tidak dapat disimpan.'

    if (next.type !== 'materi' && next.type !== 'sesi') {
      return 'Tugas dan ujian belum tersedia dari server. Kelola lewat menu Tugas.'
    }

    if (next.type === 'sesi' && !next.meetingLink) {
      return 'Link meeting wajib diisi untuk sesi bimbingan.'
    }

    try {
      // Tipe item tidak dapat diubah di tempat: hapus dulu bila pengguna mengganti jenisnya.
      if (oldItem?.materialId && next.type !== 'materi') await removeMaterial(oldItem.materialId)
      if (oldItem?.sessionId && next.type !== 'sesi') await removeSession(oldItem.sessionId)

      if (next.type === 'materi') {
        const replaceMaterial = oldItem?.materialId
          && oldItem.materialType !== materialTypeFor(next)
          && Boolean(next.attachment || next.externalUrl)

        if (replaceMaterial && oldItem.materialId) await removeMaterial(oldItem.materialId)
        if (oldItem?.materialId && !replaceMaterial) await updateMaterial(oldItem.materialId, next)
        else await createMaterial(dialog.moduleId, next)
      } else if (oldItem?.sessionId) {
        await updateSession(oldItem.sessionId, next)
      } else {
        await createSession(dialog.classId, next)
      }
    } catch (failure) {
      return toApiError(failure).message
    }

    setNotice(dialog.itemId ? 'Item diperbarui.' : 'Item ditambahkan.')
    setExpandedClassId(dialog.classId)
    setActiveTab(next.type === 'materi' ? 'materi' : 'sesi')
    setItemDialog(null)
    curriculum.reload()

    return null
  }

  async function deleteItem(item: CurriculumItem) {
    setError('')

    try {
      if (item.materialId) await removeMaterial(item.materialId)
      else if (item.sessionId) await removeSession(item.sessionId)
      setNotice(`Item "${item.title}" dihapus.`)
      curriculum.reload()
    } catch (failure) {
      setError(toApiError(failure).message)
    }
  }

  function toggleModule(classId: number, moduleId: number) {
    setClasses((current) => current.map((item) => item.id !== classId
      ? item
      : {
          ...item,
          modules: item.modules.map((module) => module.id === moduleId
            ? { ...module, expanded: !module.expanded }
            : module),
        }))
  }

  const activeItemClass = itemDialog
    ? classes.find((item) => item.id === itemDialog.classId)
    : undefined
  const activeItem = itemDialog?.itemId
    ? activeItemClass?.modules.find((module) => module.id === itemDialog.moduleId)?.items.find((item) => item.id === itemDialog.itemId)
    : undefined

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Manajemen kurikulum</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola modul dan item pada kurikulum yang disediakan Admin.</p>
        </div>
        <label className="relative block min-w-56 sm:w-64">
          <span className="sr-only">Cari kurikulum</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kurikulum"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </header>

      {notice && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Tutup pemberitahuan" className="font-semibold hover:underline">Tutup</button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Tutup pesan kesalahan" className="font-semibold hover:underline">Tutup</button>
        </div>
      )}

      {curriculum.loading && !curriculum.data && <Spinner label="Memuat kurikulum…" />}
      {curriculum.error && <ErrorState error={curriculum.error} onRetry={curriculum.reload} />}

      {curriculum.data !== null && !curriculum.error && (filteredClasses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <GraduationCap className="mx-auto h-9 w-9 text-slate-300" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-slate-700">{search ? 'Kurikulum tidak ditemukan' : 'Belum ada kurikulum dari Admin'}</p>
          <p className="mt-1 text-xs text-slate-500">{search ? 'Coba kata kunci lain.' : 'Kurikulum yang ditugaskan Admin akan muncul di sini.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClasses.map((item) => (
            <CurriculumClassCard
              key={item.id}
              curriculumClass={item}
              expanded={expandedClassId === item.id}
              activeTab={activeTab}
              allowXp={item.allowsXp}
              onToggle={() => {
                setExpandedClassId((current) => current === item.id ? null : item.id)
                setActiveTab('modul')
              }}
              onAddModule={() => openAddModule(item.id)}
              onTabChange={setActiveTab}
              onEditModule={(module) => openEditModule(item.id, module)}
              onDeleteModule={deleteModule}
              onToggleModule={(moduleId) => toggleModule(item.id, moduleId)}
              onAddItem={(moduleId) => openItemDialog(item.id, moduleId)}
              onViewMaterial={setPreviewMaterial}
              onEditItem={(moduleId, curriculumItem) => openItemDialog(item.id, moduleId, curriculumItem)}
              onDeleteItem={(_, curriculumItem) => deleteItem(curriculumItem)}
            />
          ))}
        </div>
      ))}

      <p className="text-center text-[11px] text-slate-400">Perubahan modul, materi, dan sesi langsung disimpan ke server.</p>

      <Modal
        open={moduleDialog !== null}
        title={moduleDialog?.moduleId ? 'Edit modul' : 'Tambah modul'}
        onClose={() => setModuleDialog(null)}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setModuleDialog(null)}>Batal</Button>
            <Button type="submit" form="curriculum-module-form" icon={<Check className="h-4 w-4" aria-hidden />}>Simpan modul</Button>
          </>
        )}
      >
        <form id="curriculum-module-form" onSubmit={saveModule} className="space-y-4">
          <Field id="curriculum-module-title" label="Judul modul">
            <input id="curriculum-module-title" className={inputClass()} value={moduleTitle} onChange={(event) => setModuleTitle(event.target.value)} maxLength={120} required data-autofocus />
          </Field>
          <Field id="curriculum-module-description" label="Deskripsi modul">
            <textarea id="curriculum-module-description" className={`${inputClass()} min-h-24 resize-y`} value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} maxLength={500} />
          </Field>
          {moduleError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{moduleError}</p>}
        </form>
      </Modal>

      {itemDialog && activeItemClass && (
        <CurriculumItemWizard
          key={`${itemDialog.classId}-${itemDialog.moduleId}-${itemDialog.itemId ?? 'new'}`}
          dialog={itemDialog}
          curriculum={activeItemClass}
          existingItem={activeItem}
          onClose={() => setItemDialog(null)}
          onSave={(items) => saveItems(itemDialog, items)}
        />
      )}
      {previewMaterial && (
        <MaterialPreviewDialog item={previewMaterial} onClose={() => setPreviewMaterial(null)} />
      )}
    </div>
  )
}

function CurriculumItemWizard({
  dialog,
  curriculum,
  existingItem,
  onClose,
  onSave,
}: {
  dialog: ItemDialogState
  curriculum: CurriculumClass
  existingItem?: CurriculumItem
  onClose: () => void
  onSave: (items: CurriculumItem[]) => Promise<string | null>
}) {
  const initialSelection: ItemSelection = existingItem?.type === 'materi'
    ? 'materi'
    : existingItem?.type === 'tugas'
      ? 'tugas'
      : existingItem?.type === 'ujian'
        ? 'ujian'
        : existingItem?.type === 'sesi'
          ? 'sesi'
          : 'materi'
  const assignmentsState = useApiData(fetchAssignments, [])
  const assignments = assignmentsState.data ?? []
  const initialAssignment = existingItem?.assignmentId
    ? assignments.find((assignment) => assignment.id === existingItem.assignmentId)
    : assignments.find((assignment) =>
        assignment.courseId === curriculum.id
        && assignment.active
        && assignment.approval === 'Tersedia'
        && (initialSelection === 'tugas' ? assignment.kind !== 'Ujian' : assignment.kind === 'Ujian'),
      )
  const initialDetailParts = existingItem?.detail.split(' · ') ?? []
  const durationLabel = initialDetailParts.find((part) => part.endsWith('menit'))
  const parsedDuration = durationLabel ? Number(durationLabel.replace(' menit', '')) : 15
  const initialDuration = existingItem?.durationMinutes
    ?? (Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 15)
  const canAwardXp = curriculum.allowsXp
  const canCreateSession = curriculum.sessionType !== null

  const [step, setStep] = useState<ItemWizardStep>(1)
  const [selection, setSelection] = useState<ItemSelection>(initialSelection)
  const [title, setTitle] = useState(existingItem?.title ?? '')
  const [description, setDescription] = useState(existingItem?.description ?? '')
  const [materialFormat, setMaterialFormat] = useState(existingItem?.materialFormat ?? initialDetailParts[0] ?? 'PDF')
  const [duration, setDuration] = useState(initialDuration)
  const [fileName, setFileName] = useState(existingItem?.resource && !existingItem.resource.startsWith('http') ? existingItem.resource : '')
  const [attachment, setAttachment] = useState(existingItem?.attachment)
  const [resourceUrl, setResourceUrl] = useState(existingItem?.externalUrl ?? (existingItem?.resource?.startsWith('http') ? existingItem.resource : ''))
  const [assignmentId, setAssignmentId] = useState(String(initialAssignment?.id ?? ''))
  const [sessionDetails, setSessionDetails] = useState<SessionScheduleDetails>({
    date: existingItem?.date?.slice(0, 10) ?? '',
    startTime: existingItem?.startTime ?? '13:00',
    endTime: existingItem?.endTime ?? '14:00',
    type: existingItem?.sessionType ?? curriculum.sessionType ?? 'Kelas reguler',
    mode: existingItem?.mode ?? 'Online',
    location: existingItem?.location ?? '',
    meetingLink: existingItem?.meetingLink ?? '',
  })
  const [materialXp, setMaterialXp] = useState(existingItem?.type === 'materi' ? existingItem.xpPoints : 10)
  const [assessmentXp, setAssessmentXp] = useState(existingItem && existingItem.type !== 'materi' ? existingItem.xpPoints : 10)
  const [error, setError] = useState('')

  const includesMaterial = selection === 'materi'
  const includesExam = selection === 'ujian'
  const includesTask = selection === 'tugas'
  const includesSession = selection === 'sesi'
  const selectedAssignmentKinds = includesTask ? ['Tugas', 'Kuis'] : includesExam ? ['Ujian'] : []
  const availableAssignments = assignments.filter((assignment) =>
    assignment.courseId === curriculum.id
    && assignment.active
    && assignment.approval === 'Tersedia'
    && selectedAssignmentKinds.includes(assignment.kind),
  )
  const selectedAssignment = availableAssignments.find((assignment) => String(assignment.id) === assignmentId)

  async function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (step === 1) {
      setStep(2)
      return
    }

    if (step === 2) {
      if (includesSession && sessionDetails.endTime <= sessionDetails.startTime) {
        setError('Waktu selesai harus setelah waktu mulai.')
        return
      }
      if ((includesExam || includesTask) && !selectedAssignment) {
        setError(availableAssignments.length
          ? 'Pilih soal aktif untuk ditambahkan ke modul.'
          : 'Belum ada soal aktif yang tersedia untuk kurikulum ini. Aktifkan soal terkait di menu Tugas terlebih dahulu.')
        return
      }
      if (includesMaterial && !dialog.itemId && !fileName && !resourceUrl.trim()) {
        setError('Unggah file materi atau masukkan tautan eksternal sebelum melanjutkan.')
        return
      }
      setStep(3)
      return
    }

    const now = Date.now()
    const addedItems: CurriculumItem[] = []
    const effectiveMaterialXp = canAwardXp ? Math.max(0, materialXp) : 0
    const effectiveAssessmentXp = canAwardXp ? Math.max(0, assessmentXp) : 0

    if (includesMaterial) {
      const resource = fileName || resourceUrl.trim()
      addedItems.push({
        id: existingItem?.type === 'materi' ? existingItem.id : `item-${now}-material`,
        title: title.trim(),
        description: description.trim(),
        type: 'materi',
        status: 'published',
        xpPoints: effectiveMaterialXp,
        detail: `${materialFormat} · ${duration} menit`,
        materialFormat,
        durationMinutes: duration,
        resource,
        ...(resourceUrl.trim() ? { externalUrl: resourceUrl.trim() } : {}),
        ...(attachment ? { attachment } : {}),
      })
    }

    if ((includesExam || includesTask) && selectedAssignment) {
      const type: CurriculumItemType = selectedAssignment.kind === 'Ujian' ? 'ujian' : 'tugas'
      addedItems.push({
        id: existingItem && existingItem.type !== 'materi' ? existingItem.id : `item-${now}-assignment`,
        title: selectedAssignment.title,
        description: description.trim(),
        type,
        status: 'published',
        xpPoints: effectiveAssessmentXp,
        detail: `${selectedAssignment.kind} · ${selectedAssignment.format}`,
        assignmentId: selectedAssignment.id,
      })
    }

    if (includesSession) {
      addedItems.push({
        id: existingItem?.type === 'sesi' ? existingItem.id : `item-${now}-session`,
        title: title.trim(),
        description: description.trim(),
        type: 'sesi',
        status: 'published',
        xpPoints: effectiveAssessmentXp,
        detail: `${sessionDetails.startTime}–${sessionDetails.endTime} · ${sessionDetails.mode}`,
        sessionId: existingItem?.sessionId,
        date: sessionDetails.date,
        startTime: sessionDetails.startTime,
        endTime: sessionDetails.endTime,
        sessionType: sessionDetails.type,
        mode: sessionDetails.mode,
        location: sessionDetails.location.trim(),
        meetingLink: sessionDetails.meetingLink.trim(),
      })
    }

    const failure = await onSave(addedItems)
    if (failure) setError(failure)
  }

  return (
    <Modal
      open
      title={dialog.itemId ? 'Edit item' : 'Tambah item'}
      description={`Kurikulum ${curriculum.title} · Modul ${curriculum.modules.find((module) => module.id === dialog.moduleId)?.title ?? ''}`}
      onClose={onClose}
      size="lg"
      footer={(
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              if (step === 1) onClose()
              else {
                setError('')
                setStep((current) => (current - 1) as ItemWizardStep)
              }
            }}
          >
            {step === 1 ? 'Batal' : 'Kembali'}
          </Button>
          <Button type="submit" form="curriculum-item-wizard-form" icon={step === 3 ? <Check className="h-4 w-4" aria-hidden /> : undefined}>
            {step === 3 ? 'Simpan' : 'Lanjut'}
          </Button>
        </div>
      )}
    >
      <form id="curriculum-item-wizard-form" onSubmit={submitStep} className="space-y-5">
        <ol aria-label="Tahapan tambah item" className="grid grid-cols-3 gap-2">
          {(['Info dasar', 'Detail konten', 'Tinjauan'] as const).map((label, index) => {
            const stepNumber = index + 1
            const reached = stepNumber <= step
            return (
              <li key={label} className={`border-b-2 pb-2 text-[10px] font-medium ${reached ? 'border-brand-500 text-brand-700' : 'border-slate-200 text-slate-400'}`}>
                {stepNumber}. {label}
              </li>
            )
          })}
        </ol>

        {step === 1 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-slate-700">Pilih tipe konten yang ingin ditambahkan</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ITEM_SELECTIONS.filter((option) => option.value !== 'sesi' || canCreateSession).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selection === option.value}
                    onClick={() => {
                      setSelection(option.value)
                      setError('')
                    }}
                    className={`rounded-lg border p-3 text-left transition-colors ${selection === option.value ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className="block text-xs font-semibold text-slate-800">{option.label}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {(includesMaterial || includesSession) && (
              <Field id="wizard-item-title" label={includesSession ? 'Judul sesi' : 'Judul materi'}>
                <input id="wizard-item-title" className={inputClass()} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required data-autofocus />
              </Field>
            )}

            {includesMaterial && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="wizard-material-format" label="Format materi">
                  <select id="wizard-material-format" className={inputClass()} value={materialFormat} onChange={(event) => setMaterialFormat(event.target.value)} required>
                    <option value="PDF">PDF</option>
                    <option value="PPT">PPT</option>
                    <option value="PPTX">PPTX</option>
                    <option value="Dokumen">Dokumen</option>
                    <option value="Video">Video</option>
                    <option value="Tautan">Tautan</option>
                  </select>
                </Field>
                <Field id="wizard-material-duration" label="Estimasi durasi (menit)">
                  <input id="wizard-material-duration" type="number" min="1" className={inputClass()} value={duration} onChange={(event) => setDuration(Number(event.target.value))} required />
                </Field>
              </div>
            )}

            {canAwardXp && (
              <Field id="wizard-single-xp" label="XP reward untuk siswa">
                <input id="wizard-single-xp" type="number" min="0" max="1000" className={inputClass()} value={selection === 'materi' ? materialXp : assessmentXp} onChange={(event) => selection === 'materi' ? setMaterialXp(Number(event.target.value)) : setAssessmentXp(Number(event.target.value))} />
              </Field>
            )}
            {!canAwardXp && <p className="text-[10px] text-slate-500">XP hanya tersedia untuk kursus siswa.</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {includesMaterial && (
              <>
                <Field id="wizard-item-description" label="Deskripsi materi">
                  <textarea id="wizard-item-description" className={`${inputClass()} min-h-24 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Tuliskan deskripsi materi di sini" />
                </Field>
                <Field id="wizard-material-file" label="Upload materi PDF atau slide PPT">
                  <input
                    id="wizard-material-file"
                    type="file"
                    accept=".pdf,.ppt,.pptx"
                    className={`${inputClass()} file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs`}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const file = event.target.files?.[0]
                      setAttachment(file)
                      setFileName(file?.name ?? '')
                      if (file) setResourceUrl('')
                    }}
                  />
                </Field>
                {fileName && <p className="text-[10px] text-slate-500">File dipilih: {fileName}</p>}
                <Field id="wizard-material-url" label="Link eksternal (Google Drive/Docs)">
                  <input
                    id="wizard-material-url"
                    type="url"
                    className={inputClass()}
                    value={resourceUrl}
                    onChange={(event) => {
                      setResourceUrl(event.target.value)
                      if (event.target.value) {
                        setAttachment(undefined)
                        setFileName('')
                      }
                    }}
                    placeholder="https://..."
                  />
                </Field>
              </>
            )}

            {(includesExam || includesTask) && (
              <Field id="wizard-assignment" label={includesExam ? 'Pilih ujian aktif' : 'Pilih tugas / kuis aktif'}>
                <select
                  id="wizard-assignment"
                  className={inputClass()}
                  value={assignmentId}
                  onChange={(event) => setAssignmentId(event.target.value)}
                  required
                  data-autofocus={!includesMaterial}
                >
                  <option value="">Pilih soal</option>
                  {availableAssignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>{assignment.title} · {assignment.kind}</option>
                  ))}
                </select>
                {availableAssignments.length === 0 && (
                  <p className="mt-1.5 text-[10px] leading-4 text-amber-700">
                    Belum ada soal aktif untuk kursus ini. Aktifkan soal dari menu Tugas dan pastikan kursusnya sesuai.
                  </p>
                )}
              </Field>
            )}

            {includesSession && (
              <>
                <Field id="wizard-session-description" label="Deskripsi sesi">
                  <textarea id="wizard-session-description" className={`${inputClass()} min-h-24 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
                </Field>
                <SessionScheduleFields value={sessionDetails} onChange={setSessionDetails} />
              </>
            )}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{error}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Tinjau konten sebelum disimpan</h3>
                  <p className="mt-1 text-[10px] text-slate-600">Konten akan ditambahkan ke modul setelah Anda menyimpan.</p>
                </div>
              </div>
            </div>

            {includesMaterial && (
              <ReviewItem
                title={title}
                type="Materi"
                detail={`${materialFormat} · ${duration} menit`}
                resource={fileName || resourceUrl || 'File atau tautan belum dipilih'}
                xp={canAwardXp ? materialXp : 0}
              />
            )}
            {(includesExam || includesTask) && selectedAssignment && (
              <ReviewItem
                title={selectedAssignment.title}
                type={selectedAssignment.kind}
                detail={`${selectedAssignment.format} · Soal aktif dari menu Tugas`}
                resource={selectedAssignment.title}
                xp={canAwardXp ? assessmentXp : 0}
              />
            )}
            {includesSession && (
              <ReviewItem
                title={title}
                type="Sesi bimbingan"
                detail={`${sessionDetails.date} · ${sessionDetails.startTime}–${sessionDetails.endTime} · ${sessionDetails.type} · ${sessionDetails.mode}`}
                resource={sessionDetails.mode === 'Online' ? sessionDetails.meetingLink || 'Meeting link belum diisi' : sessionDetails.location || 'Lokasi belum diisi'}
                xp={canAwardXp ? assessmentXp : 0}
              />
            )}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] text-rose-700">{error}</p>}
          </div>
        )}
      </form>
    </Modal>
  )
}

function ReviewItem({
  title,
  type,
  detail,
  resource,
  xp,
}: {
  title: string
  type: string
  detail: string
  resource: string
  xp: number
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-3">
      <h3 className="text-xs font-semibold text-slate-800">{title || type}</h3>
      <dl className="mt-2 grid gap-2 text-[10px] text-slate-500 sm:grid-cols-3">
        <div><dt className="font-medium text-slate-600">Jenis konten</dt><dd>{type}</dd></div>
        <div><dt className="font-medium text-slate-600">Detail</dt><dd>{detail}</dd></div>
        <div><dt className="font-medium text-slate-600">XP reward</dt><dd>{xp} XP</dd></div>
      </dl>
      <p className="mt-2 truncate text-[9px] text-slate-400">{resource}</p>
    </article>
  )
}

function CurriculumClassCard({
  curriculumClass,
  expanded,
  activeTab,
  allowXp,
  onToggle,
  onAddModule,
  onTabChange,
  onEditModule,
  onDeleteModule,
  onToggleModule,
  onAddItem,
  onViewMaterial,
  onEditItem,
  onDeleteItem,
}: {
  curriculumClass: CurriculumClass
  expanded: boolean
  activeTab: CurriculumTab
  allowXp: boolean
  onToggle: () => void
  onAddModule: () => void
  onTabChange: (tab: CurriculumTab) => void
  onEditModule: (module: CurriculumModule) => void
  onDeleteModule: (module: CurriculumModule) => void
  onToggleModule: (moduleId: number) => void
  onAddItem: (moduleId: number) => void
  onViewMaterial: (item: CurriculumItem) => void
  onEditItem: (moduleId: number, item: CurriculumItem) => void
  onDeleteItem: (moduleId: number, item: CurriculumItem) => void
}) {
  const allItems = curriculumClass.modules.flatMap((module) =>
    module.items.map((item) => ({ ...item, moduleTitle: module.title, moduleId: module.id })),
  )
  const sessionItems = curriculumClass.sessions.map((session) => ({
    ...session,
    moduleTitle: curriculumClass.modules[0]?.title ?? curriculumClass.title,
    moduleId: curriculumClass.modules[0]?.id ?? 0,
  }))
  const sessionCount = sessionItems.length
  const materials = allItems.filter(isAttachedMaterial)
  const materialCount = materials.length
  const xpTotal = allItems.reduce((sum, item) => sum + item.xpPoints, 0)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Tutup' : 'Buka'} kurikulum ${curriculumClass.title}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {expanded ? <ChevronDown className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{curriculumClass.title}</h2>
            <span className={`rounded px-2 py-1 text-[9px] font-semibold ${curriculumClass.audience === 'Siswa' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>
              {curriculumClass.audience}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" aria-hidden />{curriculumClass.modules.length} modul</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{sessionCount} sesi</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{curriculumClass.students} siswa</span>
            {allowXp && <span className="font-medium text-amber-700">{xpTotal} XP</span>}
          </div>
        </div>
        <button type="button" onClick={onAddModule} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[10px] font-semibold text-brand-700 hover:bg-brand-100">
          <Plus className="h-3.5 w-3.5" aria-hidden />Tambah modul
        </button>
      </header>

      {expanded && (
        <div className="border-t border-slate-100">
          <nav aria-label={`Konten ${curriculumClass.title}`} className="flex flex-wrap gap-1 border-b border-slate-100 px-4 sm:px-5">
            {TAB_ITEMS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onTabChange(value)}
                aria-current={activeTab === value ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-3 text-[10px] font-medium ${
                  activeTab === value ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
                {value === 'modul' && <span>({curriculumClass.modules.length})</span>}
                {value === 'sesi' && <span>({sessionCount})</span>}
                {value === 'materi' && <span>({materialCount})</span>}
                {value === 'diskusi' && <span>({curriculumClass.discussions.length})</span>}
              </button>
            ))}
          </nav>

          <div className="space-y-3 p-3 sm:p-4">
            {activeTab === 'modul' && (
              <>
                {curriculumClass.modules.length === 0 ? (
                  <CurriculumEmpty text="Belum ada modul. Gunakan tombol Tambah modul pada kurikulum untuk membuat modul pertama." />
                ) : curriculumClass.modules.map((module) => (
                    <article key={module.id} className="overflow-hidden rounded-lg border border-slate-200">
                      <header className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-2.5">
                        <button type="button" onClick={() => onToggleModule(module.id)} aria-expanded={module.expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          {module.expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-brand-600" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />}
                          <span className="truncate text-xs font-semibold text-slate-800">{module.title}</span>
                          <span className="shrink-0 text-[9px] text-slate-400">{module.items.length} item</span>
                        </button>
                        {allowXp && <span className="text-[9px] font-medium text-amber-700">{module.items.reduce((sum, item) => sum + item.xpPoints, 0)} XP</span>}
                        <button type="button" onClick={() => onAddItem(module.id)} className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1.5 text-[9px] font-semibold text-brand-700 hover:bg-brand-100">
                          <Plus className="h-3 w-3" aria-hidden />Item
                        </button>
                        {module.items.length > 0 && (
                          <span className="rounded-md bg-emerald-50 px-2 py-1.5 text-[9px] font-medium text-emerald-700">Sudah dipublish</span>
                        )}
                        <button type="button" onClick={() => onEditModule(module)} aria-label={`Edit modul ${module.title}`} title="Edit modul" className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-slate-700">
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button type="button" onClick={() => onDeleteModule(module)} aria-label={`Hapus modul ${module.title}`} title="Hapus modul" className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </header>
                      {module.expanded && (
                        <div className="divide-y divide-slate-100">
                          {module.items.length === 0 ? (
                            <p className="px-4 py-4 text-[10px] text-slate-400">Belum ada item pada modul ini. Klik “Item” untuk menambahkan konten.</p>
                          ) : module.items.map((item) => (
                            <CurriculumItemRow
                              key={item.id}
                              item={item}
                              allowXp={allowXp}
                              onView={isAttachedMaterial(item) ? () => onViewMaterial(item) : undefined}
                              onEdit={() => onEditItem(module.id, item)}
                              onDelete={() => onDeleteItem(module.id, item)}
                            />
                          ))}
                        </div>
                      )}
                    </article>
                ))}
              </>
            )}

            {activeTab === 'sesi' && (
              <AggregateItems items={sessionItems} emptyText="Belum ada sesi bimbingan. Tambahkan sesi melalui tombol Item pada modul." allowXp={false} />
            )}
            {activeTab === 'materi' && (
              <AggregateItems
                items={materials}
                emptyText="Belum ada materi pada kurikulum ini."
                allowXp={allowXp}
                onView={onViewMaterial}
              />
            )}
            {activeTab === 'diskusi' && (
              <CurriculumDiscussionPreview
                discussions={curriculumClass.discussions}
                courseId={curriculumClass.id}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function isAttachedMaterial(item: CurriculumItem): boolean {
  return item.type === 'materi'
}

function CurriculumDiscussionPreview({
  discussions,
  courseId,
}: {
  discussions: CurriculumDiscussion[]
  courseId: number
}) {
  const previewDiscussions = discussions.slice(0, 3)
  return (
    <div className="space-y-2">
      {previewDiscussions.length === 0 ? (
        <CurriculumEmpty text="Belum ada diskusi pada kurikulum ini." />
      ) : previewDiscussions.map((discussion) => (
        <article key={discussion.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700">
            {discussion.author.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold text-slate-800">{discussion.title}</h3>
            <p className="mt-1 text-[10px] text-slate-500">{discussion.author} · {discussion.role} · {discussion.date}</p>
            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-600">{discussion.message}</p>
            <p className="mt-2 text-[9px] text-slate-400">{discussion.replyCount} balasan · {discussion.likes} suka</p>
          </div>
        </article>
      ))}
      <div className="flex justify-end pt-1">
        <Link
          to={`/mentor/curriculum/discussions/${courseId}`}
          className="text-[10px] font-semibold text-brand-700 hover:underline"
        >
          Lihat semua diskusi <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  )
}

function CurriculumItemRow({
  item,
  allowXp,
  onView,
  onEdit,
  onDelete,
}: {
  item: CurriculumItem
  allowXp: boolean
  onView?: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const itemType = ITEM_TYPES.find((value) => value.type === item.type)
  const Icon = itemType?.icon ?? FileText
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ITEM_STYLES[item.type]}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
      <p className="truncate text-[10px] font-medium text-slate-800">{item.title}</p>
        <p className="mt-0.5 truncate text-[9px] text-slate-500">{item.detail}{item.date ? ` · ${item.date}` : ''}</p>
        {item.description && <p className="mt-0.5 line-clamp-1 text-[9px] text-slate-400">{item.description}</p>}
      </div>
      {allowXp && item.xpPoints > 0 && <span className="text-[9px] font-medium text-amber-700">{item.xpPoints} XP</span>}
      <PublicationBadge status={item.status} />
      {onView && (
        <button type="button" onClick={onView} aria-label={`Lihat materi ${item.title}`} title="Lihat materi" className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold text-brand-700 hover:bg-brand-50">
          <Eye className="h-3.5 w-3.5" aria-hidden />Lihat
        </button>
      )}
      <button type="button" onClick={onEdit} aria-label={`Edit item ${item.title}`} title="Edit item" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Hapus item ${item.title}`} title="Hapus item" className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

function AggregateItems({
  items,
  emptyText,
  allowXp,
  onView,
}: {
  items: (CurriculumItem & { moduleTitle: string; moduleId: number })[]
  emptyText: string
  allowXp: boolean
  onView?: (item: CurriculumItem) => void
}) {
  if (items.length === 0) return <CurriculumEmpty text={emptyText} />
  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ITEM_STYLES[item.type]}`}>
            {item.type === 'sesi' ? <CalendarDays className="h-3.5 w-3.5" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium text-slate-800">{item.title}</p>
            <p className="mt-0.5 text-[9px] text-slate-500">{item.moduleTitle} · {item.detail}{item.date ? ` · ${item.date}` : ''}</p>
          </div>
          {allowXp && item.xpPoints > 0 && <span className="text-[9px] font-medium text-amber-700">{item.xpPoints} XP</span>}
          <PublicationBadge status={item.status} />
          {onView && (
            <button type="button" onClick={() => onView(item)} aria-label={`Lihat materi ${item.title}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold text-brand-700 hover:bg-brand-50">
              <Eye className="h-3.5 w-3.5" aria-hidden />Lihat materi
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function MaterialPreviewDialog({ item, onClose }: { item: CurriculumItem; onClose: () => void }) {
  const previewUrl = item.fileUrl || item.externalUrl || ''
  const isPdf = (item.materialFormat ?? '').toLowerCase().includes('pdf')

  return (
    <Modal
      open
      title="Lihat materi terlampir"
      description={item.title}
      onClose={onClose}
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{item.materialFormat ?? item.detail}{item.resource ? ` · ${item.resource}` : ''}</p>
        {previewUrl && isPdf ? (
          <iframe title={`Pratinjau ${item.title}`} src={previewUrl} className="h-[65vh] w-full rounded-lg border border-slate-200" />
        ) : previewUrl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            <FileText className="mx-auto h-8 w-8 text-brand-600" aria-hidden />
            <p className="mt-2 text-xs text-slate-600">Buka atau unduh file slide untuk melihat isinya.</p>
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Eye className="h-4 w-4" aria-hidden />Buka file
            </a>
          </div>
        ) : (
          <p role="status" className="rounded-lg bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            Materi ini belum memiliki berkas atau tautan untuk dibuka.
          </p>
        )}
      </div>
    </Modal>
  )
}

function PublicationBadge({ status }: { status: ItemPublicationStatus }) {
  const isDraft = status === 'draft'
  return (
    <span className={`rounded px-2 py-1 text-[9px] font-medium ${isDraft ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {isDraft ? 'Draft' : 'Terbit'}
    </span>
  )
}

function CurriculumEmpty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-[10px] text-slate-500">{text}</div>
}
