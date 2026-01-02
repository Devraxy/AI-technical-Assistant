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
        throw new Error(`Échec de l'envoi de l'email : ${error.message}`)
      }
      throw new Error('Échec de l\'envoi de l\'email. Veuillez réessayer plus tard.')
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
        throw new Error('Le service email n\'est pas configuré. Veuillez contacter l\'administrateur ou vérifier les logs du serveur pour les détails de configuration.')
      }
      
      console.error('Full error details:', error)
      throw new Error(`Échec de l'envoi de l'email : ${error.message}`)
    }
    
    throw new Error('Échec de l\'envoi de l\'email. Veuillez réessayer plus tard.')
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
          <title>Vérifiez votre email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Vérifiez votre email</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Merci de vous être inscrit à ${appName} ! Veuillez vérifier votre adresse email pour compléter votre inscription.
            </p>
            ${verificationCode ? `
            <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Votre code de vérification :</p>
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
            </div>
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
              Entrez ce code sur la page de vérification, ou cliquez sur le bouton ci-dessous pour vérifier automatiquement.
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
                Vérifier l'adresse email
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Ou copiez et collez ce lien dans votre navigateur :
            </p>
            <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Ce lien expirera dans 24 heures. Si vous n'avez pas créé de compte, veuillez ignorer cet email.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              Ceci est un message automatisé. Veuillez ne pas répondre à cet email.
            </p>
          </div>
        </body>
      </html>
    `

  const text = `
    Vérifiez votre email

    Bonjour,

    Merci de vous être inscrit à ${appName} ! Veuillez vérifier votre adresse email pour compléter votre inscription.

    ${verificationCode ? `Votre code de vérification : ${verificationCode}\n\n` : ''}Cliquez sur le lien ci-dessous pour vérifier votre email :
    ${verificationUrl}

    Ce lien expirera dans 24 heures. Si vous n'avez pas créé de compte, veuillez ignorer cet email.

    Ceci est un message automatisé. Veuillez ne pas répondre à cet email.
  `

  await sendEmail({
    to: email,
    subject: `Vérifiez votre email ${appName}`,
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
          <title>Réinitialisation du mot de passe</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Demande de réinitialisation du mot de passe</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px; margin-bottom: 20px;">Bonjour,</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte ${appName}.
            </p>
            <p style="font-size: 16px; margin-bottom: 30px;">
              Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe. Ce lien expirera dans 1 heure.
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
                Réinitialiser le mot de passe
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Ou copiez et collez ce lien dans votre navigateur :
            </p>
            <p style="font-size: 12px; color: #667eea; word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Si vous n'avez pas demandé cette réinitialisation de mot de passe, veuillez ignorer cet email. Votre mot de passe restera inchangé.
            </p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
              Ceci est un message automatisé. Veuillez ne pas répondre à cet email.
            </p>
          </div>
        </body>
      </html>
    `

  const text = `
    Demande de réinitialisation du mot de passe

    Bonjour,

    Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte ${appName}.

    Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe. Ce lien expirera dans 1 heure.

    ${resetUrl}

    Si vous n'avez pas demandé cette réinitialisation de mot de passe, veuillez ignorer cet email. Votre mot de passe restera inchangé.

    Ceci est un message automatisé. Veuillez ne pas répondre à cet email.
  `

  await sendEmail({
    to: email,
    subject: `Réinitialisez votre mot de passe ${appName}`,
    html,
    text,
  })
}

