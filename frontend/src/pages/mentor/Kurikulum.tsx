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
  Upload,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Field, inputClass } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import {
  MENTOR_COURSES,
  courseAllowsXp,
  courseAudience,
  type CourseDiscussionPreview,
  type MentorCoursePreview,
} from './courseData'
import { getAssignments, subscribeAssignments } from './assignmentData'
import { SessionScheduleFields } from './SessionScheduleFields'
import {
  getMentorSessions,
  deleteMentorSession,
  saveMentorSession,
  sessionTypeForCourse,
  type MentorSession,
  type SessionScheduleDetails,
} from './sessionData'

type CurriculumItemType = 'materi' | 'tugas' | 'ujian' | 'sesi'
type ItemSelection = CurriculumItemType
type ItemWizardStep = 1 | 2 | 3
type CurriculumTab = 'modul' | 'sesi' | 'materi' | 'diskusi'
type ItemPublicationStatus = 'draft' | 'published'

interface CurriculumItem {
  id: string
  title: string
  description: string
  type: CurriculumItemType
  status: ItemPublicationStatus
  xpPoints: number
  detail: string
  assignmentId?: number
  materialFormat?: string
  durationMinutes?: number
  resource?: string
  attachment?: File
  sessionId?: string
  meetingLink?: string
  date?: string
  startTime?: string
  endTime?: string
  sessionType?: SessionScheduleDetails['type']
  mode?: SessionScheduleDetails['mode']
  location?: string
}

interface CurriculumModule {
  id: number
  title: string
  description: string
  items: CurriculumItem[]
  expanded: boolean
}

interface CurriculumClass {
  id: number
  sourceCourseId: number
  title: string
  description: string
  audience: 'Siswa' | 'Karyawan'
  students: number
  modules: CurriculumModule[]
  discussions: {
    id: string
    title: string
    author: string
    role: CourseDiscussionPreview['role']
    date: string
    message: string
    replyCount: number
    likes: number
  }[]
}

interface ModuleDialogState {
  classId: number
  moduleId?: number
}

interface ItemDialogState {
  classId: number
  moduleId: number
  itemId?: string
}

const INITIAL_COURSE_IDS = [1, 3, 4]
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

function createClass(course: MentorCoursePreview, id: number): CurriculumClass {
  const courseSessions = getMentorSessions().filter((session) => session.courseId === course.id)
  const modules = course.modules.map((module, index) => {
    const items: CurriculumItem[] = module.materials.map((material) => {
      const materialFormat = material.type === 'pdf' ? 'PDF' : material.type === 'document' ? 'PPTX' : 'Video'
      const extension = material.type === 'pdf' ? 'pdf' : material.type === 'document' ? 'pptx' : ''
      return {
        id: `material-${course.id}-${material.id}`,
        title: material.title,
        description: material.description,
        type: 'materi',
        status: 'published',
        xpPoints: material.xpPoints,
        detail: material.type === 'video'
          ? `Video · ${material.durationMinutes ?? 0} menit`
          : `${materialFormat} · ${material.durationMinutes ?? 0} menit`,
        materialFormat,
        ...(extension ? { resource: `${material.title}.${extension}` } : {}),
      }
    })
    for (const attachment of module.supportingMaterials ?? []) {
      items.push({
        id: `attachment-${course.id}-${attachment.id}`,
        title: attachment.name,
        description: `Materi pendukung modul ${module.title}.`,
        type: 'materi',
        status: 'published',
        xpPoints: 0,
        detail: `${attachment.format} · ${attachment.size}`,
        materialFormat: attachment.format,
        resource: attachment.name,
      })
    }
    for (const activity of module.activities ?? []) {
      items.push({
        id: `activity-${course.id}-${activity.id}`,
        title: activity.title,
        description: `Evaluasi pembelajaran pada modul ${module.title}.`,
        type: activity.type === 'tugas' ? 'tugas' : 'ujian',
        status: 'published',
        xpPoints: activity.xpPoints,
        detail: activity.type === 'tugas' ? 'Tugas' : 'Evaluasi',
      })
    }

    if (index === 0) {
      for (let session = 0; session < Math.max(course.sessions, courseSessions.length); session += 1) {
        const scheduledSession = courseSessions[session]
        items.push({
          id: scheduledSession?.id ?? `session-${course.id}-${session + 1}`,
          sessionId: scheduledSession?.id,
          title: scheduledSession?.title ?? `Sesi bimbingan ${session + 1}`,
          description: `Diskusi dan pendampingan peserta untuk ${module.title}.`,
          type: 'sesi',
          status: scheduledSession?.status === 'Draft' ? 'draft' : 'published',
          xpPoints: 0,
          detail: scheduledSession ? `${scheduledSession.startTime}–${scheduledSession.endTime} · ${scheduledSession.mode}` : 'Jadwal akan ditentukan',
          ...(scheduledSession ? {
            date: scheduledSession.date,
            startTime: scheduledSession.startTime,
            endTime: scheduledSession.endTime,
            sessionType: scheduledSession.type,
            mode: scheduledSession.mode,
            location: scheduledSession.location,
            meetingLink: scheduledSession.meetingLink,
          } : {}),
        })
      }
    }

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      items,
      expanded: index === 0,
    }
  })

  return {
    id,
    sourceCourseId: course.id,
    title: course.title,
    description: course.description,
    audience: courseAudience(course.type) === 'siswa' ? 'Siswa' : 'Karyawan',
    students: course.students,
    modules,
    discussions: course.discussions.map((discussion) => ({
      id: `discussion-${course.id}-${discussion.id}`,
      title: discussion.title,
      author: discussion.name,
      role: discussion.role,
      date: discussion.date,
      message: discussion.message,
      replyCount: discussion.replies.length,
      likes: discussion.likes ?? 0,
    })),
  }
}

