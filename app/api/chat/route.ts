import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { SYSTEM_PROMPT } from '@/lib/joy-stream'

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

    // Helper function to validate and convert image to base64 format expected by OpenAI
    const convertImageToBase64 = async (imageInput: any): Promise<string | null> => {
      try {
        // If it's already a base64 string with data URL prefix, validate and return
        if (typeof imageInput === 'string') {
          // Check for data URL format (data:image/...;base64,...)
          if (imageInput.startsWith('data:image/')) {
            // Validate the data URL format
            const dataUrlMatch = imageInput.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
            if (dataUrlMatch) {
              const mimeType = dataUrlMatch[1];
              const base64Data = dataUrlMatch[2];
              
              // Validate MIME type is supported by OpenAI
              const supportedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
              if (!supportedTypes.includes(mimeType.toLowerCase())) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`Unsupported image MIME type: ${mimeType}`);
                }
                return null;
              }
              
              // Validate base64 data is not empty and is valid
              if (!base64Data || base64Data.trim().length === 0) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Empty base64 image data');
                }
                return null;
              }
              
              // Validate base64 format (alphanumeric + / + =)
              const cleanBase64 = base64Data.replace(/\s/g, '');
              if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Invalid base64 characters in image data');
                }
                return null;
              }
              
              // Return validated data URL
              return `data:image/${mimeType};base64,${cleanBase64}`;
            } else {
              // Malformed data URL
              if (process.env.NODE_ENV === 'development') {
                console.warn('Malformed data URL format');
              }
              return null;
            }
          }
          // If it's an external URL, OpenAI can handle it directly
          if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
            return imageInput;
          }
          // If it's a blob URL (blob:http://...), we can't process it server-side
          if (imageInput.startsWith('blob:')) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Blob URL cannot be processed server-side');
            }
            return null;
          }
          // If it's a long string, likely base64 without prefix
          // Try to detect if it's valid base64 (alphanumeric + / + =)
          if (imageInput.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(imageInput.replace(/\s/g, ''))) {
            // Remove any whitespace
            const cleanBase64 = imageInput.replace(/\s/g, '');
            // Default to jpeg if we can't detect type
            // Note: This is less reliable, prefer data URLs with proper MIME types
            if (process.env.NODE_ENV === 'development') {
              console.warn('Base64 without MIME type, defaulting to jpeg');
            }
            return `data:image/jpeg;base64,${cleanBase64}`;
          }
          if (process.env.NODE_ENV === 'development') {
            console.warn('Invalid image input format:', typeof imageInput, imageInput.substring(0, 50));
          }
          return null;
        }
        // If it's an object with image data
        if (imageInput && typeof imageInput === 'object') {
          // Check if it has arrayBuffer method (File-like object)
          if ('arrayBuffer' in imageInput && typeof imageInput.arrayBuffer === 'function') {
            const arrayBuffer = await imageInput.arrayBuffer();
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Empty image arrayBuffer');
              }
              return null;
            }
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            const mimeType = imageInput.type || 'image/jpeg';
            
            // Validate MIME type
            const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!supportedTypes.includes(mimeType.toLowerCase())) {
              if (process.env.NODE_ENV === 'development') {
                console.warn(`Unsupported image MIME type: ${mimeType}`);
              }
              return null;
            }
            
            return `data:${mimeType};base64,${base64}`;
          }
          // Check if it has a data property
          if ('data' in imageInput && typeof imageInput.data === 'string') {
            return await convertImageToBase64(imageInput.data);
          }
        }
        return null;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error converting image to base64:', error);
        }
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
      
      let title = 'Nouvelle conversation';
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
                    } else {
                      // Skip invalid images instead of failing
                      if (process.env.NODE_ENV === 'development') {
                        console.warn('Skipping invalid image data');
                      }
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
    // Also validate and clean image data in messages
    const modelMessages = validMessages.filter((msg: any) => {
      if (!msg || !msg.role) return false;
      if (msg.role === 'system') return false; // Don't include system messages from user input
      
      // Validate image content if present
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.filter((c: any) => {
          if (c.type === 'image_url' && c.image_url?.url) {
            const url = c.image_url.url;
            // Validate it's a proper data URL or HTTP(S) URL
            if (url.startsWith('data:image/')) {
              // Validate data URL format
              const isValid = /^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
              if (!isValid) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Filtering out invalid image data URL');
                }
                return false;
              }
            } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Filtering out invalid image URL format');
              }
              return false;
            }
          }
          return true;
        });
        
        // Remove message if it has no valid content after filtering
        if (msg.content.length === 0) {
          return false;
        }
      }
      
      return true;
    });

    // Build messages for AI with system prompt at the beginning
    // convertToModelMessages already ensures correct format, so we can use them directly
    const allMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...modelMessages,
    ];

    // Final validation and cleanup of messages before sending to OpenAI
    // This is critical to prevent invalid image data from reaching the API
    const validatedMessages = allMessages.map((msg: any) => {
      if (!msg || !msg.content) return msg;
      
      // If content is an array (multimodal), validate and filter images
      if (Array.isArray(msg.content)) {
        const validatedContent = msg.content.map((c: any) => {
          // Validate image_url content
          if (c.type === 'image_url' && c.image_url?.url) {
            const url = c.image_url.url;
            
            // Validate data URL format
            if (url.startsWith('data:image/')) {
              const dataUrlMatch = url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
              if (!dataUrlMatch) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Invalid data URL format, removing image:', url.substring(0, 100));
                }
                return null; // Remove invalid image
              }
              
              const mimeType = dataUrlMatch[1].toLowerCase();
              const base64Data = dataUrlMatch[2];
              
              // Check MIME type is supported
              const supportedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
              if (!supportedTypes.includes(mimeType)) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`Unsupported MIME type: ${mimeType}, removing image`);
                }
                return null; // Remove unsupported image
              }
              
              // Validate base64 data is not empty and is valid
              if (!base64Data || base64Data.trim().length === 0) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Empty base64 data, removing image');
                }
                return null; // Remove empty image
              }
              
              // Validate base64 format
              const cleanBase64 = base64Data.replace(/\s/g, '');
              if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Invalid base64 characters, removing image');
                }
                return null; // Remove invalid base64
              }
              
              // Validate base64 length (should be reasonable for an image)
              if (cleanBase64.length < 100) {
                if (process.env.NODE_ENV === 'development') {
                  console.warn('Base64 data too short, likely invalid, removing image');
                }
                return null; // Remove suspiciously short image
              }
              
              // Return validated image
              return c;
            } 
            // Validate HTTP(S) URL
            else if (url.startsWith('http://') || url.startsWith('https://')) {
              return c; // HTTP URLs are valid
            } 
            // Invalid URL format
            else {
              if (process.env.NODE_ENV === 'development') {
                console.warn('Invalid image URL format, removing:', url.substring(0, 100));
              }
              return null; // Remove invalid URL
            }
          }
          
          // Keep non-image content as-is
          return c;
        }).filter((c: any) => c !== null); // Remove null entries
        
        // If all content was removed, keep at least the text or return null
        if (validatedContent.length === 0) {
          // Try to find text content
          const textContent = msg.content.find((c: any) => c.type === 'text');
          if (textContent) {
            return { ...msg, content: [textContent] };
          }
          // If no text content, this message is invalid
          if (process.env.NODE_ENV === 'development') {
            console.warn('Message has no valid content after image validation, removing message');
          }
          return null;
        }
        
        return { ...msg, content: validatedContent };
      }
      
      // Non-array content (string) is fine
      return msg;
    }).filter((msg: any) => msg !== null); // Remove null messages
    
    // Check if any message has images to determine which model to use
    const hasImagesInAnyMessage = validatedMessages.some((msg: any) => 
      Array.isArray(msg.content) && 
      msg.content.some((c: any) => c.type === 'image_url' && c.image_url?.url)
    );
    
    // Use gpt-4o for vision support, gpt-4o-mini for text-only (cost optimization)
    const modelName = hasImagesInAnyMessage ? "gpt-4o" : "gpt-4o-mini";
    
    // Log in development to help debug
    if (process.env.NODE_ENV === 'development' && hasImagesInAnyMessage) {
      const imageCount = validatedMessages.reduce((count, msg) => {
        if (Array.isArray(msg.content)) {
          return count + msg.content.filter((c: any) => c.type === 'image_url').length;
        }
        return count;
      }, 0);
      console.log(`Sending ${imageCount} validated image(s) to ${modelName}`);
    }
    
    let result;
    try {
      result = streamText({
        model: openai(modelName),
        messages: validatedMessages,
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
      // Check if it's an image validation error from OpenAI
      if (streamError.message && streamError.message.includes('image data') && streamError.message.includes('valid image')) {
        // Log detailed error information in development
        if (process.env.NODE_ENV === 'development') {
          console.error('Image validation error from OpenAI:');
          console.error('Error message:', streamError.message);
          console.error('Messages with images:', JSON.stringify(
            validatedMessages.filter((msg: any) => 
              Array.isArray(msg.content) && 
              msg.content.some((c: any) => c.type === 'image_url')
            ).map((msg: any) => ({
              role: msg.role,
              imageCount: Array.isArray(msg.content) ? 
                msg.content.filter((c: any) => c.type === 'image_url').length : 0,
              imageUrls: Array.isArray(msg.content) ? 
                msg.content.filter((c: any) => c.type === 'image_url').map((c: any) => 
                  c.image_url?.url?.substring(0, 100) || 'no url'
                ) : []
            })),
            null,
            2
          ));
        }
        
        // Return a user-friendly error response
        return new Response(
          JSON.stringify({ 
            error: 'Données d\'image invalides',
            message: 'Une ou plusieurs images n\'ont pas pu être traitées. Veuillez vous assurer que les images sont dans un format pris en charge (JPEG, PNG, GIF ou WebP) et réessayez.',
            details: process.env.NODE_ENV === 'development' ? streamError.message : undefined,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Re-throw other errors
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
        error: 'Une erreur s\'est produite',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
