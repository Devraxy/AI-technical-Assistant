import nodemailer from 'nodemailer'
import { Resend } from 'resend'

// Email transporter configuration
// Supports Resend (recommended), SMTP, Gmail, and other email services via environment variables
function createTransporter() {
  // Priority 1: Use Resend (free tier available, recommended)
  if (process.env.RESEND_API_KEY) {
    return { type: 'resend' as const }
  }

  // Priority 2: If SMTP is configured, use it
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      // Add connection timeout and debug options
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000, // 5 seconds
      socketTimeout: 10000, // 10 seconds
    })
    
    // Verify connection configuration
    console.log('📧 SMTP Configuration:')
    console.log(`   Host: ${process.env.SMTP_HOST}`)
    console.log(`   Port: ${process.env.SMTP_PORT}`)
    console.log(`   Secure: ${process.env.SMTP_SECURE === 'true'}`)
    console.log(`   User: ${process.env.SMTP_USER ? 'Set' : 'Not set'}`)
    console.log(`   Password: ${process.env.SMTP_PASSWORD ? 'Set' : 'Not set'}`)
    
    return { type: 'nodemailer' as const, transporter }
  }

  // Priority 3: Use Gmail OAuth or app password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      type: 'nodemailer' as const,
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      }),
    }
  }

  // Development: Use a mock transporter that logs emails instead of sending
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Email configuration not found. Using mock transporter in development mode.')
    console.warn('   Emails will be logged to console instead of being sent.')
    console.warn('   To send real emails, configure RESEND_API_KEY, SMTP, or Gmail environment variables.')
    
    // Return a mock transporter that doesn't actually send emails
    return {
      type: 'nodemailer' as const,
      transporter: nodemailer.createTransport({
        jsonTransport: true, // This makes it return the email as JSON instead of sending
      }),
    }
  }

  // Production: Provide detailed error message
  const errorMessage = [
    'Email configuration is missing. To enable email sending, configure one of the following:',
    '',
    'Option 1 - Resend (Recommended, free tier available):',
    '  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    '  EMAIL_FROM="Your App <onboarding@resend.dev>"',
    '  Get your API key at: https://resend.com/api-keys',
    '',
    'Option 2 - SMTP:',
    '  SMTP_HOST=your-smtp-host.com',
    '  SMTP_PORT=587',
    '  SMTP_SECURE=false',
    '  SMTP_USER=your-email@example.com',
    '  SMTP_PASSWORD=your-password',
    '',
    'Option 3 - Gmail:',
    '  GMAIL_USER=your-email@gmail.com',
    '  GMAIL_APP_PASSWORD=your-app-password',
    '',
    'Note: For Gmail, you need to generate an App Password in your Google Account settings.'
  ].join('\n')
  
  throw new Error(errorMessage)
}

// Helper function to send email using the configured service
async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
}): Promise<void> {
  const transporter = createTransporter()
  const appName = process.env.APP_NAME || 'AI Assistant'
  const from = process.env.EMAIL_FROM || `"${appName}" <noreply@example.com>`

  // Use Resend if configured
  if (transporter.type === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    try {
      console.log('📧 Attempting to send email via Resend...')
      console.log(`   From: ${from}`)
      console.log(`   To: ${options.to}`)
      
      const result = await resend.emails.send({
        from: from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      })
      
      console.log('✅ Email sent successfully via Resend!')
      console.log(`   Message ID: ${result.data?.id}`)
      return
    } catch (error) {
      console.error('Error sending email via Resend:', error)
      if (error instanceof Error) {
        throw new Error(`Failed to send email: ${error.message}`)
      }
      throw new Error('Failed to send email. Please try again later.')
    }
  }

  // Use nodemailer for SMTP/Gmail
  const mailOptions = {
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''),
  }

  try {
    console.log('📧 Attempting to send email via nodemailer...')
    console.log(`   From: ${mailOptions.from}`)
    console.log(`   To: ${options.to}`)
    
    const result = await transporter.transporter.sendMail(mailOptions)
    
    console.log('✅ Email sent successfully!')
    console.log(`   Message ID: ${result.messageId}`)
    console.log(`   Response: ${result.response}`)
    
    // In development with mock transporter, log the email details
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER && !process.env.RESEND_API_KEY) {
      console.log('\n📧 Email (Development Mode - Not Actually Sent):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${options.to}`)
      console.log(`Subject: ${options.subject}`)
      console.log(`HTML: ${options.html.substring(0, 200)}...`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    }
  } catch (error) {
    console.error('Error sending email:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Email configuration is missing')) {
        console.error('\n' + error.message + '\n')
        throw new Error('Email service is not configured. Please contact the administrator or check server logs for configuration details.')
      }
      
      console.error('Full error details:', error)
      throw new Error(`Failed to send email: ${error.message}`)
    }
    
    throw new Error('Failed to send email. Please try again later.')
  }
}

export async function sendEmailVerification(
  email: string,
  verificationUrl: string,
  verificationCode?: string
): Promise<void> {
  const appName = process.env.APP_NAME || 'AI Assistant'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Verify Your Email</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for signing up for ${appName}! Please verify your email address to complete your registration.
            </p>
            ${verificationCode ? `
            <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Your verification code:</p>
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
              Enter this code on the verification page, or click the button below to verify automatically.
            </p>
            ` : ''}
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold; 
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Verify Email Address
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              This link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `

  const text = `
    Verify Your Email

    Hello,

    Thank you for signing up for ${appName}! Please verify your email address to complete your registration.

    ${verificationCode ? `Your verification code: ${verificationCode}\n\n` : ''}Click the link below to verify your email:
    ${verificationUrl}

    This link will expire in 24 hours. If you didn't create an account, please ignore this email.

    This is an automated message. Please do not reply to this email.
  `

  await sendEmail({
    to: email,
    subject: `Verify Your ${appName} Email`,
    html,
    text,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<void> {
  const appName = process.env.APP_NAME || 'AI Assistant'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Password Reset Request</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              We received a request to reset your password for your ${appName} account.
            </p>
            <p style="font-size: 16px; margin-bottom: 30px;">
              Click the button below to reset your password. This link will expire in 1 hour.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 14px 28px; 
                        text-decoration: none; 
                        border-radius: 5px; 
                        font-weight: bold; 
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `

  const text = `
    Password Reset Request

    Hello,

    We received a request to reset your password for your ${appName} account.

    Click the link below to reset your password. This link will expire in 1 hour.

    ${resetUrl}

    If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

    This is an automated message. Please do not reply to this email.
  `

  await sendEmail({
    to: email,
    subject: `Reset Your ${appName} Password`,
    html,
    text,
  })
}

