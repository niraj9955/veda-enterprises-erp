/**
 * One-time migration script: updates the existing admin user's email
 * from admin@veda.com → dataanalogydirector@gmail.com.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." bun run scripts/migrate-admin-email.ts
 *
 * Safe to re-run — idempotent. If the admin user already has the new email,
 * the script reports "already migrated" and exits 0.
 */
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/veda-erp'
const OLD_EMAIL = 'admin@veda.com'
const NEW_EMAIL = 'dataanalogydirector@gmail.com'

async function main() {
  console.log(`Connecting to ${MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}...`)
  await mongoose.connect(MONGODB_URI)
  console.log('Connected.')

  const db = mongoose.connection.db
  if (!db) throw new Error('No db handle')

  const users = db.collection('users')

  // 1. Check if a user with the new email already exists
  const existing = await users.findOne({ email: NEW_EMAIL })
  if (existing) {
    console.log(`✓ User with email ${NEW_EMAIL} already exists (id=${existing._id}). Nothing to do.`)
    await mongoose.disconnect()
    return
  }

  // 2. Find the old admin
  const admin = await users.findOne({ email: OLD_EMAIL })
  if (!admin) {
    console.log(`✗ No user found with email ${OLD_EMAIL}. Cannot migrate.`)
    console.log('  → Either the DB is empty, or the admin already uses a different email.')
    console.log('  → If the DB is fresh, the /api/auth/init route will seed the admin with the new email automatically.')
    await mongoose.disconnect()
    process.exit(1)
  }

  // 3. Update email
  const result = await users.updateOne(
    { _id: admin._id },
    { $set: { email: NEW_EMAIL, updatedAt: new Date() } }
  )
  if (result.modifiedCount === 1) {
    console.log(`✓ Admin email updated: ${OLD_EMAIL} → ${NEW_EMAIL}`)
    console.log(`  User id: ${admin._id}`)
    console.log(`  Name:    ${admin.name}`)
    console.log(`  Role:    ${admin.role}`)
    console.log('')
    console.log('You can now log in with dataanalogydirector@gmail.com (password unchanged).')
    console.log('To reset the password via OTP, click "Forgot Password?" on the login page.')
  } else {
    console.log('✗ Update failed — no documents modified.')
    process.exit(1)
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
