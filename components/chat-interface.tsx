'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUpIcon, Loader2, Square, ImageIcon, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  images?: string[] // Base64 image data URLs
}

interface ChatInterfaceProps {
  conversationId: string | null
  onConversationCreated?: (conversationId: string) => void
}

export function ChatInterface({ conversationId, onConversationCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([]) // Base64 data URLs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId)
    } else {
      setMessages([])
    }
  }, [conversationId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Convert file to base64 data URL
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Handle image file selection
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      alert('Please select image files only')
      return
    }

    try {
      const base64Images = await Promise.all(imageFiles.map(fileToBase64))
      setSelectedImages(prev => [...prev, ...base64Images])
    } catch (error) {
      console.error('Error converting images:', error)
      alert('Failed to process images')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove an image from selection
  function removeImage(index: number) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  async function loadConversation(id: string) {
    setLoadingMessages(true)
    try {
      const response = await fetch(`/api/conversations/${id}/messages`)
      if (response.ok) {
        const data = await response.json()
        // Transform messages to include images if they exist in content
        const transformedMessages = (data.messages || []).map((msg: any) => {
          let images: string[] = []
          let textContent = ''
          
          // Check if content is an array (multimodal format)
          if (Array.isArray(msg.content)) {
            // Extract images
            const imageParts = msg.content.filter((part: any) => 
              (part.type === 'image_url' && part.image_url?.url) ||
              (part.type === 'image' && (part.image || part.url))
            )
            images = imageParts.map((part: any) => 
              part.image_url?.url || part.image || part.url
            )
            
            // Extract text
            const textPart = msg.content.find((p: any) => p.type === 'text')
            textContent = textPart?.text || ''
          } else if (typeof msg.content === 'string') {
            textContent = msg.content
          }
          
          return {
            ...msg,
            content: textContent,
            images: images.length > 0 ? images : undefined
          }
        })
        setMessages(transformedMessages)
      } else if (response.status === 404) {
        // Conversation not found - clear it and start fresh
        setMessages([])
        if (onConversationCreated) {
          // This will trigger the parent to clear the conversationId
          localStorage.removeItem('currentConversationId')
          window.location.reload()
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to load conversation')
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading conversation:', error)
      }
    } finally {
      setLoadingMessages(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return

    const userMessage = input.trim()
    const imagesToSend = [...selectedImages]
    setInput('')
    setSelectedImages([])
    setIsLoading(true)

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage || (imagesToSend.length > 0 ? '[Image]' : ''),
      createdAt: new Date().toISOString(),
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      // Build conversation history (all messages except the temp one we just added)
      // Exclude temporary messages that start with 'temp-'
      const historyMessages = messages
        .filter(msg => !msg.id.startsWith('temp-'))
        .map(msg => {
          // Transform existing messages to API format
          if (msg.role === 'assistant') {
            // Assistant messages: simple string content
            return {
              role: 'assistant',
              content: msg.content,
            }
          } else {
            // User messages: may have images
            const parts: any[] = []
            
            // Add text part if there's text
            if (msg.content && msg.content.trim() && msg.content !== '[Image]') {
              parts.push({
                type: 'text',
                text: msg.content,
              })
            }
            
            // Add image parts if they exist
            if (msg.images && msg.images.length > 0) {
              for (const imageData of msg.images) {
                parts.push({
                  type: 'image',
                  image: imageData, // Base64 data URL
                })
              }
            }
            
            // Ensure at least one text part
            if (parts.length === 0 || parts.every(p => p.type === 'image')) {
              parts.unshift({
                type: 'text',
                text: msg.content || '',
              })
            }
            
            return {
              role: 'user',
              parts: parts,
            }
          }
        })

      // Build new message in parts format for multimodal support
      const parts: any[] = []
      
      // Add text part if there's text
      if (userMessage.trim()) {
        parts.push({
          type: 'text',
          text: userMessage,
        })
      }
      
      // Add image parts
      for (const imageData of imagesToSend) {
        parts.push({
          type: 'image',
          image: imageData, // Base64 data URL
        })
      }

      // If no text and only images, add empty text part (API requires at least one text part)
      if (parts.length === 0 || parts.every(p => p.type === 'image')) {
        parts.unshift({
          type: 'text',
          text: userMessage || '',
        })
      }

      // Combine history with new message
      const allMessages = [
        ...historyMessages,
        {
          role: 'user',
          parts: parts,
        }
      ]

      // Debug: Log what we're sending (ALWAYS show - remove condition)
      console.log('🔍 [Frontend DEBUG] Sending message with parts:', {
        historyCount: historyMessages.length,
        partsCount: parts.length,
        imageCount: parts.filter(p => p.type === 'image').length,
        textCount: parts.filter(p => p.type === 'text').length,
        imageLengths: parts.filter(p => p.type === 'image').map(p => p.image?.length || 0),
        imagePreviews: parts.filter(p => p.type === 'image').map(p => p.image?.substring(0, 50) || 'none'),
        fullParts: parts, // Show full parts array
      });
      
      console.log('🔍 [Frontend DEBUG] Full request body:', JSON.stringify({
        messages: allMessages,
        conversationId: conversationId,
      }, null, 2));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          conversationId: conversationId,
        }),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          // If we can't parse the error response, use a default message
          errorData = { error: 'Unknown error occurred' }
        }
        
        if (response.status === 404 && errorData.error === 'Conversation not found') {
          // Conversation was deleted or doesn't exist, clear it and reload
          localStorage.removeItem('currentConversationId')
          alert('This conversation no longer exists. Starting a new chat.')
          window.location.reload()
          return
        }
        
        // For other errors, throw with a descriptive message
        const errorMessage = errorData.error || errorData.message || 'Failed to send message'
        throw new Error(errorMessage)
      }

      // Get conversation ID from response headers
      const newConversationId = response.headers.get('X-Conversation-Id')
      if (newConversationId && !conversationId && onConversationCreated) {
        onConversationCreated(newConversationId)
      }

      // Read the streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let streamingError = false

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('0:')) {
                try {
                  const jsonStr = line.substring(2)
                  const data = JSON.parse(jsonStr)

                  if (data.type === 'text-delta' && data.textDelta) {
                    assistantMessage += data.textDelta

                    // Update assistant message in real-time
                    setMessages(prev => {
                      const newMessages = [...prev]
                      const lastMessage = newMessages[newMessages.length - 1]

                      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('temp-assistant')) {
                        lastMessage.content = assistantMessage
                      } else {
                        newMessages.push({
                          id: `temp-assistant-${Date.now()}`,
                          role: 'assistant',
                          content: assistantMessage,
                          createdAt: new Date().toISOString(),
                        })
                      }
                      return newMessages
                    })
                  }
                } catch (e) {
                  // Ignore parsing errors for individual chunks
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Error parsing stream chunk:', e)
                  }
                }
              }
            }
          }
        } catch (streamError) {
          streamingError = true
          if (process.env.NODE_ENV === 'development') {
            console.error('Error reading stream:', streamError)
          }
          // Clean up any partial assistant message
          setMessages(prev => prev.filter(m => 
            !(m.id.startsWith('temp-assistant') && m.role === 'assistant')
          ))
          throw new Error('Failed to read response stream')
        } finally {
          // Release the reader
          try {
            reader.releaseLock()
          } catch (e) {
            // Ignore if already released
          }
        }
      }

      // Only reload conversation if streaming completed successfully
      if (!streamingError) {
        // Reload conversation to get actual IDs from database
        if (newConversationId) {
          await loadConversation(newConversationId)
        } else if (conversationId) {
          await loadConversation(conversationId)
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error sending message:', error)
      }
      // Clean up all temporary messages (both user and assistant)
      setMessages(prev => prev.filter(m => 
        m.id !== tempUserMessage.id && 
        !(m.id.startsWith('temp-assistant') && m.role === 'assistant')
      ))
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to send message. Please try again.'
      alert(errorMessage)
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  if (loadingMessages) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="aui-root aui-thread-root flex h-full flex-col bg-background"
      style={{
        ['--thread-max-width' as string]: '44rem',
      }}
    >
      {/* Viewport matching Thread */}
      <div className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
        {/* Welcome screen when empty */}
        {messages.length === 0 && (
          <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
            <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
              <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8">
                <div className="aui-thread-welcome-message-motion-1 text-2xl font-semibold">
                  Hello there!
                </div>
                <div className="aui-thread-welcome-message-motion-2 text-2xl text-muted-foreground/65">
                  How can I help you today?
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          message.role === 'user' ? (
            // User message matching Thread
            <div
              key={message.id}
              className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
              data-role="user"
            >
              <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0 flex flex-col gap-2">
                {/* Images */}
                {message.images && message.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.images.map((img, idx) => (
                      <div key={idx} className="relative rounded-lg overflow-hidden border border-border max-w-[200px]">
                        <img 
                          src={img} 
                          alt={`Uploaded image ${idx + 1}`}
                          className="max-w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {/* Text content */}
                {message.content && (
                  <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Assistant message matching Thread
            <div
              key={message.id}
              className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-150 ease-out fade-in slide-in-from-bottom-1 last:mb-24"
              data-role="assistant"
            >
              <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          )
        ))}

        {messages.length > 0 && (
          <div className="aui-thread-viewport-spacer min-h-8 grow" />
        )}

        <div ref={messagesEndRef} />

        {/* Composer matching Thread */}
        <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
          <form onSubmit={handleSubmit} className="aui-composer-root relative flex w-full flex-col">
            <div className="aui-composer-attachment-dropzone group/input-group flex w-full flex-col rounded-3xl border border-input bg-background px-1 pt-2 shadow-xs transition-[color,box-shadow] outline-none has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/50 dark:bg-background">
              {/* Image previews */}
              {selectedImages.length > 0 && (
                <div className="px-3.5 pt-2 pb-2 flex flex-wrap gap-2">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-border max-w-[100px] group">
                      <img 
                        src={img} 
                        alt={`Preview ${idx + 1}`}
                        className="max-w-full h-auto"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        <X className="size-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                disabled={isLoading}
                className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0"
                rows={1}
                autoFocus
                aria-label="Message input"
                style={{
                  height: 'auto',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                aria-label="Upload images"
              />
              <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="size-[34px] rounded-full"
                  aria-label="Upload image"
                >
                  <ImageIcon className="size-5" />
                </Button>
                {!isLoading ? (
                  <Button
                    type="submit"
                    variant="default"
                    size="icon"
                    disabled={!input.trim() && selectedImages.length === 0}
                    className="aui-composer-send size-[34px] rounded-full p-1"
                    aria-label="Send message"
                  >
                    <ArrowUpIcon className="aui-composer-send-icon size-5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="default"
                    size="icon"
                    className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
                    aria-label="Stop generating"
                  >
                    <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
