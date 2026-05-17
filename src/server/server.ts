import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

import express from 'express';
import cors from 'cors';
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(clerkMiddleware());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Serve static files ONLY (no catch-all route needed)
app.use(express.static(path.join(__dirname, '../../dist')));

// API routes
app.get('/api/protected', (req, res) => {
  const auth = getAuth(req);
  res.json({ message: 'Yo!', user: auth });
});

app.post('/api/user-login', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const dbUser = await prisma.user.upsert({
      where: { clerkId: auth.userId },
      update: {
        email: clerkUser.emailAddresses[0]?.emailAddress,
        full_name: clerkUser.fullName || null,
        username: clerkUser.username,
        last_login: new Date()
      },
      create: {
        clerkId: auth.userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        full_name: clerkUser.fullName || null,
        username: clerkUser.username,
        created_at: new Date(),
        last_login: new Date(),
        user_status: 'STANDARD',
        total_pulls: 0,
        unique_cards: 0,
        wins: 0,
        losses: 0,
        trades_completed: 0,
        purchases_made: 0,
        currency: 0
      }
    });
    
    res.json({ message: 'Verified!', user: dbUser });
  } catch (error) {
    console.error('Error processing user.', error);
    res.status(500).json({ error: 'Failed to process user' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});