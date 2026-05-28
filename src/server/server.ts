import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Condition, Comparator, Quality, Reward, Enhancement, UserStatus, Rarity } from "@prisma/client";
import type { Pack, CardTemplates } from "@prisma/client";


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
      await updateCurrency(userId, parseFloat(rewardValue), 'gain');
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
      
    case Reward.STATUS:
      await prisma.user.update({
        where: { id: userId },
        data: { user_status: rewardValue as UserStatus }
      });
      break;
  }
}

async function updateCurrency(userId: number, amount: number, type: 'gain' | 'spend'): Promise<void> {
  const roundedAmount = roundCurrency(amount);
  
  if (type === 'gain') {
    await prisma.userStats.update({
      where: { user_id: userId },
      data: { total_currency_gained: { increment: roundedAmount } }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { currency: { increment: roundedAmount } }
    });
  } else {
    await prisma.userStats.update({
      where: { user_id: userId },
      data: { total_currency_spent: { increment: roundedAmount } }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { currency: { decrement: roundedAmount } }
    });
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
    let targetValue: number = ach.value_int ?? ach.value_float ?? 0;
    
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
      case Condition.CARDS_SOLD:
        currentValue = user.userStats.total_cards_sold;
        break;
      case Condition.CURRENCY_SPENT:
        currentValue = user.userStats.total_currency_spent;
        break;
      case Condition.CURRENCY_GAINED:
        currentValue = user.userStats.total_currency_gained;
        break;
      case Condition.PURCHASES_MADE:
        currentValue = user.userStats.purchases_made;
        break;
      case Condition.ENHANCED_CARDS:
        const enhancedCards = await prisma.userCards.count({
          where: { user_id: userId, enhancement: { not: 'BASIC' } }
        });
        currentValue = enhancedCards;
        break;
      default:
        currentValue = 0;
    }

    let isComplete = false;
    let progress = Math.min(currentValue, targetValue);
    
    // Always check completion regardless of targetValue
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
      case Comparator.MORE_OR_EQUAL:
        isComplete = currentValue >= targetValue;
        break;
      case Comparator.LESS_OR_EQUAL:
        isComplete = currentValue <= targetValue;
        break;
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
      // Only update if progress changed
      if (existing.progress !== progress) {
        await prisma.userAchievement.update({
          where: { id: existing.id },
          data: { progress: progress }
        });
      }
    } else {
      await prisma.userAchievement.create({
        data: {
          user_id: userId,
          achievement_id: ach.id,
          progress: progress
        }
      });
    }
    
    // Check if completed (either just completed or was already completed)
    const justCompleted = isComplete && (!existing || (existing && !existing.completed_at));
    
    if (justCompleted) {
      const record = existing || await prisma.userAchievement.findUnique({
        where: {
          user_id_achievement_id: {
            user_id: userId,
            achievement_id: ach.id
          }
        }
      });
      
      if (record && !record.completed_at) {
        await prisma.userAchievement.update({
          where: { id: record.id },
          data: { completed_at: new Date(), progress: 100 }
        });
        await grantReward(userId, ach.reward_type, ach.reward_value);
        
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: { clerkId: true }
        });
        if (userData) {
          sendAchievementNotification(userData.clerkId, ach.name, `${ach.reward_type}: ${ach.reward_value}`);
        }
      }
    }
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

interface StatRange {
  min: number;
  max: number;
}

interface RarityStats {
  hp: StatRange;
  def: StatRange;
  atk: StatRange;
  price: StatRange;
}

