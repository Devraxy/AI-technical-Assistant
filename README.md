This is the [assistant-ui](https://github.com/Yonom/assistant-ui) starter project.

## Getting Started

### Environment Variables

Create a `.env.local` file (or `.env` for production) with the following required variables:

#### Required Variables

```bash
# Database Configuration (Required)
DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"

# OpenAI API Key (Required)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Optional Variables

```bash
# Application Configuration
APP_NAME="AI Assistant"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email Configuration (Required for email verification and password reset)
# Choose ONE of the following options:

# Option 1: Resend (Recommended - Free tier available)
# Get your API key at: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM="AI Assistant <onboarding@resend.dev>"
# Note: Update the email address above to your verified domain in Resend

# Option 2: SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
EMAIL_FROM="AI Assistant <noreply@example.com>"

# Option 3: Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM="AI Assistant <your-email@gmail.com>"
```

**Note for Gmail:** You need to enable 2-Step Verification and generate an App Password from [Google Account Settings](https://myaccount.google.com/apppasswords).

**Note for Resend:** Sign up at [resend.com](https://resend.com) to get a free API key. The free tier includes 3,000 emails/month and 100 emails/day.

### Setup Steps

1. **Set up your database:**

   ```bash
   # Run migrations
   npm run db:migrate

   # (Optional) Seed the database
   npm run db:seed
   ```

2. **Configure environment variables** (see above)

3. **Run the development server:**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Features

### Email Verification

New users must verify their email address before they can log in. After signing up:

1. Users receive a verification email with a link and a 6-digit code
2. They can click the link or enter the code on the verification page
3. Once verified, they are automatically logged in

The verification link expires after 24 hours. Users can request a new verification email if needed.
