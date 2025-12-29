import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

// Strict response format system prompt
const SYSTEM_PROMPT = `Tu es un assistant technique spécialisé. Tu dois TOUJOURS répondre en suivant cette structure exacte :

**1. Résumé (2 lignes maximum)**
Une synthèse claire et concise de la réponse.

**2. Analyse technique**
Détails techniques pertinents, concepts clés, et contexte nécessaire.

**3. Références normatives**
Standards, normes, bonnes pratiques, ou documentation officielle applicables.

**4. Logique / Schéma (texte)**
Explication de la logique, du flux de travail, ou de l'architecture (en format texte/pseudo-code).

**5. Solutions / Recommandations**
Solutions concrètes, étapes à suivre, ou recommandations actionnables.

**6. Points de vigilance**
Risques, limitations, pièges à éviter, ou considérations importantes.

**7. Version courte** (si pertinent)
Résumé ultra-concis pour référence rapide (optionnel selon le contexte).

IMPORTANT: 
- Tu dois respecter cette structure pour TOUTES les réponses, sans exception. Ne fournis jamais de réponses non structurées.
- Tu PEUX et DOIS analyser des images. Quand un utilisateur envoie une image, tu DOIS l'analyser en détail et fournir une réponse structurée selon le format ci-dessus.
- Si un message contient une image, analyse-la complètement et décris ce que tu vois dans ta réponse.`;

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const user = await requireAuth()

    // Parse request body
    const body = await req.json();
    const { messages, conversationId }: { messages: any[]; conversationId?: string | null } = body;
    

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages must be an array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // CRITICAL: Convert UI messages to Model messages first
    // This handles the conversion from assistant-ui format (UIMessage[]) to AI SDK format (ModelMessage[])
    // Must be done early, before any processing
    // convertToModelMessages() automatically handles:
    // - Converting 'parts' arrays to proper 'content' format
    // - Handling images in the correct format
    // - Ensuring system/assistant messages are strings
    let convertedMessages;
    try {
      convertedMessages = convertToModelMessages(messages);
    } catch (conversionError: any) {
      // If conversion fails, try to use messages as-is (they might already be in model format)
      convertedMessages = messages;
    }

    // Helper function to convert image to base64 format expected by OpenAI
    const convertImageToBase64 = async (imageInput: any): Promise<string | null> => {
      try {
        // If it's already a base64 string with data URL prefix, return as-is
        if (typeof imageInput === 'string') {
          // Check for data URL format (data:image/...;base64,...)
          if (imageInput.startsWith('data:image/')) {
            return imageInput;
          }
          // If it's an external URL, OpenAI can handle it directly
          if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
            return imageInput;
          }
          // If it's a blob URL (blob:http://...), we can't process it server-side
          // This shouldn't happen if assistant-ui is working correctly
          if (imageInput.startsWith('blob:')) {
            return null;
          }
          // If it's a long string, likely base64 without prefix
          // Try to detect if it's valid base64 (alphanumeric + / + =)
          if (imageInput.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(imageInput.replace(/\s/g, ''))) {
            // Remove any whitespace
            const cleanBase64 = imageInput.replace(/\s/g, '');
            // Try to detect MIME type from common patterns or default to jpeg
            let mimeType = 'image/jpeg';
            // Could add more sophisticated detection here if needed
            return `data:${mimeType};base64,${cleanBase64}`;
          }
          return null;
        }
        // If it's an object with image data
        if (imageInput && typeof imageInput === 'object') {
          // Check if it has arrayBuffer method (File-like object)
          if ('arrayBuffer' in imageInput && typeof imageInput.arrayBuffer === 'function') {
            const arrayBuffer = await imageInput.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const mimeType = imageInput.type || 'image/jpeg';
            return `data:${mimeType};base64,${base64}`;
          }
          // Check if it has a data property
          if ('data' in imageInput && typeof imageInput.data === 'string') {
            return await convertImageToBase64(imageInput.data);
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    };

    // After convertToModelMessages, messages are already in ModelMessage format
    // convertToModelMessages() handles all the conversion correctly, so we can use them directly
    // Just filter out any null/undefined messages
    const validMessages = convertedMessages.filter(msg => msg != null && msg.role);

    // Get or create conversation
    // Only create a new conversation if we have messages to save
    let conversation: { id: string; userId: string } | null = null;
    if (conversationId) {
      // Verify the conversation belongs to the user
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
        },
      });
      
      if (!conversation) {
        // Don't create a new one automatically - let it be created when message is sent
        conversation = null;
      }
    }
    
    // Create new conversation if needed (when user sends a message)
    // Only create if we don't have a conversation and we have messages to process
    if (!conversation && validMessages.length > 0) {
      // Get the last user message for title generation
      const lastUserMessage = validMessages.filter(m => m.role === 'user').pop();
      
      let title = 'New Conversation';
      if (lastUserMessage) {
        if (typeof lastUserMessage.content === 'string') {
          title = lastUserMessage.content.slice(0, 50);
        } else if (Array.isArray(lastUserMessage.content)) {
          // Extract text from content array
          const textPart = lastUserMessage.content.find((p: any) => p && p.type === 'text');
          if (textPart && textPart.text) {
            title = String(textPart.text).slice(0, 50);
          }
        }
      }
      
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: title.length > 50 ? title.slice(0, 50) : title,
        },
      });
    }

    // Only save messages if we have a conversation
    // This prevents creating empty conversations when clicking "New Chat"
    if (conversation) {
      // Get the last message from the ORIGINAL messages array (before processing)
      // This ensures we capture images in their original format
      const lastOriginalMessage = messages[messages.length - 1];
      const lastProcessedMessage = validMessages[validMessages.length - 1];
      let userMessageContent = '';
      
      if (lastProcessedMessage && lastProcessedMessage.role === 'user') {
        // Always prefer original message parts if available (they have the raw image data)
        // This ensures we capture images before any processing that might lose data
        let messageToSave = lastProcessedMessage;
        
        // Check if original message has parts with images
        if (lastOriginalMessage && 'parts' in lastOriginalMessage && Array.isArray(lastOriginalMessage.parts)) {
          // Check for both 'image' and 'file' types (assistant-ui sends 'file' type with url)
          const originalHasImages = lastOriginalMessage.parts.some((p: any) => 
            (p.type === 'image' && p.image) || (p.type === 'file' && p.url)
          );
          
          if (originalHasImages) {
            // Use original parts - they have the image data we need
            // Convert original parts to content format for saving
            const contentForSaving = await Promise.all(
              lastOriginalMessage.parts.map(async (part: any) => {
              if (part.type === 'text') {
                  return { type: 'text', text: part.text || '' };
              } else if (part.type === 'image' || part.type === 'file') {
                  // Image is already in base64 data URL format from frontend
                  // assistant-ui sends 'file' type with 'url' property
                  const imageData = part.url || part.image || part.data || part.src;
                  if (imageData) {
                    // Ensure it's in base64 format (should already be from frontend)
                    const base64Image = await convertImageToBase64(imageData);
                    if (base64Image) {
                return {
                  type: 'image_url',
                  image_url: {
                          url: base64Image,
                  },
                };
                    }
                  }
              }
              return null;
              })
            );
            
            const filteredContent = contentForSaving.filter(Boolean);
            if (filteredContent.length > 0) {
            messageToSave = {
              role: lastOriginalMessage.role,
                content: filteredContent,
              };
            }
          }
        }
        
        // Save the full message content including images
        if (typeof messageToSave.content === 'string') {
          userMessageContent = messageToSave.content;
        } else if (Array.isArray(messageToSave.content)) {
          // Save the full content array including images as JSON
          userMessageContent = JSON.stringify(messageToSave.content);
        }
        
        // Save user message to database (non-blocking for better performance)
        if (userMessageContent) {
          // Don't await - let it save in background to improve response time
          prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'user',
              content: userMessageContent,
            },
          }).catch(() => {
            // Silently handle save errors
          });
        }
      }
    }

    // After convertToModelMessages, the messages are already in correct ModelMessage format
    // Filter out system messages from user input (we'll add our own system message)
    // Filter out any null/undefined messages
    const modelMessages = validMessages.filter((msg: any) => {
      if (!msg || !msg.role) return false;
      if (msg.role === 'system') return false; // Don't include system messages from user input
      return true;
    });

    // Build messages for AI with system prompt at the beginning
    // convertToModelMessages already ensures correct format, so we can use them directly
    const allMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...modelMessages,
    ];

    // Check if any message has images to determine which model to use
    const hasImagesInAnyMessage = allMessages.some((msg: any) => 
      Array.isArray(msg.content) && 
      msg.content.some((c: any) => c.type === 'image_url' && c.image_url?.url)
    );
    
    // Use gpt-4o for vision support, gpt-4o-mini for text-only (cost optimization)
    const modelName = hasImagesInAnyMessage ? "gpt-4o" : "gpt-4o-mini";
    
    let result;
    try {
      result = streamText({
        model: openai(modelName),
        messages: allMessages,
      onFinish: async ({ text }) => {
        // Only save assistant response if we have a conversation
        if (conversation) {
          try {
            await Promise.all([
              prisma.message.create({
                data: {
                  conversationId: conversation.id,
                  role: 'assistant',
                  content: text,
                },
              }),
              prisma.conversation.update({
                where: { id: conversation.id },
                data: { updatedAt: new Date() },
              }),
            ]);
          } catch (error) {
            // Silently handle save errors
          }
        }
      },
    });
    } catch (streamError: any) {
      throw streamError;
    }

    let response;
    try {
      // Return stream with conversation ID in headers (if we have one)
      response = result.toUIMessageStreamResponse({
        sendReasoning: false,
      });
    } catch (responseError: any) {
      throw responseError;
    }
    
    // Add conversation ID to response headers only if we have one
    if (conversation) {
      response.headers.set('X-Conversation-Id', conversation.id);
    }
    
    return response;
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
