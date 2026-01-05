"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Component, ErrorInfo, ReactNode, memo, startTransition } from "react";
import { Thread } from "@/components/assistant-ui/thread";
import {
  AssistantChatTransport,
  useAISDKRuntime,
} from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider, useAssistantState } from "@assistant-ui/react";
import { useChat } from "@ai-sdk/react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ConversationList } from "@/components/conversation-list";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LogoutButton } from "@/components/logout-button";
import { AdminLink } from "@/components/admin-link";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import Link from "next/link";

// Error boundary to catch React errors and suppress extension errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Suppress "Extension context invalidated" errors from browser extensions
    if (error.message?.includes('Extension context invalidated')) {
      return;
    }
    // Silently handle errors
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Une erreur s'est produite. Veuillez actualiser la page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Debug component to check thread.messages using useAssistantState (only in development)
function ThreadMessagesDebug() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const messages = useAssistantState(({ thread }) => thread.messages);
  const messagesLength = useAssistantState(({ thread }) => thread.messages.length);
  
  useEffect(() => {
    // Debug logging removed for production
  }, [messages, messagesLength]);
  
  return null; // This component doesn't render anything
}

function AssistantContent() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    // Restore conversation ID from localStorage on page load
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentConversationId')
    }
    return null
  });
  const [conversationListKey, setConversationListKey] = useState(0);
  const [initialMessages, setInitialMessages] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messagesLoadedIntoRuntime, setMessagesLoadedIntoRuntime] = useState(false);
  
  // Use ref to store current conversationId for transport body
  const conversationIdRef = useRef(currentConversationId);
  conversationIdRef.current = currentConversationId;

  // Suppress browser extension errors (they don't affect app functionality)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Suppress "Extension context invalidated" errors from browser extensions
      const message = event.message || '';
      const filename = event.filename || '';
      const source = event.error?.stack || '';
      
      if (
        message.includes('Extension context invalidated') ||
        message.includes('extension context') ||
        message.includes('chrome-extension://') ||
        filename.includes('content.js') ||
        filename.includes('extension') ||
        filename.includes('chrome-extension://') ||
        source.includes('content.js') ||
        source.includes('chrome-extension://')
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress extension-related promise rejections
      const reason = event.reason?.message || event.reason?.toString() || '';
      const stack = event.reason?.stack || '';
      
      if (
        reason.includes('Extension context invalidated') ||
        reason.includes('extension context') ||
        reason.includes('chrome-extension://') ||
        stack.includes('content.js') ||
        stack.includes('chrome-extension://')
      ) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    window.addEventListener('error', handleError, true); // Use capture phase
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
    };
  }, []);

  // Save conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('currentConversationId', currentConversationId)
    } else {
      localStorage.removeItem('currentConversationId')
    }
  }, [currentConversationId])

  // Ultra-optimized message transformation function
  // API already returns messages in correct format, so we just need minimal conversion
  const transformMessage = useCallback((msg: any): any | null => {
    // Fast validation - early exit
    if (!msg?.role || !msg?.content) return null;
    
    // API already returns content as array format, so we can optimize
    // Fast path: content is already an array (most common case)
    if (Array.isArray(msg.content)) {
      // Filter and map in one pass for better performance
      const parts: any[] = [];
      let hasText = false;
      
      for (let i = 0; i < msg.content.length; i++) {
        const part = msg.content[i];
        if (!part) continue;
        
        // Text parts - most common
        if (part.type === 'text' && part.text) {
          const text = String(part.text).trim();
          if (text) {
            parts.push({ type: 'text' as const, text });
            hasText = true;
          }
        }
        // Image parts - less common, optimize
        else if (part.type === 'image_url' && part.image_url?.url) {
          parts.push({ 
            type: 'file' as const, 
            url: part.image_url.url, 
            mediaType: part.image_url.url.startsWith('data:') 
              ? part.image_url.url.substring(5, part.image_url.url.indexOf(';')) || 'image/png'
              : 'image/png'
          });
        }
        // File parts - already correct
        else if (part.type === 'file' && part.url) {
          parts.push(part);
        }
      }
      
      // Must have at least text content
      if (!hasText || parts.length === 0) return null;
      
      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts,
      };
    }
    
    // Fallback: string content (should be rare since API converts it)
    if (typeof msg.content === 'string') {
      const content = msg.content.trim();
      if (!content) return null;
      
      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: [{ type: 'text' as const, text: content }],
      };
    }
    
    return null;
  }, []);

  // STEP 1: Load conversation history from database when conversation changes
  useEffect(() => {
    // Reset state when conversation changes
    setInitialMessages([]);
    setMessagesLoadedIntoRuntime(false);
    
    async function loadConversationHistory() {
      if (!currentConversationId) {
        setIsLoadingHistory(false);
        setMessagesLoadedIntoRuntime(true);
        return;
      }

      setIsLoadingHistory(true);
      setMessagesLoadedIntoRuntime(false);
      
      try {
        // Use AbortController for request cancellation if component unmounts
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10s timeout
        
        const response = await fetch(`/api/conversations/${currentConversationId}/messages`, {
          cache: 'no-store', // Always get fresh data
          signal: abortController.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];
          
          // Ultra-fast processing: transform all messages synchronously
          // Modern JS engines handle this efficiently, batch processing adds overhead
          const formattedMessages: any[] = new Array(messages.length);
          let validCount = 0;
          
          // Single pass transformation - fastest approach
          for (let i = 0; i < messages.length; i++) {
            const transformed = transformMessage(messages[i]);
            if (transformed) {
              formattedMessages[validCount++] = transformed;
            }
          }
          
          // Resize array to actual size
          formattedMessages.length = validCount;
          
          // Use startTransition for non-urgent state update to keep UI responsive
          startTransition(() => {
            setInitialMessages(formattedMessages);
          });
        } else if (response.status === 404) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('currentConversationId');
          }
          setCurrentConversationId(null);
          setInitialMessages([]);
          setMessagesLoadedIntoRuntime(true);
        } else {
          setInitialMessages([]);
          setMessagesLoadedIntoRuntime(true);
        }
      } catch (error) {
        setInitialMessages([]);
        setMessagesLoadedIntoRuntime(true);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadConversationHistory();
  }, [currentConversationId, transformMessage]);

  // Memoize handlers to prevent unnecessary re-renders
  const handleSelectConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
  }, []);

  // Handle new chat - clear the current conversation
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null);
  }, []);

  // Only refresh conversation list when a new conversation is created, not when switching
  // This is handled by the refreshTrigger in the new conversation detection useEffect below

  // Store runtime ref so fetch interceptor can access it
  const runtimeRef = useRef<any>(null);
  
  // Create transport once with stable reference
  // Use a function for body that reads from ref to get current conversationId
  const transport = useMemo(() => {
    // Intercept fetch to log full requests and add attachments
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const [url, options] = args;
      if (typeof url === 'string' && url.includes('/api/chat') && options?.body) {
        try {
          const bodyData = JSON.parse(options.body as string);
          // Get the LAST message (the new one being sent)
          const lastMessage = bodyData.messages?.[bodyData.messages.length - 1];
          
          // Check for BOTH 'image' and 'file' types (assistant-ui sends 'file' type!)
          let imageParts = lastMessage?.parts?.filter((p: any) => 
            p.type === 'image' || p.type === 'image_url' || p.type === 'file'
          ) || [];
          
          // If no images, try to get attachment from runtime
          if (imageParts.length === 0 && runtimeRef.current) {
            try {
              // Try multiple ways to access attachment from runtime
              const runtime = runtimeRef.current;
              
              // Method 1: Try runtime.composer.state.get()
              let attachment = null;
              try {
                const composerState = runtime?.composer?.state?.get?.();
                attachment = composerState?.attachment;
              } catch (e) {
                  // Silently handle errors
              }
              
              // Method 2: Try runtime._runtime.state.get()
              if (!attachment) {
                try {
                  const runtimeState = runtime?._runtime?.state?.get?.();
                  attachment = runtimeState?.composer?.attachment;
                } catch (e) {
                  // Silently handle errors
                }
              }
              
              // Method 3: Try accessing through runtime's internal store
              if (!attachment) {
                try {
                  const store = runtime?._runtime?.store;
                  if (store) {
                    const state = store.getState();
                    attachment = state?.composer?.attachment;
                  }
                } catch (e) {
                  // Silently handle errors
                }
              }
              
              // If we found an attachment, convert and add it
              if (attachment && attachment.type === 'image' && attachment.file) {
                const file = attachment.file;
                
                // Validate file size (OpenAI vision API limit is 20MB)
                const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
                const fileSizeMB = file.size / (1024 * 1024);
                
                if (file.size > MAX_FILE_SIZE) {
                  console.warn(`Image file too large: ${fileSizeMB.toFixed(2)}MB, max 20MB. File: ${file.name}`);
                  // Show user-friendly error message
                  alert(`Image trop volumineuse: ${fileSizeMB.toFixed(2)}MB\nLa taille maximale autorisée est de 20MB. Veuillez réduire la taille de l'image et réessayer.`);
                  // Don't add the image if it's too large - continue without it
                  // The API route will also validate, but this prevents unnecessary processing
                } else {
                  const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                  });
                  
                  // Add image part to message
                  if (!lastMessage.parts) {
                    lastMessage.parts = [];
                  }
                  lastMessage.parts.push({
                    type: 'file',
                    url: base64Data,
                    mediaType: file.type || 'image/png',
                    filename: file.name || 'image.png',
                  });
                  imageParts = lastMessage.parts.filter((p: any) => p.type === 'file');
                  
                  // Update the request body
                  options.body = JSON.stringify(bodyData);
                }
              }
            } catch (e) {
              // Silently handle errors
            }
          }
          
          // Check if attachment is at the root level
          const attachmentData = bodyData.attachment || lastMessage?.attachment;
          if (attachmentData && !imageParts.length) {
            // Attachment found at root level
          }
        } catch (e) {
          // Silently handle parsing errors
        }
      }
      return originalFetch.apply(this, args);
    };

    return new AssistantChatTransport({
      api: "/api/chat",
      body: () => {
        const bodyData = {
          conversationId: conversationIdRef.current,
        };
        return bodyData;
      },
    });
  }, []); // Empty dependency array - transport is created once

  // SOLUTION: Use useChat directly, then wrap with useAISDKRuntime
  // We'll set messages via chat.setMessages() when initialMessages changes
  // This bypasses the symbolInnerMessage issue because we call setMessages directly
  // with AI SDK format messages (content as string)
  // Type assertion to work around version mismatch between ai packages
  const chat = useChat({
    transport: transport as any,
  });

  // Wrap chat with useAISDKRuntime to create the assistant-ui runtime
  // Type assertion to work around version mismatch between ai packages
  const runtime = useAISDKRuntime(chat as any);

  // Store runtime in ref for fetch interceptor
  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  // Set the runtime on the transport so it can access it
  useEffect(() => {
    if (transport instanceof AssistantChatTransport) {
      transport.setRuntime(runtime);
    }
  }, [transport, runtime]);

  // Use ref to track the last conversation ID and messages we set to avoid infinite loops
  const lastSetConversationIdRef = useRef<string | null>(null);
  const lastSetMessagesLengthRef = useRef<number>(0);
  const lastSetMessagesIdsRef = useRef<string>('');

  // Memoize valid messages to avoid recalculation
  const validMessages = useMemo(() => {
    if (initialMessages.length === 0) return [];
    return initialMessages.filter((msg: any) => 
      msg?.id && msg?.role && msg?.parts?.length > 0
    );
  }, [initialMessages]);

  // SOLUTION: With useChat + initialMessages, we need to update messages when initialMessages changes
  // useChat's initialMessages only works on mount, so we use chat.setMessages() when they change
  useEffect(() => {
    // Wait for messages to be loaded from database
    if (isLoadingHistory) {
      return;
    }
    
    // Create a stable identifier for the messages to compare (optimized)
    const messagesIds = validMessages.length > 0 
      ? validMessages.map((m: any) => m.id || '').join(',')
      : '';
    const messagesLength = validMessages.length;
    
    // Check if we've already set these exact messages to avoid infinite loops
    const messagesChanged = 
      lastSetMessagesIdsRef.current !== messagesIds ||
      lastSetMessagesLengthRef.current !== messagesLength ||
      lastSetConversationIdRef.current !== currentConversationId;
    
    if (!messagesChanged) {
      setMessagesLoadedIntoRuntime(true);
      return;
    }
    
    // Update chat messages when initialMessages changes
    // useAISDKRuntime expects assistant-ui format with 'parts' property
    // Use memoized validMessages for better performance
    if (currentConversationId) {
      if (validMessages.length > 0) {
        // Use startTransition for smoother UI updates
        startTransition(() => {
          chat.setMessages(validMessages as any);
        });
        lastSetMessagesIdsRef.current = messagesIds;
        lastSetMessagesLengthRef.current = messagesLength;
      } else {
        chat.setMessages([]);
        lastSetMessagesIdsRef.current = '';
        lastSetMessagesLengthRef.current = 0;
      }
    } else {
      // No conversation selected - clear messages
      chat.setMessages([]);
      lastSetMessagesIdsRef.current = '';
      lastSetMessagesLengthRef.current = 0;
    }
    
    lastSetConversationIdRef.current = currentConversationId;
    
    // Mark messages as loaded so UI can render
    setMessagesLoadedIntoRuntime(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, validMessages, isLoadingHistory]); // Use memoized validMessages instead of initialMessages

  // Monitor for new conversation creation when in "new chat" mode
  // OPTIMIZED: Use exponential backoff to reduce server load
  useEffect(() => {
    if (currentConversationId !== null) {
      return;
    }

    let checkCount = 0;
    const maxChecks = 10; // Reduced from 15
    let timeoutId: NodeJS.Timeout | null = null;
    let isActive = true;

    const checkForNewConversation = async () => {
      if (!isActive) return;
      
      checkCount++;

      if (checkCount > maxChecks) {
        return;
      }

      try {
        const response = await fetch('/api/conversations', {
          // Add cache control to prevent unnecessary requests
          cache: 'no-store',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.conversations && data.conversations.length > 0) {
            const latestConversation = data.conversations[0];
            const conversationAge = Date.now() - new Date(latestConversation.createdAt).getTime();
            if (conversationAge < 20000) {
              setCurrentConversationId(latestConversation.id);
              setConversationListKey(prev => prev + 1);
              isActive = false;
              return;
            }
          }
        }
      } catch (error) {
        // Silent error handling
      }

      // Exponential backoff: start with 1s, then 2s, 3s, 5s, 8s, etc.
      const delays = [1000, 2000, 3000, 5000, 8000, 10000, 10000, 10000, 10000, 10000];
      const delay = delays[Math.min(checkCount - 1, delays.length - 1)];
      
      if (isActive && checkCount < maxChecks) {
        timeoutId = setTimeout(checkForNewConversation, delay);
      }
    };

    // Initial check after a short delay
    timeoutId = setTimeout(checkForNewConversation, 500);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentConversationId]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadMessagesDebug />
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <Sidebar>
            <SidebarHeader className="mb-2 border-b">
              <div className="flex items-center justify-between">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg" asChild>
                      <Link href="/">
                        <img src="/logo.svg" alt="Assistant IA" className="h-full w-full object-contain" />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </SidebarHeader>
            <SidebarContent className="px-2">
              <ConversationList
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                refreshTrigger={conversationListKey}
              />
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {currentConversationId ? 'Conversation' : 'Nouvelle conversation'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="ml-auto flex items-center gap-2">
                <AdminLink />
                <LogoutButton />
              </div>
            </header>
            <div className="flex-1 overflow-hidden">
              {isLoadingHistory || !messagesLoadedIntoRuntime ? (
                <div className="flex h-full items-center justify-center">
                  <LoadingSpinner 
                    size="lg" 
                    text={isLoadingHistory ? 'Chargement de la conversation...' : 'Préparation des messages...'}
                    variant="default"
                  />
                </div>
              ) : (
                <ErrorBoundary>
                  <ThreadMessagesDebug />
                  <Thread />
                </ErrorBoundary>
              )}
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
}

export { AssistantContent as Assistant };
