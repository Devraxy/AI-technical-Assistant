'use client'

import { useEffect, useState, useCallback, memo } from 'react'
import { Button } from '@/components/ui/button'
import { PlusIcon, MessageSquare, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'

interface Conversation {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  _count: {
    messages: number
  }
}

interface ConversationListProps {
  currentConversationId: string | null
  onSelectConversation: (conversationId: string) => void
  onNewChat: () => void
  refreshTrigger?: number // Add refresh trigger prop
}

function ConversationListComponent({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  refreshTrigger,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // Memoize fetchConversations to avoid recreating on every render
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations')
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations)
      }
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Refresh when refreshTrigger changes (when new conversation is created or deleted)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchConversations();
    }
  }, [refreshTrigger, fetchConversations]);

  // REMOVED: No need to refetch when currentConversationId changes
  // The list doesn't need to update just because user selected a different conversation

  // Auto-refresh conversations every 30 seconds to catch new ones
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchConversations])


  async function deleteConversation(conversationId: string, event: React.MouseEvent) {
    event.stopPropagation() // Prevent selecting the conversation

    if (!confirm('Êtes-vous sûr de vouloir supprimer cette conversation ?')) {
      return
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Optimistically update UI
        setConversations(conversations.filter(c => c.id !== conversationId))

        // If deleting the current conversation, start a new chat
        if (conversationId === currentConversationId) {
          onNewChat()
        }
        
        // Refresh from server to ensure consistency (but don't show loading)
        fetchConversations()
      } else {
        alert('Échec de la suppression de la conversation')
      }
    } catch (error) {
      alert('Échec de la suppression de la conversation')
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return format(date, 'HH:mm')
    } else if (diffInHours < 48) {
      return 'Hier'
    } else if (diffInHours < 168) { // 7 days
      return format(date, 'EEE') // Mon, Tue, etc.
    } else {
      return format(date, 'MMM d') // Jan 15
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5 p-2">
        <Button
          className="flex items-center justify-start gap-1 rounded-lg px-2.5 py-2"
          variant="ghost"
          onClick={onNewChat}
        >
          <PlusIcon className="h-4 w-4" />
          Nouvelle conversation
        </Button>
        <div className="flex flex-col gap-2 mt-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-2">
      <Button
        className="flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start hover:bg-muted"
        variant="ghost"
        onClick={onNewChat}
      >
        <PlusIcon className="h-4 w-4" />
        Nouvelle conversation
      </Button>

      <div className="flex flex-col gap-1 mt-2">
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            Aucune conversation pour le moment.
            <br />
            Commencez une nouvelle conversation pour démarrer.
          </div>
        )}

        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`flex items-center gap-2 rounded-lg transition-all hover:bg-muted cursor-pointer group ${
              currentConversationId === conversation.id ? 'bg-muted' : ''
            }`}
            onClick={() => onSelectConversation(conversation.id)}
          >
            <div className="flex-grow px-3 py-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate font-medium">
                    {conversation.title || 'Nouvelle conversation'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(conversation.updatedAt)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {conversation._count.messages} message{conversation._count.messages > 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={(e) => deleteConversation(conversation.id, e)}
              className="mr-2 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Supprimer la conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render when props actually change
export const ConversationList = memo(ConversationListComponent, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render), false if different (re-render)
  return (
    prevProps.currentConversationId === nextProps.currentConversationId &&
    prevProps.refreshTrigger === nextProps.refreshTrigger &&
    prevProps.onSelectConversation === nextProps.onSelectConversation &&
    prevProps.onNewChat === nextProps.onNewChat
  )
})
