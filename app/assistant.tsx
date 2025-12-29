"use client";

import { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from "react";
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
import { MessagesSquare, Github } from "lucide-react";
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
              Something went wrong. Please refresh the page.
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

  // STEP 1: Load conversation history from database when conversation changes
  useEffect(() => {
    // Reset state when conversation changes
    setInitialMessages([]);
    setMessagesLoadedIntoRuntime(false);
    setMessagesLoadedIntoRuntime(false);
    
    async function loadConversationHistory() {
      if (!currentConversationId) {
        setIsLoadingHistory(false);
        setMessagesLoadedIntoRuntime(true); // Allow rendering empty state
        return;
      }

      setIsLoadingHistory(true);
      setMessagesLoadedIntoRuntime(false);
      
      try {
        const response = await fetch(`/api/conversations/${currentConversationId}/messages`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform messages to format expected by assistant-ui (optimized)
          // Pre-allocate array for better performance
          const formattedMessages: any[] = [];
          
          for (const msg of data.messages || []) {
            // Fast validation
            if (!msg?.role || msg?.content === undefined) continue;
            
            
            // Extract content efficiently
            let content: string = '';
            
            // Handle content - might be string, array, or need parsing
            let contentArray: any[] | null = null;
            
            if (Array.isArray(msg.content)) {
              contentArray = msg.content;
            } else if (typeof msg.content === 'string') {
              // Try to parse as JSON if it looks like JSON
              if (msg.content.trim().startsWith('[') || msg.content.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(msg.content);
                  if (Array.isArray(parsed)) {
                    contentArray = parsed;
                  }
                } catch (e) {
                  // Not JSON, treat as plain text
                  contentArray = null;
                }
              }
            }
            
            // Handle both text and multimodal content (text + images)
            if (contentArray && Array.isArray(contentArray)) {
              // Extract all parts (text and images)
              const parts: any[] = [];
              let hasText = false;
              
              for (const part of contentArray) {
                // Handle text parts
                if (part?.type === 'text' && part.text !== undefined) {
                  const text = String(part.text).trim();
                  if (text) {
                    parts.push({
                      type: 'text' as const,
                      text: text,
                    });
                    hasText = true;
                  }
                } 
                // Handle image_url format (from API/database)
                // Convert to 'file' type format that assistant-ui expects
                else if (part?.type === 'image_url' && part.image_url?.url) {
                  // Include image parts when loading history
                  // Use 'file' type with 'url' property (assistant-ui format)
                  const imageUrl = part.image_url.url;
                  if (imageUrl) {
                    // Detect media type from data URL
                    const mediaType = imageUrl.startsWith('data:') 
                      ? imageUrl.substring(5, imageUrl.indexOf(';')) 
                      : 'image/png';
                    
                    parts.push({
                      type: 'file' as const,
                      url: imageUrl,
                      mediaType: mediaType,
                    });
                  }
                }
                // Handle image format (fallback - convert to file format)
                else if (part?.type === 'image' && (part.image || part.url)) {
                  const imageUrl = part.image || part.url;
                  if (imageUrl) {
                    // Detect media type from data URL
                    const mediaType = imageUrl.startsWith('data:') 
                      ? imageUrl.substring(5, imageUrl.indexOf(';')) 
                      : 'image/png';
                    
                    parts.push({
                      type: 'file' as const,
                      url: imageUrl,
                      mediaType: mediaType,
                    });
                  }
                }
                // Handle file format (already correct)
                else if (part?.type === 'file' && part.url) {
                  // Already in correct format, use as-is
                  parts.push(part);
                }
                // Silently ignore unrecognized parts
                else if (part && part.type) {
                  // Unrecognized part type - skip
                }
              }
              
              // Only skip if there are no parts at all
              if (parts.length === 0) continue;
              
              // Convert to AI SDK format with parts array (including images)
              formattedMessages.push({
                id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                role: msg.role as 'user' | 'assistant',
                parts: parts,
              });
            } else if (typeof msg.content === 'string') {
              content = msg.content.trim();
              if (!content) continue;
              
              // Convert to AI SDK format with parts array
              formattedMessages.push({
                id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                role: msg.role as 'user' | 'assistant',
                parts: [
                  {
                    type: 'text' as const,
                    text: content,
                  },
                ],
              });
            } else {
              continue;
            }
          }
          
          // Set messages - this will trigger Step 2
          setInitialMessages(formattedMessages);
        } else if (response.status === 404) {
          // Conversation not found - clear it from localStorage and state
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
  }, [currentConversationId]);

  // Handle conversation selection
  function handleSelectConversation(conversationId: string) {
    setCurrentConversationId(conversationId);
  }

  // Handle new chat - clear the current conversation
  function handleNewChat() {
    setCurrentConversationId(null);
  }


  // Refresh conversation list when currentConversationId changes
  useEffect(() => {
    if (currentConversationId) {
      setConversationListKey(prev => prev + 1);
    }
  }, [currentConversationId]);

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

  // SOLUTION: With useChat + initialMessages, we need to update messages when initialMessages changes
  // useChat's initialMessages only works on mount, so we use chat.setMessages() when they change
  useEffect(() => {
    // Wait for messages to be loaded from database
    if (isLoadingHistory) {
      return;
    }
    
    // Create a stable identifier for the messages to compare
    const messagesIds = initialMessages.map(m => m.id || '').join(',');
    const messagesLength = initialMessages.length;
    
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
    // This bypasses the symbolInnerMessage issue because we're calling setMessages directly
    // with AI SDK format messages
    if (currentConversationId) {
      if (initialMessages.length > 0) {
        chat.setMessages(initialMessages);
        lastSetMessagesIdsRef.current = messagesIds;
        lastSetMessagesLengthRef.current = messagesLength;
      } else {
        // No messages for this conversation
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
  }, [currentConversationId, initialMessages, isLoadingHistory]); // chat.setMessages is stable, so we don't need chat in deps

  // Monitor for new conversation creation when in "new chat" mode
  useEffect(() => {
    if (currentConversationId !== null) {
      return;
    }

    let checkCount = 0;
    const maxChecks = 15;
    let intervalId: NodeJS.Timeout | null = null;

    const checkForNewConversation = async () => {
      checkCount++;

      if (checkCount > maxChecks) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        return;
      }

      try {
        const response = await fetch('/api/conversations');
        if (response.ok) {
          const data = await response.json();
          if (data.conversations && data.conversations.length > 0) {
            const latestConversation = data.conversations[0];
            const conversationAge = Date.now() - new Date(latestConversation.createdAt).getTime();
            if (conversationAge < 20000) {
              setCurrentConversationId(latestConversation.id);
              setConversationListKey(prev => prev + 1);
              if (intervalId) {
                clearInterval(intervalId);
              }
              return;
            }
          }
        }
      } catch (error) {
        // Silent error handling
      }
    };

    checkForNewConversation();
    intervalId = setInterval(checkForNewConversation, 2000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
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
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                          <MessagesSquare className="size-4" />
                        </div>
                        <div className="mr-6 flex flex-col gap-0.5 leading-none">
                          <span className="font-semibold">
                            AI Assistant
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            </SidebarHeader>
            <SidebarContent className="px-2">
              <ConversationList
                key={conversationListKey}
                currentConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                refreshTrigger={conversationListKey}
              />
            </SidebarContent>
            <SidebarRail />
            <SidebarFooter className="border-t">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton size="lg" asChild>
                    <Link
                      href="https://github.com/assistant-ui/assistant-ui"
                      target="_blank"
                    >
                      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        <Github className="size-4" />
                      </div>
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-semibold">
                          GitHub
                        </span>
                        <span>View Source</span>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="https://www.assistant-ui.com/docs/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      AI Assistant
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {currentConversationId ? 'Conversation' : 'New Chat'}
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
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      {isLoadingHistory ? 'Loading conversation from database...' : 'Preparing messages...'}
                    </p>
                  </div>
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

export const Assistant = AssistantContent;
