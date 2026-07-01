const { PrismaClient } = require('@prisma/client');

// Singleton do Prisma — evita múltiplas conexões em hot-reload
const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

module.exports = prisma;
