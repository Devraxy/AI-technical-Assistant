import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/conversations/[conversationId] - Get a specific conversation with messages
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireAuth()
    const { conversationId } = await context.params

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

    return NextResponse.json({ conversation })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Échec de la récupération de la conversation' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/conversations/[conversationId] - Delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const user = await requireAuth()
    const { conversationId } = await context.params

    // Verify ownership before deletion
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
      },
    })

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation introuvable' },
        { status: 404 }
      )
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    })


    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Échec de la suppression de la conversation' },
      { status: 500 }
    )
  }
}