const INITIAL_CLASSES = INITIAL_COURSE_IDS.flatMap((courseId, index) => {
  const course = MENTOR_COURSES.find((item) => item.id === courseId)
  return course ? [createClass(course, index + 1)] : []
})

export default function MentorKurikulum() {
  const { user } = useAuth()
  const [classes, setClasses] = useState(INITIAL_CLASSES)
  const [expandedClassId, setExpandedClassId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<CurriculumTab>('modul')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [moduleDialog, setModuleDialog] = useState<ModuleDialogState | null>(null)
  const [moduleTitle, setModuleTitle] = useState('')
  const [moduleDescription, setModuleDescription] = useState('')
  const [itemDialog, setItemDialog] = useState<ItemDialogState | null>(null)
  const [previewMaterial, setPreviewMaterial] = useState<CurriculumItem | null>(null)

  const filteredClasses = useMemo(() => classes.filter((item) =>
    `${item.title} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [classes, search])

  function openAddModule(classId: number) {
    setModuleDialog({ classId })
    setModuleTitle('')
    setModuleDescription('')
  }

  function openEditModule(classId: number, module: CurriculumModule) {
    setModuleDialog({ classId, moduleId: module.id })
    setModuleTitle(module.title)
    setModuleDescription(module.description)
  }

  function saveModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!moduleDialog || !moduleTitle.trim()) return
    const title = moduleTitle.trim()
    const description = moduleDescription.trim()

    setClasses((current) => current.map((item) => {
      if (item.id !== moduleDialog.classId) return item
      if (moduleDialog.moduleId !== undefined) {
        return {
          ...item,
          modules: item.modules.map((module) =>
            module.id === moduleDialog.moduleId ? { ...module, title, description } : module,
          ),
        }
      }
      return {
        ...item,
        modules: [...item.modules, {
          id: Date.now(),
          title,
          description,
          items: [],
          expanded: true,
        }],
      }
    }))
    setNotice(moduleDialog.moduleId ? `Modul "${title}" diperbarui.` : `Modul "${title}" ditambahkan.`)
    setExpandedClassId(moduleDialog.classId)
    setActiveTab('modul')
    setModuleDialog(null)
  }

  function removeModule(classId: number, module: CurriculumModule) {
    const removedModule = classes.find((item) => item.id === classId)?.modules.find((item) => item.id === module.id)
    removedModule?.items.forEach((item) => {
      if (item.type === 'sesi' && item.sessionId) deleteMentorSession(item.sessionId)
    })
    setClasses((current) => current.map((item) =>
      item.id === classId ? { ...item, modules: item.modules.filter((value) => value.id !== module.id) } : item,
    ))
    setNotice(`Modul "${module.title}" dihapus dari pratinjau.`)
  }

  function openItemDialog(classId: number, moduleId: number, item?: CurriculumItem) {
    setItemDialog({ classId, moduleId, itemId: item?.id })
  }

  function saveItems(dialog: ItemDialogState, addedItems: CurriculumItem[]) {
    const curriculumClass = classes.find((item) => item.id === dialog.classId)
    const sourceCourse = MENTOR_COURSES.find((course) => course.id === curriculumClass?.sourceCourseId)
    const oldItem = curriculumClass?.modules.find((module) => module.id === dialog.moduleId)?.items.find((item) => item.id === dialog.itemId)
    if (oldItem?.type === 'sesi' && oldItem.sessionId && !addedItems.some((item) => item.type === 'sesi')) {
      deleteMentorSession(oldItem.sessionId)
    }
    if (sourceCourse && curriculumClass) {
      addedItems.filter((item) => item.type === 'sesi').forEach((item) => {
        const existingSession = getMentorSessions().find((session) => session.id === item.sessionId)
        const session: MentorSession = {
          id: item.sessionId ?? item.id,
          courseId: sourceCourse.id,
          moduleId: dialog.moduleId,
          title: item.title,
          description: item.description,
          date: item.date ?? '',
          startTime: item.startTime ?? '13:00',
          endTime: item.endTime ?? '14:00',
          type: item.sessionType ?? sessionTypeForCourse(sourceCourse) ?? 'Kelas reguler',
          mode: item.mode ?? 'Online',
          location: item.location ?? '',
          meetingLink: item.meetingLink ?? '',
          status: item.status === 'draft' ? 'Draft' : 'Terjadwal',
          participants: existingSession?.participants ?? curriculumClass.students,
          mentorName: existingSession?.mentorName ?? user?.name ?? 'Mentor',
        }
        saveMentorSession(session)
      })
    }
    setClasses((current) => current.map((value) => value.id !== dialog.classId
      ? value
      : {
          ...value,
          modules: value.modules.map((module) => {
            if (module.id !== dialog.moduleId) return module
            const items = dialog.itemId
              ? module.items.flatMap((existing) => existing.id === dialog.itemId ? addedItems : [existing])
              : [...module.items, ...addedItems]
            return { ...module, items }
          }),
        }))
    const updatedItems = dialog.itemId ? 'Item diperbarui' : `${addedItems.length} item ditambahkan`
    setNotice(`${updatedItems} pada pratinjau.`)
    setExpandedClassId(dialog.classId)
    setActiveTab(addedItems.some((item) => item.type === 'materi') ? 'materi' : addedItems.some((item) => item.type === 'sesi') ? 'sesi' : 'modul')
    setItemDialog(null)
  }

  function removeItem(classId: number, moduleId: number, item: CurriculumItem) {
    if (item.type === 'sesi' && item.sessionId) deleteMentorSession(item.sessionId)
    setClasses((current) => current.map((value) => value.id !== classId
      ? value
      : {
          ...value,
          modules: value.modules.map((module) => module.id === moduleId
            ? { ...module, items: module.items.filter((existing) => existing.id !== item.id) }
            : module),
        }))
    setNotice(`Item "${item.title}" dihapus dari pratinjau.`)
  }

  function publishModule(classId: number, moduleId: number) {
    const module = classes.find((item) => item.id === classId)?.modules.find((item) => item.id === moduleId)
    const publishedCount = module?.items.filter((item) => item.status === 'draft').length ?? 0
    if (publishedCount === 0) return
    module?.items.filter((item) => item.type === 'sesi' && item.status === 'draft' && item.sessionId).forEach((item) => {
      const session = getMentorSessions().find((value) => value.id === item.sessionId)
      if (session) saveMentorSession({ ...session, status: 'Terjadwal' })
    })
    setClasses((current) => current.map((item) => item.id !== classId
      ? item
      : {
          ...item,
          modules: item.modules.map((module) => {
            if (module.id !== moduleId) return module
            return {
              ...module,
              items: module.items.map((content) => ({ ...content, status: 'published' })),
            }
          }),
        }))
    setNotice(`${publishedCount} item berhasil dipublish pada pratinjau.`)
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

      {filteredClasses.length === 0 ? (
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
              allowXp={item.audience === 'Siswa' && courseAllowsXp(MENTOR_COURSES.find((course) => course.id === item.sourceCourseId) ?? MENTOR_COURSES[0])}
              onToggle={() => {
                setExpandedClassId((current) => current === item.id ? null : item.id)
                setActiveTab('modul')
              }}
              onAddModule={() => openAddModule(item.id)}
              onTabChange={setActiveTab}
              onEditModule={(module) => openEditModule(item.id, module)}
              onDeleteModule={(module) => removeModule(item.id, module)}
              onToggleModule={(moduleId) => toggleModule(item.id, moduleId)}
              onAddItem={(moduleId) => openItemDialog(item.id, moduleId)}
              onPublishModule={(moduleId) => publishModule(item.id, moduleId)}
              onViewMaterial={setPreviewMaterial}
              onEditItem={(moduleId, curriculumItem) => openItemDialog(item.id, moduleId, curriculumItem)}
              onDeleteItem={(moduleId, curriculumItem) => removeItem(item.id, moduleId, curriculumItem)}
            />
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-slate-400">Pratinjau statis · perubahan belum dikirim atau disimpan ke server.</p>

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
  onSave: (items: CurriculumItem[]) => void
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
  const assignments = useSyncExternalStore(subscribeAssignments, getAssignments)
  const initialAssignment = existingItem?.assignmentId
    ? assignments.find((assignment) => assignment.id === existingItem.assignmentId)
    : assignments.find((assignment) =>
        assignment.courseId === curriculum.sourceCourseId
        && assignment.active
        && assignment.approval === 'Tersedia'
        && (initialSelection === 'tugas' ? assignment.kind !== 'Ujian' : assignment.kind === 'Ujian'),
      )
  const initialDetailParts = existingItem?.detail.split(' · ') ?? []
  const durationLabel = initialDetailParts.find((part) => part.endsWith('menit'))
  const parsedDuration = durationLabel ? Number(durationLabel.replace(' menit', '')) : 15
  const initialDuration = existingItem?.durationMinutes
    ?? (Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 15)
  const sourceCourse = MENTOR_COURSES.find((course) => course.id === curriculum.sourceCourseId) ?? MENTOR_COURSES[0]
  const canAwardXp = curriculum.audience === 'Siswa' && courseAllowsXp(sourceCourse)
  const canCreateSession = sessionTypeForCourse(sourceCourse) !== null

  const [step, setStep] = useState<ItemWizardStep>(1)
  const [selection, setSelection] = useState<ItemSelection>(initialSelection)
  const [title, setTitle] = useState(existingItem?.title ?? '')
  const [description, setDescription] = useState(existingItem?.description ?? '')
  const [materialFormat, setMaterialFormat] = useState(existingItem?.materialFormat ?? initialDetailParts[0] ?? 'PDF')
  const [duration, setDuration] = useState(initialDuration)
  const [fileName, setFileName] = useState(existingItem?.resource && !existingItem.resource.startsWith('http') ? existingItem.resource : '')
  const [attachment, setAttachment] = useState(existingItem?.attachment)
  const [resourceUrl, setResourceUrl] = useState(existingItem?.resource?.startsWith('http') ? existingItem.resource : '')
  const [assignmentId, setAssignmentId] = useState(String(initialAssignment?.id ?? ''))
  const [sessionDetails, setSessionDetails] = useState<SessionScheduleDetails>({
    date: existingItem?.date?.slice(0, 10) ?? '',
    startTime: existingItem?.startTime ?? '13:00',
    endTime: existingItem?.endTime ?? '14:00',
    type: existingItem?.sessionType ?? sessionTypeForCourse(sourceCourse) ?? 'Kelas reguler',
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
    assignment.courseId === curriculum.sourceCourseId
    && assignment.active
    && assignment.approval === 'Tersedia'
    && selectedAssignmentKinds.includes(assignment.kind),
  )
  const selectedAssignment = availableAssignments.find((assignment) => String(assignment.id) === assignmentId)

  function submitStep(event: FormEvent<HTMLFormElement>) {
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
    const publicationStatus: ItemPublicationStatus = 'draft'

    if (includesMaterial) {
      const resource = fileName || resourceUrl.trim()
      addedItems.push({
        id: existingItem?.type === 'materi' ? existingItem.id : `item-${now}-material`,
        title: title.trim(),
        description: description.trim(),
        type: 'materi',
        status: publicationStatus,
        xpPoints: effectiveMaterialXp,
        detail: `${materialFormat} · ${duration} menit`,
        materialFormat,
        durationMinutes: duration,
        ...(resource ? { resource } : {}),
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
        status: publicationStatus,
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
        status: publicationStatus,
        xpPoints: effectiveAssessmentXp,
        detail: `${sessionDetails.startTime}–${sessionDetails.endTime} · ${sessionDetails.mode}`,
        sessionId: existingItem?.sessionId ?? `session-${now}`,
        date: sessionDetails.date,
        startTime: sessionDetails.startTime,
        endTime: sessionDetails.endTime,
        sessionType: sessionDetails.type,
        mode: sessionDetails.mode,
        location: sessionDetails.location.trim(),
        meetingLink: sessionDetails.meetingLink.trim(),
      })
    }

    const itemsToSave = addedItems.map((item, index) => ({
      ...item,
      id: existingItem && index === 0
        ? existingItem.id
        : existingItem && item.id === existingItem.id
          ? `item-${now}-${index}`
          : item.id,
    }))
    onSave(itemsToSave)
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
                    {materialFormat === 'Video' && <option value="Video">Video (materi lama)</option>}
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
  onPublishModule,
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
  onPublishModule: (moduleId: number) => void
  onViewMaterial: (item: CurriculumItem) => void
  onEditItem: (moduleId: number, item: CurriculumItem) => void
  onDeleteItem: (moduleId: number, item: CurriculumItem) => void
}) {
  const allItems = curriculumClass.modules.flatMap((module) =>
    module.items.map((item) => ({ ...item, moduleTitle: module.title, moduleId: module.id })),
  )
  const sessionCount = allItems.filter((item) => item.type === 'sesi').length
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
                ) : curriculumClass.modules.map((module) => {
                  const draftCount = module.items.filter((item) => item.status === 'draft').length
                  return (
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
                        {draftCount > 0 ? (
                          <button type="button" onClick={() => onPublishModule(module.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[9px] font-semibold text-white hover:bg-emerald-700">
                            <Upload className="h-3 w-3" aria-hidden />Publish {draftCount} item
                          </button>
                        ) : module.items.length > 0 ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-1.5 text-[9px] font-medium text-emerald-700">Sudah dipublish</span>
                        ) : null}
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
                  )
                })}
              </>
            )}

            {activeTab === 'sesi' && (
              <AggregateItems items={allItems.filter((item) => item.type === 'sesi')} emptyText="Belum ada sesi bimbingan. Tambahkan sesi melalui tombol Item pada modul." allowXp={false} />
            )}
            {activeTab === 'materi' && (
              <AggregateItems
                items={materials}
                emptyText="Belum ada lampiran PDF atau PPT pada kurikulum ini."
                allowXp={allowXp}
                onView={onViewMaterial}
              />
            )}
            {activeTab === 'diskusi' && (
              <CurriculumDiscussionPreview
                discussions={curriculumClass.discussions}
                courseId={curriculumClass.sourceCourseId}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function isAttachedMaterial(item: CurriculumItem): boolean {
  const format = (item.materialFormat ?? item.detail.split(' · ')[0] ?? '').toUpperCase()
  return item.type === 'materi'
    && (['PDF', 'PPT', 'PPTX'].includes(format) || /\.(pdf|pptx?)$/i.test(item.resource ?? ''))
}

function CurriculumDiscussionPreview({
  discussions,
  courseId,
}: {
  discussions: CurriculumClass['discussions']
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
  const [fileUrl, setFileUrl] = useState('')
  const externalUrl = item.resource?.startsWith('http') ? item.resource : ''
  const isPdf = (item.materialFormat ?? item.resource ?? '').toLowerCase().includes('pdf')

  useEffect(() => {
    if (!item.attachment) return
    const url = URL.createObjectURL(item.attachment)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [item.attachment])

  const previewUrl = fileUrl || externalUrl

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
        <p className="text-xs text-slate-500">{item.materialFormat ?? item.detail} · {item.resource}</p>
        {previewUrl && isPdf ? (
          <iframe title={`Pratinjau ${item.title}`} src={previewUrl} className="h-[65vh] w-full rounded-lg border border-slate-200" />
        ) : previewUrl ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            <FileText className="mx-auto h-8 w-8 text-brand-600" aria-hidden />
            <p className="mt-2 text-xs text-slate-600">Buka atau unduh file slide untuk melihat isinya.</p>
            <a
              href={previewUrl}
              target={externalUrl ? '_blank' : undefined}
              rel={externalUrl ? 'noreferrer' : undefined}
              download={!externalUrl ? item.resource : undefined}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Eye className="h-4 w-4" aria-hidden />Buka file
            </a>
          </div>
        ) : (
          <p role="status" className="rounded-lg bg-amber-50 p-4 text-xs leading-5 text-amber-800">
            File contoh belum tersedia untuk dibuka. Lampirkan file PDF atau PPT saat mengedit materi untuk mengaktifkan pratinjau.
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
