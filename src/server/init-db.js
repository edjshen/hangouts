const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function init() {
  try {
    // Test connection and create tables if needed
    await prisma.$connect();
    console.log('Database connected');
    
    // Create a demo user if none exists
    const count = await prisma.user.count();
    if (count === 0) {
      console.log('Creating demo user...');
      await prisma.user.create({
        data: {
          id: 'demo-user',
          email: 'demo@hang.app',
          name: 'Demo User',
          status: 'OFFLINE'
        }
      });
    }
    
    await prisma.$disconnect();
    console.log('Database initialized');
  } catch (e) {
    console.error('Database init failed:', e.message);
    process.exit(1);
  }
}

init();
