import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding database...')

  // Create admin user (email verified by default)
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      emailVerified: true, // Ensure admin is always verified
      role: 'admin', // Ensure role is always admin
    },
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      emailVerified: true, // Admin doesn't need email verification
    },
  })

  console.log('Created/Updated admin user:', admin.email)
  console.log('  Email: admin@example.com')
  console.log('  Password: admin123')
  console.log('  Role: admin')
  console.log('  Email Verified: true')

  // Create test user (email verified for testing)
  const userPassword = await bcrypt.hash('user123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      emailVerified: true, // Keep test user verified
    },
    create: {
      email: 'user@example.com',
      password: userPassword,
      name: 'Test User',
      role: 'user',
      status: 'active',
      emailVerified: true, // Test user verified for convenience
    },
  })

  console.log('Created/Updated test user:', user.email)
  console.log('  Email: user@example.com')
  console.log('  Password: user123')
  console.log('  Role: user')
  console.log('  Email Verified: true')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
