import prisma from '../src/lib/prisma.js';

async function findAdmin() {
  const admins = await prisma.userProfile.findMany({
    where: {
      userRoles: {
        some: {
          role: { name: 'ADMIN' },
        },
      },
    },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });
  console.log('Admins found:', admins.map(a => ({ id: a.id, email: a.email, fullName: a.fullName })));
}

findAdmin().finally(() => prisma.$disconnect());