const FALLBACK_STATS: Record<string, RarityStats> = {
  COMMON: {
    hp: { min: 30, max: 100 },
    def: { min: 0, max: 20 },
    atk: { min: 1, max: 25 },
    price: { min: 0.01, max: 0.30 }
  },
  UNCOMMON: {
    hp: { min: 110, max: 180 },
    def: { min: 15, max: 35 },
    atk: { min: 20, max: 40 },
    price: { min: 0.70, max: 1.10 }
  },
  SPARSE: {
    hp: { min: 150, max: 250 },
    def: { min: 20, max: 45 },
    atk: { min: 35, max: 60 },
    price: { min: 2.00, max: 3.00 }
  },
  RARE: {
    hp: { min: 300, max: 400 },
    def: { min: 30, max: 60 },
    atk: { min: 40, max: 90 },
    price: { min: 6.00, max: 9.00 }
  },
  UBER_RARE: {
    hp: { min: 300, max: 650 },
    def: { min: 20, max: 100 },
    atk: { min: 30, max: 125 },
    price: { min: 7.00, max: 14.00 }
  },
  MYTHICAL: {
    hp: { min: 550, max: 950 },
    def: { min: 40, max: 120 },
    atk: { min: 60, max: 150 },
    price: { min: 20.00, max: 35.00 }
  },
  LEGENDARY: {
    hp: { min: 750, max: 1250 },
    def: { min: 50, max: 150 },
    atk: { min: 100, max: 200 },
    price: { min: 50.00, max: 100.00 }
  },
  SPECIAL: {
    hp: { min: 1000, max: 2000 },
    def: { min: 200, max: 300 },
    atk: { min: 250, max: 350 },
    price: { min: 250.00, max: 1000.00 }
  }
};

function weightedRandom(min: number, max: number, skew: number = 1): number {
  // normal distribution
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Normalize to ~[-1, 1] range
  num = num / 4.0;
  // Apply skew (positive skew pushes values higher)
  if (skew !== 1) {
    num = Math.pow((num + 1) / 2, skew) * 2 - 1;
  }

  return min + (num + 1) / 2 * (max - min);
}

function calculateSkew(price: number, priceRange: StatRange): number {
  const percent = (price - priceRange.min) / (priceRange.max - priceRange.min);
  // Lower price = higher skew (pushes stats toward min)
  // Higher price = lower skew (pushes stats toward max)
  return 2.0 - (0.5 + (percent * 1.5));
}

function generateFallbackStats(rarity: string, existingStats?: {
  hp?: number;
  atk?: number;
  def?: number;
  price?: number;
}): { hp: number; atk: number; def: number; price: number } {
  const ranges = FALLBACK_STATS[rarity] || FALLBACK_STATS.COMMON;
  
  // Generate price first (it determines skew for other stats)
  let price = existingStats?.price;
  if (!price) {
    price = roundCurrency(weightedRandom(ranges.price.min, ranges.price.max, 1));
  }

  const skew = calculateSkew(price, ranges.price);
  
  // Generate stats with price-based skew
  const hp = existingStats?.hp ?? Math.round(weightedRandom(ranges.hp.min, ranges.hp.max, skew));
  const atk = existingStats?.atk ?? Math.round(weightedRandom(ranges.atk.min, ranges.atk.max, skew));
  const def = existingStats?.def ?? Math.round(weightedRandom(ranges.def.min, ranges.def.max, skew));
  
  return { hp, atk, def, price: roundCurrency(price) };
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
    await checkAndUpdateAchievements(dbUser.id, Condition.TOTAL_LOGINS);  // update login achievements on login

    // Check if user already has the badge
    const hasBadge = await prisma.userInventory.findFirst({
      where: {
        user_id: dbUser.id,
        item_type: 'ITEM',
        reference_id: 5
      }
    });

    if (!hasBadge) {
      await prisma.userInventory.create({
        data: {
          user_id: dbUser.id,
          item_type: 'ITEM',
          reference_id: 5,
          quantity: 1,
          acquired_at: dbUser.created_at
        }
      });
    }
    
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

app.post('/api/user/currency', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { amount } = req.body; // positive = gain, negative = spend
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  if (amount > 0) {
    await updateCurrency(user.id, amount, 'gain');
  } else if (amount < 0) {
    await updateCurrency(user.id, Math.abs(amount), 'spend');
  }
  
  res.json({ success: true, amount });
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
    let sellPrice = 0;
    let canSell = false;
    
    if (inv.item_type === 'ITEM') {
      details = await prisma.item.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true, description: true, price: true, can_sell: true }
      });
      if (details) {
        canSell = details.can_sell || false;
        if (canSell) {
          sellPrice = details.price * 0.5;
        }
      }
    } else if (inv.item_type === 'PACK') {
      details = await prisma.pack.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true, description: true, price: true }
      });
      if (details) {
        // All packs can be sold
        canSell = true;
        sellPrice = details.price * 0.8; // 80% of pack price
      }
    }
    
    return {
      ...inv,
      name: details?.name || 'Unknown',
      image_url: details?.image_url,
      description: details?.description || '',
      sell_price: sellPrice,
      can_sell: canSell
    };
  }));
  
  res.json({ items: itemsWithDetails });
});

