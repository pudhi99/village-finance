import prisma from '../src/lib/prisma.js';

async function listUsers() {
  const users = await prisma.userProfile.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      userRoles: {
        select: {
          role: { select: { name: true } },
        },
      },
    },
  });
  console.log(JSON.stringify(users, null, 2));
}

listUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
