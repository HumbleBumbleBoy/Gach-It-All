import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Condition, Comparator, Quality, Reward, Enhancement } from "@prisma/client";


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

app.use(express.json());

app.use(clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY
}));

app.use(cors({
  origin: ['https://gatchitall.com', 'https://www.gatchitall.com', 'http://localhost:5173'],
  credentials: true
}));

app.use((_req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});

// ----------------- helper functions

async function grantReward(userId: number, rewardType: Reward, rewardValue: string) {
  switch (rewardType) {
    case Reward.CURRENCY:
      await prisma.user.update({
        where: { id: userId },
        data: { currency: { increment: parseFloat(rewardValue) } }
      });
      break;
      
    case Reward.CARD:
      const qualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
      const qualityWeights = [20, 30, 30, 15, 5]; // percentages
      const randomNum = Math.random() * 100;
      let cumulative = 0;
      let selectedQuality = qualities[0];
      for (let i = 0; i < qualityWeights.length; i++) {
        cumulative += qualityWeights[i];
        if (randomNum <= cumulative) {
          selectedQuality = qualities[i];
          break;
        }
      }
      
      const enhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
      const enhancementWeights = [85, 10, 4, 1];  // percentages
      let enhancementCumulative = 0;
      let selectedEnhancement = enhancements[0];
      const enhancementRandom = Math.random() * 100;
      for (let i = 0; i < enhancementWeights.length; i++) {
        enhancementCumulative += enhancementWeights[i];
        if (enhancementRandom <= enhancementCumulative) {
          selectedEnhancement = enhancements[i];
          break;
        }
      }
      
      await prisma.userCards.create({
        data: {
          user_id: userId,
          card_template_id: parseInt(rewardValue),
          quality: selectedQuality as Quality,
          enhancement: selectedEnhancement as Enhancement,
        }
      });
      break;
      
    case Reward.PACK:
      await prisma.userInventory.create({
        data: {
          user_id: userId,
          item_type: 'PACK',
          reference_id: parseInt(rewardValue),
          quantity: 1
        }
      });
      break;
      
    case Reward.COSMETIC:
      await prisma.userInventory.create({
        data: {
          user_id: userId,
          item_type: 'ITEM',
          reference_id: parseInt(rewardValue),
          quantity: 1
        }
      });
      break;
  }
}

async function checkAndUpdateAchievements(userId: number, triggerCondition: Condition) {
  const achievements = await prisma.achievement.findMany({
    where: { condition: triggerCondition }
  });
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userStats: true }
  });
  
  if (!user || !user.userStats) return;
  
  for (const ach of achievements) {
    let currentValue: number = 0;
    let targetValue: number = ach.value_int || ach.value_float || 0;
    
    // Get current value based on condition
    switch (ach.condition) {
      case Condition.WINS:
        currentValue = user.userStats.wins;
        break;
      case Condition.LOSSES:
        currentValue = user.userStats.losses;
        break;
      case Condition.CURRENCY:
        currentValue = user.currency;
        break;
      case Condition.CARDS_COLLECTED:
        currentValue = user.userStats.unique_cards;
        break;
      case Condition.PACKS_OPENED:
        currentValue = user.userStats.total_pulls;
        break;
      case Condition.TRADES_COMPLETED:
        currentValue = user.userStats.trades_completed;
        break;
      case Condition.PLAY_TIME:
        currentValue = user.userStats.total_play_minutes;
        break;
      default:
        currentValue = 0;
    }

    let isComplete = false;
    let progress = 0;
    
    if (targetValue > 0) {
      progress = Math.min(currentValue, targetValue);
      
      switch (ach.comparator) {
        case Comparator.MORE_THAN:
          isComplete = currentValue > targetValue;
          break;
        case Comparator.LESS_THAN:
          isComplete = currentValue < targetValue;
          break;
        case Comparator.EQUAL:
          isComplete = currentValue === targetValue;
          break;
      }
    }
    
    const existing = await prisma.userAchievement.findUnique({
      where: {
        user_id_achievement_id: {
          user_id: userId,
          achievement_id: ach.id
        }
      }
    });
    
    if (existing) {
      await prisma.userAchievement.update({
        where: { id: existing.id },
        data: { progress: progress }
      });
    } else {
      await prisma.userAchievement.create({
        data: {
          user_id: userId,
          achievement_id: ach.id,
          progress: progress
        }
      });
    }
    
    if (progress >= 100 && existing && !existing.completed_at) {
      await prisma.userAchievement.update({
        where: { id: existing.id },
        data: { completed_at: new Date(), progress: 100 }
      });
      await grantReward(userId, ach.reward_type, ach.reward_value);
    }
  }
}