app.get('/api/cards', async (_req, res) => {
  try {
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

app.post('/api/user/reset-collection', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await prisma.userCards.deleteMany({
      where: { user_id: user.id }
    });
    
    await prisma.userStats.update({
      where: { user_id: user.id },
      data: {
        unique_cards: 0,
        total_cards_sold: 0
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reset error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset progress';
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/user/clear-all-data', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Delete in correct order to avoid foreign key constraints
    await prisma.userCards.deleteMany({ where: { user_id: user.id } });
    await prisma.userInventory.deleteMany({ where: { user_id: user.id } });
    await prisma.userAchievement.deleteMany({ where: { user_id: user.id } });
    await prisma.userStats.deleteMany({ where: { user_id: user.id } });
    
    // Reset user currency to 0
    await prisma.user.update({
      where: { id: user.id },
      data: { currency: 0 }
    });
    
    // Create fresh stats record
    await prisma.userStats.create({
      data: {
        user_id: user.id,
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
    
    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset all data';
    res.status(500).json({ error: errorMessage });
  }
});

app.get('/api/achievements', async (_req, res) => {
  const achievements = await prisma.achievement.findMany();
  res.json({ achievements });
});

const clients = new Map<string, any>(); // active connections

app.get('/api/events/achievements', (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  clients.set(auth.userId, res);
  
  req.on('close', () => {
    clients.delete(auth.userId);
  });
});

function sendAchievementNotification(userId: string, achievementName: string, reward: string) {
  const client = clients.get(userId);
  if (client) {
    client.write(`data: ${JSON.stringify({ achievement: achievementName, reward })}\n\n`);
  }
}

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

app.post('/api/cards/sell', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { cardId } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get card with user in one query
      const card = await tx.userCards.findFirst({
        where: { 
          id: cardId, 
          user: { clerkId: auth.userId }
        },
        include: { cardTemplate: true, user: { select: { id: true, currency: true } } }
      });
      
      if (!card) throw new Error('Card not found');
      
      const qualityMultipliers = { TARNISHED: 0.3, POOR: 0.66, REGULAR: 1, GOOD: 1.25, CRISP: 1.5 };
      const enhancementMultipliers = { BASIC: 1, FOILED: 1.25, SHINY: 1.5, SIGNED: 2 };
      
      const sellPrice = roundCurrency(card.cardTemplate.base_price * 
        (qualityMultipliers[card.quality] || 1) * 
        (enhancementMultipliers[card.enhancement] || 1) * 0.9);
      
      // Update everything in parallel
      await Promise.all([
        tx.user.update({
          where: { id: card.user.id },
          data: { currency: { increment: sellPrice } }
        }),
        tx.userStats.update({
          where: { user_id: card.user.id },
          data: { 
            total_currency_gained: { increment: sellPrice },
            total_cards_sold: { increment: 1 }
          }
        }),
        tx.userCards.delete({ where: { id: cardId } })
      ]);
      
      // Get updated unique count - FIXED
      const uniqueTemplates = await tx.userCards.findMany({
        where: { user_id: card.user.id },
        select: { card_template_id: true },
        distinct: ['card_template_id']
      });
      
      await tx.userStats.update({
        where: { user_id: card.user.id },
        data: { unique_cards: uniqueTemplates.length }
      });
      
      return { sellPrice, newCurrency: card.user.currency + sellPrice, userId: card.user.id };
    });
    
    // Async achievements (don't await to speed up response)
    Promise.all([
      checkAndUpdateAchievements(result.userId, Condition.CARDS_SOLD),
      checkAndUpdateAchievements(result.userId, Condition.CARDS_COLLECTED)
    ]).catch(console.error);
    
    res.json({ success: true, sellPrice: result.sellPrice, newCurrency: result.newCurrency });
    
  } catch (error) {
    console.error('Failed to sell card:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sell card';
    res.status(500).json({ error: errorMessage });
  }
});

app.post('/api/cards/batch-sell', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { cardIds } = req.body;
  
  if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
    return res.status(400).json({ error: 'No cards to sell' });
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get all cards with user in one query
      const cards = await tx.userCards.findMany({
        where: { 
          id: { in: cardIds },
          user: { clerkId: auth.userId }
        },
        include: { cardTemplate: true, user: { select: { id: true, currency: true } } }
      });
      
      if (cards.length === 0) throw new Error('No valid cards found');
      
      const qualityMultipliers = { TARNISHED: 0.3, POOR: 0.66, REGULAR: 1, GOOD: 1.25, CRISP: 1.5 };
      const enhancementMultipliers = { BASIC: 1, FOILED: 1.25, SHINY: 1.5, SIGNED: 2 };
      
      let totalSellPrice = 0;
      for (const card of cards) {
        const sellPrice = roundCurrency(card.cardTemplate.base_price * 
          (qualityMultipliers[card.quality] || 1) * 
          (enhancementMultipliers[card.enhancement] || 1) * 0.9);
        totalSellPrice += sellPrice;
      }
      
      // Update everything in parallel
      await Promise.all([
        tx.user.update({
          where: { id: cards[0].user.id },
          data: { currency: { increment: totalSellPrice } }
        }),
        tx.userStats.update({
          where: { user_id: cards[0].user.id },
          data: { 
            total_currency_gained: { increment: totalSellPrice },
            total_cards_sold: { increment: cards.length }
          }
        }),
        tx.userCards.deleteMany({
          where: { id: { in: cardIds } }
        })
      ]);
      
      // Get updated unique count
      const uniqueTemplates = await tx.userCards.findMany({
        where: { user_id: cards[0].user.id },
        select: { card_template_id: true },
        distinct: ['card_template_id']
      });
      
      await tx.userStats.update({
        where: { user_id: cards[0].user.id },
        data: { unique_cards: uniqueTemplates.length }
      });
      
      return { totalSellPrice, cardCount: cards.length, userId: cards[0].user.id };
    });
    
    // Async achievements
    Promise.all([
      checkAndUpdateAchievements(result.userId, Condition.CARDS_SOLD),
      checkAndUpdateAchievements(result.userId, Condition.CARDS_COLLECTED)
    ]).catch(console.error);
    
    res.json({ success: true, totalSellPrice: result.totalSellPrice, cardCount: result.cardCount });
    
  } catch (error) {
    console.error('Failed to sell cards:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sell cards';
    res.status(500).json({ error: errorMessage });
  }
});

app.get('/api/packs', async (_req, res) => {
  try {
    const packs = await prisma.pack.findMany({
      where: { is_available: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        image_url: true,
        cards_count: true
      }
    });
    res.json({ packs });
  } catch (error) {
    console.error('Error fetching packs:', error);
    res.status(500).json({ error: 'Failed to fetch packs' });
  }
});

app.post('/api/gacha/pack', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { packId } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, currency: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const pack = await prisma.pack.findUnique({
    where: { id: packId, is_available: true }
  });
  
  if (!pack) return res.status(404).json({ error: 'Pack not found' });
  
  // Check if user has pack in inventory
  const inventoryPack = await prisma.userInventory.findFirst({
    where: {
      user_id: user.id,
      item_type: 'PACK',
      reference_id: packId,
      quantity: { gt: 0 }
    }
  });
  
  // If pack is from inventory (not purchased directly)
  if (inventoryPack) {
    // Decrement or remove from inventory
    if (inventoryPack.quantity === 1) {
      await prisma.userInventory.delete({ where: { id: inventoryPack.id } });
    } else {
      await prisma.userInventory.update({
        where: { id: inventoryPack.id },
        data: { quantity: { decrement: 1 } }
      });
    }
  } 
  // Otherwise, check if user can buy with currency
  else if (pack.price > 0) {
    if (user.currency < pack.price) {
      return res.status(400).json({ error: 'Insufficient currency' });
    }
    await updateCurrency(user.id, pack.price, 'spend');
  }

  const cards = await generatePackCards(pack, user.id);

  await prisma.userStats.update({
    where: { user_id: user.id },
    data: { 
      total_pulls: { increment: 1 }
    }
  });
  
  // Check unique cards count
  const uniqueCardTemplates = await prisma.userCards.findMany({
    where: { user_id: user.id },
    select: { card_template_id: true },
    distinct: ['card_template_id']
  });
  
  await prisma.userStats.update({
    where: { user_id: user.id },
    data: { unique_cards: uniqueCardTemplates.length }
  });
  
  await checkAndUpdateAchievements(user.id, Condition.PACKS_OPENED);
  await checkAndUpdateAchievements(user.id, Condition.CARDS_COLLECTED);
  
  res.json({ success: true, cards, packName: pack.name });
});

