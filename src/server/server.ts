import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env first
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { clerkClient, clerkMiddleware, getAuth } from '@clerk/express';

// Import prisma dynamically after env is loaded
const { prisma } = await import('../../lib/prisma.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Clerk middleware - protects routes
app.use(clerkMiddleware()); 

// Connects port server to front end
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// protected API route
app.get('/api/protected', (req, res) => {
  const auth = getAuth(req);
  res.json({ message: 'Yo!', user: auth });
});

// On login
app.post('/api/user-login', async (req, res) => {
    const auth = getAuth(req);
    
    if (!auth.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const clerkUser = await clerkClient.users.getUser(auth.userId);

        const dbUser = await prisma.user.upsert({
            where: {
                clerkId: auth.userId
            },

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

        const isNewUser = (Date.now() - dbUser.created_at.getTime()) < 10000; // Created in last 10 seconds

        res.json({ 
            message: 'Verified!', 
            user: dbUser,
            isNewUser: isNewUser
        });

    } catch (error) {
        console.error('Error processing user. ', error);
        res.status(500).json({ error: 'Failed to process user' })
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
