"use client";

import { useState, useEffect } from "react";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
import { ChatInterface } from "@/components/chat-interface";
import { MessagesSquare, Github } from "lucide-react";
import Link from "next/link";

function AssistantContent() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    // Restore conversation ID from localStorage on page load
    if (typeof window !== 'undefined') {
      return localStorage.getItem('currentConversationId')
    }
    return null
  });
  const [conversationListKey, setConversationListKey] = useState(0);

  // Save conversation ID to localStorage whenever it changes
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('currentConversationId', currentConversationId)
    } else {
      localStorage.removeItem('currentConversationId')
    }
  }, [currentConversationId])

  // Handle conversation selection
  function handleSelectConversation(conversationId: string) {
    setCurrentConversationId(conversationId);
  }

  // Handle new chat
  function handleNewChat() {
    setCurrentConversationId(null);
  }

  // Handle when a new conversation is created
  function handleConversationCreated(newConversationId: string) {
    setCurrentConversationId(newConversationId);
    // Refresh the conversation list to show the new conversation
    setConversationListKey(prev => prev + 1);
  }

  return (
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
            <ChatInterface
              conversationId={currentConversationId}
              onConversationCreated={handleConversationCreated}
            />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export const AssistantWithPersistence = AssistantContent;