async function generatePackCards(pack: Pack, userId: number) {
  const pulledCards: any[] = [];

  // Get all card templates that match the pack criteria
  let availableCards = await prisma.cardTemplates.findMany();
  
  // Filter by included criteria
  if (pack.included_series && Array.isArray(pack.included_series)) {
    const includedSeries = pack.included_series as any[];
    availableCards = availableCards.filter(card => 
      includedSeries.includes(card.series)
    );
  }

  if (pack.included_types && Array.isArray(pack.included_types)) {
    const includedTypes = pack.included_types as any[];
    availableCards = availableCards.filter(card => 
      includedTypes.includes(card.type)
    );
  }

  if (pack.excluded_series && Array.isArray(pack.excluded_series)) {
    const excludedSeries = pack.excluded_series as any[];
    availableCards = availableCards.filter(card => 
      !excludedSeries.includes(card.series)
    );
  }

  const guaranteedCards: CardTemplates[] = [];
  if (pack.guaranteed_card_ids && pack.guaranteed_count > 0) {
    let guaranteedIds: number[] = [];
    
    if (typeof pack.guaranteed_card_ids === 'number') {
      guaranteedIds = [pack.guaranteed_card_ids];
    } else if (typeof pack.guaranteed_card_ids === 'string') {
      try {
        const parsed = JSON.parse(pack.guaranteed_card_ids);
        guaranteedIds = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        guaranteedIds = pack.guaranteed_card_ids.split(',').map(Number);
      }
    } else if (Array.isArray(pack.guaranteed_card_ids)) {
      guaranteedIds = pack.guaranteed_card_ids as number[];
    }
    
    for (let i = 0; i < Math.min(pack.guaranteed_count, guaranteedIds.length); i++) {
      const guaranteedCard = await prisma.cardTemplates.findUnique({
        where: { id: guaranteedIds[i] }
      });
      if (guaranteedCard) {
        guaranteedCards.push(guaranteedCard);
      } else {
      }
    }
  }

  // Calculate remaining cards to pull
  const remainingCards = pack.cards_count - guaranteedCards.length;
  
  // Roll for remaining cards
  for (let i = 0; i < remainingCards; i++) {
    const rarity = determineRarity(pack);
    const cardsOfRarity = availableCards.filter(card => card.rarity === rarity);
    
    if (cardsOfRarity.length === 0) {
      // Fallback to any card if no cards of that rarity exist
      const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
      const cardWithQuality = await applyQualityAndEnhancement(randomCard, pack, userId);
      pulledCards.push(cardWithQuality);
    } else {
      const randomCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
      const cardWithQuality = await applyQualityAndEnhancement(randomCard, pack, userId);
      pulledCards.push(cardWithQuality);
    }
  }
  
  // Add guaranteed cards (also apply quality/enhancement)
  for (const guaranteedCard of guaranteedCards) {
    const cardWithQuality = await applyQualityAndEnhancement(guaranteedCard, pack, userId);
    pulledCards.push(cardWithQuality);
  }
  
  return pulledCards;
}

