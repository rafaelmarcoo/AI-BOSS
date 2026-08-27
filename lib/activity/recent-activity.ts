import { listUserConversations } from '@/lib/chat/persistence'
import { listUserDocuments } from '@/lib/documents/persistence'
import { listSavedScenarios } from '@/lib/scenarios/persistence'

export type RecentActivityKind = 'document' | 'conversation' | 'scenario'

export interface RecentActivityItem {
  id: string
  kind: RecentActivityKind
  title: string
  description: string
  timestamp: string
  href: string
}

function documentTitle(document: Awaited<ReturnType<typeof listUserDocuments>>[number]) {
  if (document.status === 'failed') return 'Document processing failed'
  if (document.status === 'processing' || document.status === 'uploaded') {
    return 'Document processing started'
  }
  if (document.financial_review_status === 'confirmed') {
    return 'Document values User-confirmed'
  }
  if (document.financial_review_status === 'pending') {
    return 'Document review required'
  }
  return 'Document ready'
}

export async function listRecentActivity(
  userId: string,
  limit = 6
): Promise<RecentActivityItem[]> {
  const [documents, conversations, scenarios] = await Promise.all([
    listUserDocuments(userId),
    listUserConversations(userId),
    listSavedScenarios(userId),
  ])

  return [
    ...documents.map((document): RecentActivityItem => ({
      id: `document:${document.id}`,
      kind: 'document',
      title: documentTitle(document),
      description: document.file_name,
      timestamp: document.updated_at,
      href: `/dashboard/documents/${encodeURIComponent(document.id)}`,
    })),
    ...conversations.map((conversation): RecentActivityItem => ({
      id: `conversation:${conversation.id}`,
      kind: 'conversation',
      title: 'Conversation updated',
      description: conversation.title?.trim() || 'Untitled conversation',
      timestamp: conversation.updated_at,
      href: `/dashboard?conversationId=${encodeURIComponent(conversation.id)}`,
    })),
    ...scenarios.map((scenario): RecentActivityItem => ({
      id: `scenario:${scenario.id}`,
      kind: 'scenario',
      title: scenario.status === 'calculated' ? 'Scenario calculated' : 'Scenario draft updated',
      description: scenario.name,
      timestamp: scenario.updated_at,
      href: '/dashboard/scenarios',
    })),
  ]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, Math.max(0, limit))
}
