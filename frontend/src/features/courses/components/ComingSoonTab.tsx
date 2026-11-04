import { EmptyState } from '../../../components/ui/States'

/** Tab yang sudah ada di desain tetapi fiturnya dikerjakan di tahap berikutnya. */
export function ComingSoonTab({ title, description }: { title: string; description: string }) {
  return <EmptyState title={title} description={description} />
}
