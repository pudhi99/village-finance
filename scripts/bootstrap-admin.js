/**
 * Bootstrap First Admin Account — Village Finance
 *
 * Usage:
 *   node --env-file=.env.local scripts/bootstrap-admin.js <email> <password> "<Full Name>"
 *
 * Example:
 *   node --env-file=.env.local scripts/bootstrap-admin.js admin@villagefinance.local AdminPass123! "Master Administrator"
 */
import { createClient } from '@supabase/supabase-js';
import prisma from '../src/lib/prisma.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const email = process.argv[2] || 'admin@villagefinance.local';
const password = process.argv[3] || 'VillageAdmin@2026!';
const fullName = process.argv[4] || 'System Administrator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function bootstrap() {
  console.log(`\n========================================`);
  console.log(`Village Finance — Admin Bootstrap`);
  console.log(`========================================`);
  console.log(`Email:     ${email}`);
  console.log(`Full Name: ${fullName}`);
  console.log(`----------------------------------------`);

  // 1. Sign up user in Supabase Auth
  console.log('1. Creating user in Supabase Auth...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  let userId = authData?.user?.id;

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('   User already exists in Supabase Auth, looking up ID in database...');
      const existing = await prisma.userProfile.findUnique({ where: { email } });
      if (existing) {
        userId = existing.id;
      } else {
        console.error('   Error: User is registered in Supabase Auth but not in UserProfile. Please sign in or use a different email.');
        process.exit(1);
      }
    } else {
      console.error('   Supabase Auth error:', authError.message);
      process.exit(1);
    }
  }

  if (!userId) {
    console.error('   Failed to obtain Supabase Auth user ID.');
    process.exit(1);
  }

  console.log(`   User ID: ${userId}`);

  // 2. Upsert UserProfile in database
  console.log('2. Provisioning UserProfile in database...');
  const profile = await prisma.userProfile.upsert({
    where: { id: userId },
    update: {
      email,
      fullName,
      status: 'ACTIVE',
    },
    create: {
      id: userId,
      email,
      fullName,
      status: 'ACTIVE',
    },
  });

  // 3. Ensure ADMIN role exists
  console.log('3. Assigning ADMIN role...');
  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    console.error('   ADMIN role not found. Please run: node --env-file=.env.local prisma/seed.js');
    process.exit(1);
  }

  // Assign ADMIN role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: profile.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: profile.id,
      roleId: adminRole.id,
    },
  });

  // Grant ALL data scope
  await prisma.userDataScope.upsert({
    where: {
      userId_scopeType_scopeValue: {
        userId: profile.id,
        scopeType: 'ALL',
        scopeValue: '*',
      },
    },
    update: {},
    create: {
      userId: profile.id,
      scopeType: 'ALL',
      scopeValue: '*',
    },
  });

  // 4. Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: profile.id,
      action: 'ADMIN_BOOTSTRAP',
      entityType: 'UserProfile',
      entityId: profile.id,
      metadata: {
        email,
        fullName,
        role: 'ADMIN',
      },
    },
  });

  console.log('\n✅ Admin account successfully created and provisioned!');
  console.log(`Credentials:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`\nYou can now log in at http://localhost:3000/login\n`);
}

bootstrap()
  .catch((e) => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
