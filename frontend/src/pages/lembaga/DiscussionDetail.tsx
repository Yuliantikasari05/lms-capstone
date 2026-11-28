import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/States'
import { CourseDiscussions } from '../../features/discussions/CourseDiscussions'
import { useApiData } from '../../lib/useApiData'
import { LembagaPageHeader } from './LembagaPageHeader'
import { ModuleDetailHeader } from './ModuleDetailHeader'
import type { ManagedModule } from './moduleData'
import { fetchProgram, updateProgram } from './api'

/** Halaman detail diskusi Lembaga; memakai forum kursus yang sama dengan tab Diskusi. */
export default function DiscussionDetail() {
  const navigate = useNavigate()
  const { moduleId, discussionId } = useParams()
  const courseId = Number(moduleId)
  const program = useApiData(() => fetchProgram(courseId), [courseId])
  const [reportOpen, setReportOpen] = useState(false)

  const module: ManagedModule | undefined = program.data
    ? {
        id: courseId,
        title: program.data.title,
        status: program.data.status === 'active' ? 'Aktif' : 'Draft',
        chapters: program.data.modules_count ?? 0,
        studyHours: Math.round(((program.data.duration_minutes ?? 0) / 60) * 10) / 10,
        sessions: program.data.sessions_count ?? 0,
        students: program.data.participants_count ?? 0,
        expanded: false,
      }
    : undefined

  return (
    <div className="space-y-6">
      <LembagaPageHeader onReportClick={() => setReportOpen(true)} />
      <ModuleDetailHeader
        activeTab="Discussions"
        onTabChange={(tab) => navigate(tab === 'Modules' ? '/lembaga/modules' : `/lembaga/modules/${courseId}/sessions`)}
        onAddModule={() => navigate('/lembaga/modules/new')}
        module={module}
        onRename={(title) => {
          void updateProgram(courseId, { title }).then(() => program.reload())
        }}
      />

      {program.loading && !program.data ? (
        <Spinner label="Memuat diskusi…" />
      ) : (
        <CourseDiscussions courseId={courseId} initialDiscussionId={Number(discussionId)} />
      )}

      <Modal
        open={reportOpen}
        title="Laporan Lembaga"
        description="Ringkasan laporan program lembaga Anda."
        onClose={() => setReportOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setReportOpen(false)}>
            Tutup
          </Button>
        }
      >
        <p className="text-sm leading-6 text-slate-600">
          Laporan pendapatan, enrollment, dan harga tiap program tersedia di halaman Jelajahi.
        </p>
      </Modal>
    </div>
  )
}
