export type ModuleStatus = 'Aktif' | 'Draft'

export interface ManagedModule {
  id: number
  title: string
  status: ModuleStatus
  chapters: number
  studyHours: number
  sessions: number
  students: number
  expanded: boolean
}

export const INITIAL_MODULES: ManagedModule[] = [
  { id: 1, title: 'Fullstack Web Developer', status: 'Aktif', chapters: 5, studyHours: 4.5, sessions: 1, students: 4, expanded: false },
  { id: 2, title: 'Desain Grafis Remaja', status: 'Draft', chapters: 0, studyHours: 0, sessions: 0, students: 0, expanded: false },
  { id: 3, title: 'Cyber Security Fundamentals', status: 'Aktif', chapters: 3, studyHours: 6, sessions: 2, students: 8, expanded: false },
  { id: 4, title: 'React Native Fundamentals', status: 'Aktif', chapters: 8, studyHours: 8, sessions: 3, students: 12, expanded: false },
]

export function getModuleById(id: string | undefined): ManagedModule | undefined {
  if (!id) return undefined
  return INITIAL_MODULES.find((module) => String(module.id) === id)
}

export function isManagedModule(value: unknown): value is ManagedModule {
  if (!value || typeof value !== 'object') return false
  const module = value as Partial<ManagedModule>
  return (
    typeof module.id === 'number' &&
    typeof module.title === 'string' &&
    (module.status === 'Aktif' || module.status === 'Draft') &&
    typeof module.chapters === 'number' &&
    typeof module.studyHours === 'number' &&
    typeof module.sessions === 'number' &&
    typeof module.students === 'number' &&
    typeof module.expanded === 'boolean'
  )
}
