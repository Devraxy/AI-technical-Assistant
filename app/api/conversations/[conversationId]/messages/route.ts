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

    // Convert to assistant-ui message format (optimized - avoid try/catch in loop)
    const messages = conversation.messages.map((msg) => {
      // Handle empty or null content
      if (!msg.content || msg.content.length === 0) {
        return {
          id: msg.id,
          role: msg.role,
          content: [
            {
              type: 'text' as const,
              text: '',
            },
          ],
          createdAt: msg.createdAt,
        };
      }

      // Most messages are plain text, optimize for that case
      const firstChar = msg.content[0];
      let content;
      
      // Fast path: if doesn't start with [ or {, it's plain text
      if (firstChar !== '[' && firstChar !== '{') {
        content = [
          {
            type: 'text' as const,
            text: msg.content,
          },
        ];
      } else {
        // Only parse JSON if it looks like JSON
        try {
          const parsedContent = JSON.parse(msg.content);
          if (Array.isArray(parsedContent)) {
            // This is multimodal content (text + images)
            // Ensure images are in the correct format and validate them
            content = parsedContent.map((part: any) => {
              if (part.type === 'text') {
                return { type: 'text' as const, text: part.text || '' };
              } else if (part.type === 'image_url' && part.image_url?.url) {
                const url = part.image_url.url;
                // Validate image URL before including it
                if (url.startsWith('data:image/')) {
                  // Validate data URL format
                  const dataUrlMatch = url.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/);
                  if (!dataUrlMatch || !dataUrlMatch[2] || dataUrlMatch[2].trim().length === 0) {
                    // Invalid image data, skip it
                    return null;
                  }
                  // Validate base64 format
                  const base64Data = dataUrlMatch[2].replace(/\s/g, '');
                  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data) || base64Data.length < 100) {
                    // Invalid base64 or too short, skip it
                    return null;
                  }
                } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
                  // Invalid URL format, skip it
                  return null;
                }
                // Return validated image in image_url format
                return {
                  type: 'image_url' as const,
                  image_url: {
                    url: url,
                  },
                };
              } else if (part.type === 'image' && (part.image || part.url)) {
                const imageUrl = part.image || part.url;
                // Validate image URL before including it
                if (imageUrl.startsWith('data:image/')) {
                  // Validate data URL format
                  const dataUrlMatch = imageUrl.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/);
                  if (!dataUrlMatch || !dataUrlMatch[2] || dataUrlMatch[2].trim().length === 0) {
                    // Invalid image data, skip it
                    return null;
                  }
                  // Validate base64 format
                  const base64Data = dataUrlMatch[2].replace(/\s/g, '');
                  if (!/^[A-Za-z0-9+/=]+$/.test(base64Data) || base64Data.length < 100) {
                    // Invalid base64 or too short, skip it
                    return null;
                  }
                } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
                  // Invalid URL format, skip it
                  return null;
                }
                // Convert to image_url format
                return {
                  type: 'image_url' as const,
                  image_url: {
                    url: imageUrl,
                  },
                };
              }
              return part;
            }).filter((part: any) => part != null);
          } else {
            // Not an array, treat as plain text
            content = [
              {
                type: 'text' as const,
                text: msg.content,
              },
            ];
          }
        } catch {
          // Not valid JSON, treat as plain text
          content = [
            {
              type: 'text' as const,
              text: msg.content,
            },
          ];
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        content,
        createdAt: msg.createdAt,
      };
    })

    return NextResponse.json({ messages })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Échec de la récupération des messages' },
      { status: 500 }
    )
  }
}
