import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/conversations - List all conversations for the current user
 */
export async function GET() {
  try {
    const user = await requireAuth()

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    return NextResponse.json({ conversations })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conversations - Create a new conversation
 */
export async function POST() {
  try {
    const user = await requireAuth()

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: 'New Conversation',
      },
    })


    return NextResponse.json({ conversation })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}
