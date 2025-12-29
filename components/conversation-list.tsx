'use client'

import { useEffect, useState } from 'react'
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

export function ConversationList({
  currentConversationId,
  onSelectConversation,
  onNewChat,
  refreshTrigger,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  // Refresh when refreshTrigger changes (when new conversation is created)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchConversations();
    }
  }, [refreshTrigger]);

  // Also refresh when currentConversationId changes to ensure list is up to date
  useEffect(() => {
    if (currentConversationId) {
      fetchConversations();
    }
  }, [currentConversationId])

  // Expose refresh function to parent if needed
  useEffect(() => {
    // Auto-refresh conversations every 30 seconds to catch new ones
    const interval = setInterval(() => {
      fetchConversations()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  async function fetchConversations() {
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
  }

  async function deleteConversation(conversationId: string, event: React.MouseEvent) {
    event.stopPropagation() // Prevent selecting the conversation

    if (!confirm('Are you sure you want to delete this conversation?')) {
      return
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setConversations(conversations.filter(c => c.id !== conversationId))

        // If deleting the current conversation, start a new chat
        if (conversationId === currentConversationId) {
          onNewChat()
        }
      } else {
        alert('Failed to delete conversation')
      }
    } catch (error) {
      alert('Failed to delete conversation')
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return format(date, 'HH:mm')
    } else if (diffInHours < 48) {
      return 'Yesterday'
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
          New Chat
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
        New Chat
      </Button>

      <div className="flex flex-col gap-1 mt-2">
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No conversations yet.
            <br />
            Start a new chat to begin.
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
                    {conversation.title || 'New Conversation'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDate(conversation.updatedAt)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {conversation._count.messages} messages
              </div>
            </div>
            <button
              onClick={(e) => deleteConversation(conversation.id, e)}
              className="mr-2 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
