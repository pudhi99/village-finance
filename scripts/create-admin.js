/**
 * Create or Promote Master Administrator — Village Finance
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-admin.js <email> <fullName> <password>
 *
 * Example:
 *   node --env-file=.env.local scripts/create-admin.js admin@example.com "Business Owner" "SecurePassword123!"
 */
import prisma from '../src/lib/prisma.js';
import { createClient } from '@supabase/supabase-js';

const [email, fullName, password] = process.argv.slice(2);

if (!email || !fullName || !password) {
  console.error('\n❌ Error: Missing required arguments.');
  console.log('Usage:');
  console.log('  node --env-file=.env.local scripts/create-admin.js <email> "<Full Name>" "<Password>"\n');
  process.exit(1);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n1. Creating/fetching Supabase Auth account for: ${email}...`);
  let authUserId = null;

  // Check if user already exists in auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (signUpError) {
    if (signUpError.message?.toLowerCase().includes('already registered')) {
      console.log('   User already exists in Supabase Auth. Searching profile...');
      const existingProfile = await prisma.userProfile.findUnique({ where: { email } });
      if (existingProfile) {
        authUserId = existingProfile.id;
      } else {
        throw new Error(`Auth account exists. Please sign in or reset password in Supabase dashboard.`);
      }
    } else {
      throw signUpError;
    }
  } else {
    authUserId = signUpData.user?.id;
    console.log(`   Auth account created successfully! User ID: ${authUserId}`);
  }

  console.log(`2. Ensuring UserProfile in PostgreSQL...`);
  const profile = await prisma.userProfile.upsert({
    where: { email },
    update: {
      fullName,
      status: 'ACTIVE',
    },
    create: {
      id: authUserId,
      email,
      fullName,
      status: 'ACTIVE',
    },
  });

  console.log(`3. Assigning ADMIN role...`);
  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('ADMIN role not found. Please run: node --env-file=.env.local prisma/seed.js first.');
  }

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
      grantedBy: profile.id,
    },
  });

  console.log(`4. Granting full system-wide data scope...`);
  const existingScope = await prisma.userDataScope.findFirst({
    where: { userId: profile.id, scopeType: 'ALL' },
  });

  if (!existingScope) {
    await prisma.userDataScope.create({
      data: {
        userId: profile.id,
        scopeType: 'ALL',
        scopeValue: '*',
      },
    });
  }

  console.log('\n======================================================');
  console.log('🎉 Master Administrator Created Successfully!');
  console.log(`   Email:    ${email}`);
  console.log(`   Name:     ${fullName}`);
  console.log(`   Role:     ADMIN (Full unrestricted system access)`);
  console.log('======================================================\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