function determineRarity(pack: Pack): string {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  const rarities = [
    { name: 'COMMON', rate: pack.common_rate },
    { name: 'UNCOMMON', rate: pack.uncommon_rate },
    { name: 'SPARSE', rate: pack.sparse_rate },
    { name: 'RARE', rate: pack.rare_rate },
    { name: 'UBER_RARE', rate: pack.uber_rare_rate },
    { name: 'MYTHICAL', rate: pack.mythical_rate },
    { name: 'LEGENDARY', rate: pack.legendary_rate },
    { name: 'SPECIAL', rate: pack.special_rate }
  ];
  
  for (const rarity of rarities) {
    cumulative += rarity.rate;
    if (random <= cumulative) {
      return rarity.name;
    }
  }
  
  return 'COMMON';
}

async function applyQualityAndEnhancement(card: CardTemplates, pack: Pack, userId: number) {
  // Generate fallback stats if card template stats are missing
  const needsFallback = !card.base_hp || !card.base_atk || !card.base_def || !card.base_price;
  let finalStats = {
    hp: card.base_hp,
    atk: card.base_atk,
    def: card.base_def,
    price: card.base_price
  };
  
  if (needsFallback) {
    const fallbackStats = generateFallbackStats(card.rarity, {
      hp: card.base_hp || undefined,
      atk: card.base_atk || undefined,
      def: card.base_def || undefined,
      price: card.base_price || undefined
    });
    
    finalStats = fallbackStats;
    
    // Update the card template in DB for future use
    await prisma.cardTemplates.update({
      where: { id: card.id },
      data: {
        base_hp: finalStats.hp,
        base_atk: finalStats.atk,
        base_def: finalStats.def,
        base_price: finalStats.price
      }
    });
  }
  
  // Determine quality
  const qualityRandom = Math.random() * 100;
  let quality: Quality = Quality.REGULAR;
  let qualityCumulative = 0;
  
  const qualities = [
    { name: Quality.TARNISHED, rate: pack.tarnished_rate },
    { name: Quality.POOR, rate: pack.poor_rate },
    { name: Quality.REGULAR, rate: pack.regular_rate },
    { name: Quality.GOOD, rate: pack.good_rate },
    { name: Quality.CRISP, rate: pack.crisp_rate }
  ];
  
  for (const q of qualities) {
    qualityCumulative += q.rate;
    if (qualityRandom <= qualityCumulative) {
      quality = q.name;
      break;
    }
  }
  
  // Determine enhancement
  const enhancementRandom = Math.random() * 100;
  let enhancement: Enhancement = Enhancement.BASIC;
  let enhancementCumulative = 0;
  
  const enhancements = [
    { name: Enhancement.BASIC, rate: pack.basic_rate },
    { name: Enhancement.FOILED, rate: pack.foiled_rate },
    { name: Enhancement.SHINY, rate: pack.shiny_rate },
    { name: Enhancement.SIGNED, rate: pack.signed_rate }
  ];
  
  for (const e of enhancements) {
    enhancementCumulative += e.rate;
    if (enhancementRandom <= enhancementCumulative) {
      enhancement = e.name;
      break;
    }
  }
  
  // Save to database
  const userCard = await prisma.userCards.create({
    data: {
      user_id: userId,
      card_template_id: card.id,
      quality: quality,
      enhancement: enhancement,
    },
    include: {
      cardTemplate: true
    }
  });
  
  return userCard;
}

