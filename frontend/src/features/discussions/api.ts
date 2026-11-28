import { api } from '../../lib/api'
import type { Paginated } from '../../types'

export interface DiscussionAuthor {
  id: number
  name: string
  role: string
  initials: string
}

export interface DiscussionReply {
  id: number
  discussion_id: number
  body: string
  author: DiscussionAuthor | null
  is_own: boolean
  can_update: boolean
  can_delete: boolean
  created_at: string | null
  updated_at: string | null
}

export interface Discussion {
  id: number
  course_id: number
  title: string
  body: string
  author: DiscussionAuthor | null
  views: number
  replies_count: number | null
  replies?: DiscussionReply[]
  is_own: boolean
  can_update: boolean
  can_delete: boolean
  created_at: string | null
  updated_at: string | null
}

/** Forum kursus: satu daftar topik per kursus, dengan balasan pada detailnya. */
export async function listDiscussions(courseId: number): Promise<Discussion[]> {
  const response = await api.get<Paginated<Discussion>>(`/courses/${courseId}/discussions`, {
    params: { per_page: 50 },
  })

  return response.data.data
}

export async function fetchDiscussion(id: number): Promise<Discussion> {
  return (await api.get<{ data: Discussion }>(`/discussions/${id}`)).data.data
}

export async function createDiscussion(
  courseId: number,
  input: { title: string; body: string },
): Promise<Discussion> {
  return (await api.post<{ data: Discussion }>(`/courses/${courseId}/discussions`, input)).data.data
}

export async function updateDiscussion(
  id: number,
  input: { title: string; body: string },
): Promise<Discussion> {
  return (await api.patch<{ data: Discussion }>(`/discussions/${id}`, input)).data.data
}

export async function deleteDiscussion(id: number): Promise<void> {
  await api.delete(`/discussions/${id}`)
}

export async function createReply(discussionId: number, body: string): Promise<DiscussionReply> {
  return (await api.post<{ data: DiscussionReply }>(`/discussions/${discussionId}/replies`, { body })).data.data
}

export async function updateReply(id: number, body: string): Promise<DiscussionReply> {
  return (await api.patch<{ data: DiscussionReply }>(`/discussion-replies/${id}`, { body })).data.data
}

export async function deleteReply(id: number): Promise<void> {
  await api.delete(`/discussion-replies/${id}`)
}
