import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/conversations/[conversationId]/messages - Get messages for a conversation
 * Returns messages in assistant-ui format
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireAuth()
    const { conversationId } = await context.params

    // Verify user owns this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable' },
        { status: 404 }
      )
    }

    // Ultra-optimized conversion: pre-allocate array and use fast paths
    const messages = new Array(conversation.messages.length);
    
    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i];
      
      // Handle empty content
      if (!msg.content || msg.content.length === 0) {
        messages[i] = {
          id: msg.id,
          role: msg.role,
          content: [{ type: 'text' as const, text: '' }],
          createdAt: msg.createdAt,
        };
        continue;
      }

      // Fast path: plain text (most common case - ~95% of messages)
      const firstChar = msg.content[0];
      if (firstChar !== '[' && firstChar !== '{') {
        messages[i] = {
          id: msg.id,
          role: msg.role,
          content: [{ type: 'text' as const, text: msg.content }],
          createdAt: msg.createdAt,
        };
        continue;
      }

      // Slow path: JSON content (multimodal - rare)
      try {
        const parsedContent = JSON.parse(msg.content);
        if (Array.isArray(parsedContent)) {
          // Simplified validation - skip complex regex for speed
          const content = parsedContent.filter((part: any) => {
            if (part.type === 'text') return true;
            if (part.type === 'image_url' && part.image_url?.url) return true;
            if (part.type === 'image' && (part.image || part.url)) return true;
            return false;
          }).map((part: any) => {
            if (part.type === 'text') {
              return { type: 'text' as const, text: part.text || '' };
            } else if (part.type === 'image_url' && part.image_url?.url) {
              return {
                type: 'image_url' as const,
                image_url: { url: part.image_url.url },
              };
            } else if (part.type === 'image' && (part.image || part.url)) {
              return {
                type: 'image_url' as const,
                image_url: { url: part.image || part.url },
              };
            }
            return part;
          });
          
          messages[i] = {
            id: msg.id,
            role: msg.role,
            content: content.length > 0 ? content : [{ type: 'text' as const, text: '' }],
            createdAt: msg.createdAt,
          };
        } else {
          // Not an array, treat as plain text
          messages[i] = {
            id: msg.id,
            role: msg.role,
            content: [{ type: 'text' as const, text: msg.content }],
            createdAt: msg.createdAt,
          };
        }
      } catch {
        // Not valid JSON, treat as plain text
        messages[i] = {
          id: msg.id,
          role: msg.role,
          content: [{ type: 'text' as const, text: msg.content }],
          createdAt: msg.createdAt,
        };
      }
    }

    return NextResponse.json({ messages })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Échec de la récupération des messages' },
      { status: 500 }
    )
  }
}