app.get('/api/shop/items', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    // Get all available shop items from database
    const dbItems = await prisma.shopItem.findMany({
      where: { is_available: true }
    });
    
    // Separate card slots from regular items
    const regularItems = dbItems.filter(item => 
      item.item_type !== 'CARD_SLOT' && item.item_type !== 'MYTHICAL_CARD'
    );
    
    // Get random cards for card slots
    const cardSlots = [];
    
    // For each rarity tier, get a random card
    const rarities = ['COMMON', 'UNCOMMON', 'SPARSE', 'RARE', 'UBER_RARE'];
    for (const rarity of rarities) {
      const cards = await prisma.cardTemplates.findMany({
        where: { rarity: rarity as Rarity }
      });
      if (cards.length > 0) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        cardSlots.push({
          id: randomCard.id,
          name: randomCard.name,
          description: randomCard.description || `${rarity} card`,
          item_type: 'CARD_SLOT',
          reference_id: randomCard.id,
          price: (randomCard.base_price || 1) * 2,
          image_url: randomCard.image_url,
          rarity: rarity,
          is_available: true
        });
      }
    }
    
    // Get random mythical card - ONLY if exists
    const mythicalCards = await prisma.cardTemplates.findMany({
      where: { rarity: 'MYTHICAL' as Rarity }
    });
    let mythicalSlot = null;
    if (mythicalCards.length > 0) {
      const randomMythical = mythicalCards[Math.floor(Math.random() * mythicalCards.length)];
      mythicalSlot = {
        id: randomMythical.id,
        name: randomMythical.name,
        description: randomMythical.description || 'Mythical card',
        item_type: 'MYTHICAL_CARD',
        reference_id: randomMythical.id,
        price: (randomMythical.base_price || 20) * 2,
        image_url: randomMythical.image_url,
        rarity: 'MYTHICAL',
        is_available: true
      };
    }
    
    // Combine all items - only add mythicalSlot if it exists
    const allItems = [...regularItems, ...cardSlots];
    if (mythicalSlot) {
      allItems.push(mythicalSlot);
    }
    
    res.json({ items: allItems });
  } catch (error) {
    console.error('Failed to fetch shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

app.post('/api/shop/purchase', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { itemId, quality, enhancement, price } = req.body;
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true, currency: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.currency < price) {
      return res.status(400).json({ error: `Insufficient currency. Need $${price}, have $${user.currency.toFixed(2)}` });
    }
    
    let reward = null;
    
    // Check if it's a card
    const cardTemplate = await prisma.cardTemplates.findUnique({
      where: { id: itemId }
    });
    
    if (cardTemplate && quality && enhancement) {
      // Create the card with the specified quality and enhancement
      const newCard = await prisma.userCards.create({
        data: {
          user_id: user.id,
          card_template_id: cardTemplate.id,
          quality: quality as Quality,
          enhancement: enhancement as Enhancement
        },
        include: { cardTemplate: true }
      });
      reward = { type: 'card', card: newCard };
    } else {
      // Handle pack or item purchase
      const shopItem = await prisma.shopItem.findUnique({
        where: { id: itemId, is_available: true }
      });
      
      if (!shopItem) return res.status(404).json({ error: 'Item not found' });
      
      switch (shopItem.item_type) {
        case 'ONE_TIME_PACK':
        case 'MULTI_BUY_PACK':
          const pack = await prisma.pack.findUnique({ 
            where: { id: shopItem.reference_id } 
          });
          if (!pack) return res.status(404).json({ error: 'Pack not found' });
          
          await prisma.userInventory.create({
            data: {
              user_id: user.id,
              item_type: 'PACK',
              reference_id: shopItem.reference_id,
              quantity: 1
            }
          });
          reward = { type: 'pack', pack };
          break;
          
        case 'ITEM_SLOT':
          const item = await prisma.item.findUnique({ 
            where: { id: shopItem.reference_id } 
          });
          if (!item) return res.status(404).json({ error: 'Item not found' });
          
          await prisma.userInventory.create({
            data: {
              user_id: user.id,
              item_type: 'ITEM',
              reference_id: shopItem.reference_id,
              quantity: 1
            }
          });
          reward = { type: 'item', item };
          break;
          
        default:
          return res.status(400).json({ error: 'Unknown item type' });
      }
    }
    
    if (!reward) {
      return res.status(500).json({ error: 'Failed to generate reward' });
    }
    
    // Deduct currency
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { currency: { decrement: price } }
      }),
      prisma.userStats.update({
        where: { user_id: user.id },
        data: { 
          purchases_made: { increment: 1 },
          total_currency_spent: { increment: price }
        }
      })
    ]);
    
    await checkAndUpdateAchievements(user.id, Condition.PURCHASES_MADE);
    
    res.json({ success: true, reward, newCurrency: user.currency - price });
    
  } catch (error) {
    console.error('Purchase failed:', error);
    res.status(500).json({ error: 'Purchase failed: ' + (error as Error).message });
  }
});