// -------------- API Routes 

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
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    
    if (!email) {
      return res.status(400).json({ error: 'User has no email' });
    }
    
    const dbUser = await prisma.user.upsert({
      where: { clerkId: auth.userId },
      update: {
        email: email,
        full_name: clerkUser.fullName || null,
        username: clerkUser.username,
        last_login: new Date()
      },
      create: {
        clerkId: auth.userId,
        email: email,
        full_name: clerkUser.fullName || null,
        username: clerkUser.username,
        created_at: new Date(),
        last_login: new Date(),
        user_status: 'STANDARD',
        currency: 0,
        userStats: {
          create: {
            total_pulls: 0,
            unique_cards: 0,
            wins: 0,
            losses: 0,
            trades_completed: 0,
            purchases_made: 0
          }
        }
      },
      include: {
        userStats: true
      }
    });

    const today = new Date().toDateString();
    const lastLoginDate = dbUser.userStats?.last_login_date;
    const lastLoginDateString = lastLoginDate ? new Date(lastLoginDate).toDateString() : null;
    
    let newLoginStreak = 1;
    if (lastLoginDateString === today) {
      newLoginStreak = dbUser.userStats?.login_streak || 1;
    } else if (lastLoginDateString === new Date(Date.now() - 86400000).toDateString()) {
      newLoginStreak = (dbUser.userStats?.login_streak || 0) + 1;
    }
    
    await prisma.userStats.upsert({
      where: { user_id: dbUser.id },
      update: {
        login_count: { increment: 1 },
        login_streak: newLoginStreak,
        last_login_date: new Date()
      },
      create: {
        user_id: dbUser.id,
        login_count: 1,
        login_streak: 1,
        last_login_date: new Date(),
        total_pulls: 0,
        unique_cards: 0,
        wins: 0,
        losses: 0,
        trades_completed: 0,
        purchases_made: 0,
        total_play_minutes: 0,
        total_cards_sold: 0,
        consecutive_wins: 0,
        highest_win_streak: 0,
        consecutive_losses: 0,
        highest_lose_streak: 0,
        battle_rating: 1000
      }
    });

    await checkAndUpdateAchievements(dbUser.id, Condition.PLAY_TIME); // update time achievements on login
    
    res.json({ message: 'Verified!', user: dbUser });
  } catch (error) {
    console.error('Error processing user.', error);
    res.status(500).json({ error: 'Failed to process user' });
  }
});

app.get('/api/user/currency', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { currency: true }
  });
  
  res.json({ currency: user?.currency ?? 0 });
});

app.get('/api/user/inventory', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const items = await prisma.userInventory.findMany({
    where: { user_id: user.id }
  });
  
  const itemsWithDetails = await Promise.all(items.map(async (inv) => {
    let details = null;
    if (inv.item_type === 'ITEM') {
      details = await prisma.item.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true }
      });
    } else if (inv.item_type === 'PACK') {
      details = await prisma.pack.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true }
      });
    }
    
    return {
      ...inv,
      name: details?.name || 'Unknown',
      image_url: details?.image_url
    };
  }));
  
  res.json({ items: itemsWithDetails });
});

app.get('/api/cards', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    // Use correct model name: cardTemplates (matches your schema)
    const cardTemplates = await prisma.cardTemplates.findMany();
    
    res.json({ items: cardTemplates });
  } catch (error) {
    console.error('Error fetching card templates:', error);
    res.status(500).json({ error: 'Failed to fetch card templates' });
  }
});

app.get('/api/user/collection', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userCards = await prisma.userCards.findMany({
      where: { user_id: user.id },
      include: {
        cardTemplate: true
      }
    });
    
    res.json({ items: userCards });
  } catch (error) {
    console.error('Error fetching user collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

app.get('/api/achievements', async (_req, res) => {
  const achievements = await prisma.achievement.findMany();
  res.json({ achievements });
});

app.get('/api/user/achievements', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const userAchievements = await prisma.userAchievement.findMany({
    where: { user_id: user.id }
  });
  
  res.json({ userAchievements });
});

app.get('/api/user/stats', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    include: { userStats: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({ stats: user.userStats });
});

app.post('/api/achievements/check', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { condition } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  await checkAndUpdateAchievements(user.id, condition as Condition);
  
  res.json({ success: true });
});

const lastHeartbeat = new Map();
app.post('/api/heartbeat', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const key = `${auth.userId}-${Math.floor(Date.now() / 60000)}`;
  if (lastHeartbeat.has(key)) {
    return res.json({ ok: true, duplicate: true });
  }
  lastHeartbeat.set(key, true);
  
  // Clean old entries
  setTimeout(() => lastHeartbeat.delete(key), 65000);
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (user) {
    await prisma.userStats.update({
      where: { user_id: user.id },
      data: { total_play_minutes: { increment: 1 } }
    });

    checkAndUpdateAchievements(user.id, Condition.PLAY_TIME)
  }
  
  res.json({ ok: true });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '../../dist')));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});