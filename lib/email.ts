import nodemailer from 'nodemailer'

// Email transporter configuration
// Supports SMTP, Gmail, and other email services via environment variables
function createTransporter() {
  // If SMTP is configured, use it
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }

  // Fallback: Use Gmail OAuth or app password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }

  // Development: Use a mock transporter that logs emails instead of sending
  if (process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Email configuration not found. Using mock transporter in development mode.')
    console.warn('   Emails will be logged to console instead of being sent.')
    console.warn('   To send real emails, configure SMTP or Gmail environment variables.')
    
    // Return a mock transporter that doesn't actually send emails
    return nodemailer.createTransport({
      jsonTransport: true, // This makes it return the email as JSON instead of sending
    })
  }

  throw new Error('Email configuration is missing. Please set SMTP or Gmail environment variables.')
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  resetUrl: string
): Promise<void> {
  const transporter = createTransporter()
  const appName = process.env.APP_NAME || 'AI Assistant'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"${appName}" <noreply@example.com>`,
    to: email,
    subject: `Reset Your ${appName} Password`,
    html: `
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
    `,
    text: `
      Password Reset Request

      Hello,

      We received a request to reset your password for your ${appName} account.

      Click the link below to reset your password. This link will expire in 1 hour.

      ${resetUrl}

      If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

      This is an automated message. Please do not reply to this email.
    `,
  }

  try {
    const result = await transporter.sendMail(mailOptions)
    
    // In development with mock transporter, log the email details
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST && !process.env.GMAIL_USER) {
      console.log('\n📧 Password Reset Email (Development Mode - Not Actually Sent):')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`To: ${email}`)
      console.log(`Subject: ${mailOptions.subject}`)
      console.log(`Reset URL: ${resetUrl}`)
      console.log(`Reset Token: ${resetToken}`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    throw new Error('Failed to send password reset email')
  }
}