app.post('/api/inventory/sell', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { inventoryId } = req.body;
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const inventoryItem = await prisma.userInventory.findFirst({
      where: {
        id: inventoryId,
        user_id: user.id
      }
    });
    
    if (!inventoryItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    let sellPrice = 0;
    let itemName = '';
    
    // Handle different item types
    if (inventoryItem.item_type === 'PACK') {
      const pack = await prisma.pack.findUnique({
        where: { id: inventoryItem.reference_id }
      });
      if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
      }
      // Sell pack for 80% of its price
      sellPrice = pack.price * 0.8;
      itemName = pack.name;
    } 
    else if (inventoryItem.item_type === 'ITEM') {
      const item = await prisma.item.findUnique({
        where: { id: inventoryItem.reference_id }
      });
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }
      if (!item.can_sell) {
        return res.status(400).json({ error: 'This item cannot be sold' });
      }
      // Sell item for 50% of its price
      sellPrice = item.price * 0.5;
      itemName = item.name;
    }
    else {
      return res.status(400).json({ error: 'Unknown item type' });
    }
    
    // Delete or decrement item
    if (inventoryItem.quantity === 1) {
      await prisma.userInventory.delete({
        where: { id: inventoryId }
      });
    } else {
      await prisma.userInventory.update({
        where: { id: inventoryId },
        data: { quantity: { decrement: 1 } }
      });
    }
    
    // Add currency to user
    await updateCurrency(user.id, sellPrice, 'gain');
    
    res.json({ success: true, sellPrice, itemName });
  } catch (error) {
    console.error('Failed to sell item:', error);
    res.status(500).json({ error: 'Failed to sell item' });
  }
});

