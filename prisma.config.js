import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

// Load .env.local first (where local secrets reside), then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