app.get('/api/user/status', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { user_status: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({ status: user.user_status });
});

app.post('/api/user/check-completion', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { cardTemplateId } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Check if already rewarded
  const existingReward = await prisma.userCardCompletion.findUnique({
    where: {
      user_id_card_template_id: {
        user_id: user.id,
        card_template_id: cardTemplateId
      }
    }
  });
  
  if (existingReward) {
    return res.json({ alreadyRewarded: true });
  }
  
  // Check if user has all 20 variants
  const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
  const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
  
  let hasAll = true;
  for (const quality of allQualities) {
    for (const enhancement of allEnhancements) {
      const card = await prisma.userCards.findFirst({
        where: {
          user_id: user.id,
          card_template_id: cardTemplateId,
          quality: quality as Quality,
          enhancement: enhancement as Enhancement
        }
      });
      if (!card) {
        hasAll = false;
        break;
      }
    }
    if (!hasAll) break;
  }
  
  if (hasAll) {
    // Award 100 currency
    await updateCurrency(user.id, 100, 'gain');
    
    // Record the completion
    await prisma.userCardCompletion.create({
      data: {
        user_id: user.id,
        card_template_id: cardTemplateId
      }
    });
    
    return res.json({ rewarded: true, amount: 100 });
  }
  
  res.json({ notCompleted: true });
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

app.post('/api/cards/favorite', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { cardId, isFavourited } = req.body;
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Update all cards with this template_id to have the same favorite status
  await prisma.userCards.updateMany({
    where: {
      user_id: user.id,
      card_template_id: cardId
    },
    data: {
      is_favourited: isFavourited
    }
  });
  
  res.json({ success: true });
});

app.get('/api/cards/favorites', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const favoriteCards = await prisma.userCards.findMany({
    where: {
      user_id: user.id,
      is_favourited: true
    },
    select: {
      card_template_id: true
    },
    distinct: ['card_template_id']
  });
  
  const favoriteIds = new Set(favoriteCards.map(c => c.card_template_id));
  res.json({ favorites: Array.from(favoriteIds) });
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