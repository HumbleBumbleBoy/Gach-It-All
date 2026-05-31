import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Condition, Comparator, Quality, Reward, Enhancement, UserStatus, Rarity } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

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
      const qualityWeights = [20, 30, 30, 15, 5];
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
      const enhancementWeights = [85, 10, 4, 1];
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
      const packId = parseInt(rewardValue);
      const packExists = await prisma.pack.findUnique({ where: { id: packId } });
      if (packExists) {
        await prisma.userInventory.create({
          data: {
            user_id: userId,
            item_type: 'PACK',
            reference_id: packId,
            quantity: 1
          }
        });
      } else {
        console.error(`Pack ${packId} not found`);
      }
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
    await checkAndUpdateAchievements(userId, Condition.CURRENCY_GAINED);
  } else {
    await prisma.userStats.update({
      where: { user_id: userId },
      data: { total_currency_spent: { increment: roundedAmount } }
    });
    await prisma.user.update({
      where: { id: userId },
      data: { currency: { decrement: roundedAmount } }
    });
    await checkAndUpdateAchievements(userId, Condition.CURRENCY_SPENT);
  }

  await checkAndUpdateAchievements(userId, Condition.CURRENCY);
}

async function getAchievementsByCondition(condition: Condition): Promise<any[]> {
  const now = Date.now();
  if (!cachedAchievements.has(condition) || (now - achievementsLastFetch) > ACHIEVEMENTS_CACHE_TTL) {
    const achievements = await prisma.achievement.findMany({
      where: { condition: condition }
    });
    cachedAchievements.set(condition, achievements);
    achievementsLastFetch = now;
  }
  return cachedAchievements.get(condition)!;
}

async function checkAndUpdateAchievements(userId: number, triggerCondition: Condition, cardData?: any) {
  const achievements = await getAchievementsByCondition(triggerCondition);
  if (achievements.length === 0) return;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userStats: true }
  });
  
  if (!user || !user.userStats) return;
  
  // Batch get existing user achievements
  const existingAchievements = await prisma.userAchievement.findMany({
    where: {
      user_id: userId,
      achievement_id: { in: achievements.map(a => a.id) }
    }
  });
  const existingMap = new Map(existingAchievements.map(ea => [ea.achievement_id, ea]));
  
  // Calculate all current values first
  const currentValues = new Map<number, number>();
  for (const ach of achievements) {
    let currentValue: number = 0;
    
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
      // Card-specific conditions using cardData
      case Condition.CARD_HEALTH:
        currentValue = cardData?.base_hp ?? 0;
        break;
      case Condition.CARD_STRENGTH:
        currentValue = cardData?.base_atk ?? 0;
        break;
      case Condition.CARD_DEFENCE:
        currentValue = cardData?.base_def ?? 0;
        break;
      case Condition.CARD_NAME_LENGTH:
        currentValue = cardData?.name?.length ?? 0;
        break;
      case Condition.CARD_NAME_WORDS:
        currentValue = cardData?.name?.split(/\s+/).filter((w: string) => w.length > 0).length ?? 0;
        break;
      case Condition.CARD_RARITY:
        // For CARD_RARITY, there's a need to check if the card's rarity matches the achievement's value_string
        // This is handled differently, just set currentValue to 1 if matches, else 0
        currentValue = (cardData?.rarity === ach.value_string) ? 1 : 0;
        break;
      case Condition.INVENTORY_ITEMS:
        const itemCount = await prisma.userInventory.aggregate({
          where: { user_id: userId },
          _sum: { quantity: true }
        });
        currentValue = itemCount._sum.quantity || 0;
        break;
      case Condition.ACHIEVEMENT_COUNT:
        currentValue = existingAchievements.filter(ea => ea.completed_at).length;
        break;
      default:
        currentValue = 0;
    }
    currentValues.set(ach.id, currentValue);
  }
  
  // Batch prepare updates and creates
  const toUpdate = [];
  const toCreate = [];
  
  for (const ach of achievements) {
    const currentValue = currentValues.get(ach.id)!;
    const targetValue = ach.value_int ?? ach.value_float ?? 0;
    const progress = Math.min(currentValue, targetValue);
    const existing = existingMap.get(ach.id);
    
    if (existing) {
      if (existing.progress !== progress) {
        toUpdate.push({ id: existing.id, progress });
      }
    } else {
      toCreate.push({
        user_id: userId,
        achievement_id: ach.id,
        progress: progress
      });
    }
  }
  
  // Batch execute updates and creates
  if (toUpdate.length > 0) {
    await Promise.all(toUpdate.map(u => 
      prisma.userAchievement.update({ where: { id: u.id }, data: { progress: u.progress } })
    ));
  }
  if (toCreate.length > 0) {
    await prisma.userAchievement.createMany({ data: toCreate });
  }
  
  // Check for newly completed achievements and grant rewards
  for (const ach of achievements) {
    const currentValue = currentValues.get(ach.id)!;
    const targetValue = ach.value_int ?? ach.value_float ?? 0;
    let isComplete = false;
    
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
    
    const existing = existingMap.get(ach.id);
    
    if (isComplete && (!existing || !existing.completed_at)) {
      await grantReward(userId, ach.reward_type, ach.reward_value);
      await prisma.userAchievement.update({
        where: { user_id_achievement_id: { user_id: userId, achievement_id: ach.id } },
        data: { completed_at: new Date(), progress: 100 }
      });
      
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { clerkId: true }
      });
      if (userData) {
        sendAchievementNotification(userData.clerkId, ach.name, `${ach.reward_type}: ${ach.reward_value}`);
      }
    }

    await checkAndUpdateAchievements(userId, Condition.ACHIEVEMENT_COUNT);
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
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 4.0;
  if (skew !== 1) {
    num = Math.pow((num + 1) / 2, skew) * 2 - 1;
  }

  return min + (num + 1) / 2 * (max - min);
}

function calculateSkew(price: number, priceRange: StatRange): number {
  const percent = (price - priceRange.min) / (priceRange.max - priceRange.min);
  return 2.0 - (0.5 + (percent * 1.5));
}

function generateFallbackStats(rarity: string, existingStats?: {
  hp?: number;
  atk?: number;
  def?: number;
  price?: number;
}): { hp: number; atk: number; def: number; price: number } {
  const ranges = FALLBACK_STATS[rarity] || FALLBACK_STATS.COMMON;
  
  let price = existingStats?.price;
  if (!price) {
    price = roundCurrency(weightedRandom(ranges.price.min, ranges.price.max, 1));
  }

  const skew = calculateSkew(price, ranges.price);
  
  const hp = existingStats?.hp ?? Math.round(weightedRandom(ranges.hp.min, ranges.hp.max, skew));
  const atk = existingStats?.atk ?? Math.round(weightedRandom(ranges.atk.min, ranges.atk.max, skew));
  const def = existingStats?.def ?? Math.round(weightedRandom(ranges.def.min, ranges.def.max, skew));
  
  return { hp, atk, def, price: roundCurrency(price) };
}

let cachedCardTemplates: any[] | null = null;
let cacheInitialized = false;

async function getCachedCardTemplates(): Promise<any[]> {
  if (!cacheInitialized) {
    cachedCardTemplates = await prisma.cardTemplates.findMany();
    cacheInitialized = true;
  }
  return cachedCardTemplates!;
}

async function refreshCardCache() {
  cachedCardTemplates = await prisma.cardTemplates.findMany();
  cacheInitialized = true;
  return cachedCardTemplates;
}

// Add this function before the generatePackCards function
async function ensureCardStats(cardTemplate: any): Promise<any> {
  // Check if card has all required stats
  const needsFallback = !cardTemplate.base_hp || !cardTemplate.base_atk || !cardTemplate.base_def || !cardTemplate.base_price;
  
  if (needsFallback) {
    const fallbackStats = generateFallbackStats(cardTemplate.rarity, {
      hp: cardTemplate.base_hp || undefined,
      atk: cardTemplate.base_atk || undefined,
      def: cardTemplate.base_def || undefined,
      price: cardTemplate.base_price || undefined
    });
    
    // Update the card template in DB for future use
    await prisma.cardTemplates.update({
      where: { id: cardTemplate.id },
      data: {
        base_hp: fallbackStats.hp,
        base_atk: fallbackStats.atk,
        base_def: fallbackStats.def,
        base_price: fallbackStats.price
      }
    });
    
    // Return updated card with stats
    return {
      ...cardTemplate,
      base_hp: fallbackStats.hp,
      base_atk: fallbackStats.atk,
      base_def: fallbackStats.def,
      base_price: fallbackStats.price
    };
  }
  
  return cardTemplate;
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

    await checkAndUpdateAchievements(dbUser.id, Condition.PLAY_TIME);
    await checkAndUpdateAchievements(dbUser.id, Condition.TOTAL_LOGINS);
    await checkAndUpdateAchievements(dbUser.id, Condition.LOGIN_STREAK);
    await checkAndUpdateAchievements(dbUser.id, Condition.ACCOUNT_AGE);
    await checkAndUpdateAchievements(dbUser.id, Condition.STATUS);

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
  
  const { amount } = req.body;
  
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
  
  const packIds = items.filter(i => i.item_type === 'PACK').map(i => i.reference_id);
  const itemIds = items.filter(i => i.item_type === 'ITEM').map(i => i.reference_id);
  
  const [packs, shopItems] = await Promise.all([
    packIds.length > 0 ? prisma.pack.findMany({ where: { id: { in: packIds } } }) : [],
    itemIds.length > 0 ? prisma.item.findMany({ where: { id: { in: itemIds } } }) : []
  ]);
  
  const packMap = new Map(packs.map(p => [p.id, p]));
  const itemMap = new Map(shopItems.map(i => [i.id, i]));
  
  const itemsWithDetails = items.map(inv => {
    let details = null;
    let sellPrice = 0;
    let canSell = false;
    
    if (inv.item_type === 'ITEM') {
      details = itemMap.get(inv.reference_id);
      if (details) {
        canSell = details.can_sell || false;
        if (canSell) sellPrice = details.price * 0.5;
      }
    } else if (inv.item_type === 'PACK') {
      details = packMap.get(inv.reference_id);
      if (details) {
        canSell = true;
        sellPrice = details.price * 0.8;
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
  });
  
  res.json({ items: itemsWithDetails });
});

app.get('/api/cards', async (_req, res) => {
  try {
    const cardTemplates = await getCachedCardTemplates();
    res.setHeader('Cache-Control', 'public, max-age=3600');
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
      select: {
        id: true,
        card_template_id: true,
        quality: true,
        enhancement: true,
        is_favourited: true,
        cardTemplate: {
          select: {
            id: true,
            name: true,
            image_url: true,
            rarity: true,
            description: true,
            base_price: true,
            base_hp: true,
            base_atk: true,
            base_def: true,
            series: true,
            type: true
          }
        }
      }
    });
    
    await checkAndUpdateAchievements(user.id, Condition.UNIQUE_CARD_SERIES);
    await checkAndUpdateAchievements(user.id, Condition.SERIES_COMPLETED);
    await checkAndUpdateAchievements(user.id, Condition.PERFECT_SERIES_COMPLETED);
    await checkAndUpdateAchievements(user.id, Condition.RARITY_COLLECTION);
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
    
    await prisma.userCards.deleteMany({ where: { user_id: user.id } });
    await prisma.userInventory.deleteMany({ where: { user_id: user.id } });
    await prisma.userAchievement.deleteMany({ where: { user_id: user.id } });
    await prisma.userStats.deleteMany({ where: { user_id: user.id } });
    
    await prisma.user.update({
      where: { id: user.id },
      data: { currency: 0 }
    });
    
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

app.get('/api/events/achievements', (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Send keep-alive every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);
  
  clients.set(auth.userId, res);
  
  req.on('close', () => {
    clearInterval(keepAlive);
    clients.delete(auth.userId);
  });
  
  // Auto-disconnect after 5 minutes of inactivity
  const timeout = setTimeout(() => {
    res.end();
    clients.delete(auth.userId);
  }, 300000);
  
  req.on('close', () => clearTimeout(timeout));
});

const clients = new Map<string, any>();

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

let cachedAchievements: Map<Condition, any[]> = new Map();
let achievementsLastFetch = 0;
const ACHIEVEMENTS_CACHE_TTL = 300000;

let allAchievementsCache: any[] | null = null;
let allAchievementsLastFetch = 0;
const ALL_ACHIEVEMENTS_CACHE_TTL = 300000;

app.get('/api/achievements', async (_req, res) => {
  try {
    const now = Date.now();
    if (!allAchievementsCache || (now - allAchievementsLastFetch) > ALL_ACHIEVEMENTS_CACHE_TTL) {
      allAchievementsCache = await prisma.achievement.findMany();
      allAchievementsLastFetch = now;
    }
    // Cache for 5 minutes
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ achievements: allAchievementsCache || [] });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements', achievements: [] });
  }
});

app.post('/api/cards/sell', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { cardId } = req.body;
  
  try {
    const result = await prisma.$transaction(async (tx) => {
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
  
  const inventoryPack = await prisma.userInventory.findFirst({
    where: {
      user_id: user.id,
      item_type: 'PACK',
      reference_id: packId,
      quantity: { gt: 0 }
    },
    select: { id: true, quantity: true }
  });
  
  const [cards, _updateResult] = await Promise.all([
    generatePackCards(pack, user.id),
    (async () => {
      if (inventoryPack) {
        if (inventoryPack.quantity === 1) {
          await prisma.userInventory.delete({ where: { id: inventoryPack.id } });
        } else {
          await prisma.userInventory.update({
            where: { id: inventoryPack.id },
            data: { quantity: { decrement: 1 } }
          });
        }
      } else if (pack.price > 0) {
        if (user.currency < pack.price) {
          throw new Error('Insufficient currency');
        }
        await updateCurrency(user.id, pack.price, 'spend');
      }
      return true;
    })()
  ]);
  
  await Promise.all([
    prisma.userStats.update({
      where: { user_id: user.id },
      data: { total_pulls: { increment: 1 } }
    }),
    (async () => {
      const uniqueCardTemplates = await prisma.userCards.findMany({
        where: { user_id: user.id },
        select: { card_template_id: true },
        distinct: ['card_template_id']
      });
      await prisma.userStats.update({
        where: { user_id: user.id },
        data: { unique_cards: uniqueCardTemplates.length }
      });
    })()
  ]);
  
  Promise.all([
    checkAndUpdateAchievements(user.id, Condition.PACKS_OPENED),
  ]).catch(console.error);
  
  res.json({ success: true, cards, packName: pack.name });
});

async function generatePackCards(pack: any, userId: number) {
  let availableCards: any[] = await getCachedCardTemplates();
  const packRarities: string[] = [];
  
  if (pack.included_series && Array.isArray(pack.included_series)) {
    availableCards = availableCards.filter((card: any) => 
      pack.included_series.includes(card.series)
    );
  }
  
  if (pack.included_types && Array.isArray(pack.included_types)) {
    availableCards = availableCards.filter((card: any) => 
      pack.included_types.includes(card.type)
    );
  }
  
  if (pack.excluded_series && Array.isArray(pack.excluded_series)) {
    availableCards = availableCards.filter((card: any) => 
      !pack.excluded_series.includes(card.series)
    );
  }
  
  let guaranteedCards: any[] = [];
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
      guaranteedIds = pack.guaranteed_card_ids;
    }
    
    guaranteedCards = await prisma.cardTemplates.findMany({
      where: { id: { in: guaranteedIds.slice(0, pack.guaranteed_count) } }
    });
  }
  
  const remainingCards = pack.cards_count - guaranteedCards.length;
  const cardsToCreate: any[] = [];
  
  for (let i = 0; i < remainingCards; i++) {
    const rarity = determineRarity(pack);
    const cardsOfRarity = availableCards.filter((card: any) => card.rarity === rarity);
    
    let selectedCard: any;
    if (cardsOfRarity.length === 0) {
      selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    } else {
      selectedCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
    }
    
    const needsFallback = !selectedCard.base_hp || !selectedCard.base_atk || !selectedCard.base_def || !selectedCard.base_price;
    if (needsFallback) {
      const fallbackStats = generateFallbackStats(selectedCard.rarity, {
        hp: selectedCard.base_hp || undefined,
        atk: selectedCard.base_atk || undefined,
        def: selectedCard.base_def || undefined,
        price: selectedCard.base_price || undefined
      });
      
      await prisma.cardTemplates.update({
        where: { id: selectedCard.id },
        data: {
          base_hp: fallbackStats.hp,
          base_atk: fallbackStats.atk,
          base_def: fallbackStats.def,
          base_price: fallbackStats.price
        }
      });
      
      selectedCard.base_hp = fallbackStats.hp;
      selectedCard.base_atk = fallbackStats.atk;
      selectedCard.base_def = fallbackStats.def;
      selectedCard.base_price = fallbackStats.price;
    }

    packRarities.push(selectedCard.rarity);
    
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

    cardsToCreate.push({
      user_id: userId,
      card_template_id: selectedCard.id,
      quality: quality,
      enhancement: enhancement,
    });
  }
  
  // Generate guaranteed cards
  for (const guaranteedCard of guaranteedCards) {
    const needsFallback = !guaranteedCard.base_hp || !guaranteedCard.base_atk || !guaranteedCard.base_def || !guaranteedCard.base_price;
    if (needsFallback) {
      const fallbackStats = generateFallbackStats(guaranteedCard.rarity, {
        hp: guaranteedCard.base_hp || undefined,
        atk: guaranteedCard.base_atk || undefined,
        def: guaranteedCard.base_def || undefined,
        price: guaranteedCard.base_price || undefined
      });
      
      await prisma.cardTemplates.update({
        where: { id: guaranteedCard.id },
        data: {
          base_hp: fallbackStats.hp,
          base_atk: fallbackStats.atk,
          base_def: fallbackStats.def,
          base_price: fallbackStats.price
        }
      });
      
      guaranteedCard.base_hp = fallbackStats.hp;
      guaranteedCard.base_atk = fallbackStats.atk;
      guaranteedCard.base_def = fallbackStats.def;
      guaranteedCard.base_price = fallbackStats.price;
    }
    
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
    
    packRarities.push(guaranteedCard.rarity);

    cardsToCreate.push({
      user_id: userId,
      card_template_id: guaranteedCard.id,
      quality: quality,
      enhancement: enhancement,
    });
  }
  
  // one stransaction to create all cards
  const createdCards = await prisma.$transaction(
    cardsToCreate.map((cardData: any) => 
      prisma.userCards.create({
        data: cardData,
        include: { cardTemplate: true }
      })
    )
  );

  const uniqueTemplates = await prisma.userCards.findMany({
    where: { user_id: userId },
    select: { card_template_id: true },
    distinct: ['card_template_id']
  });
  
  await prisma.userStats.update({
    where: { user_id: userId },
    data: { unique_cards: uniqueTemplates.length }
  });

  const allExistingAchievements = await prisma.userAchievement.findMany({
    where: { user_id: userId }
  });
  const existingAchievementMap = new Map(allExistingAchievements.map(ea => [ea.achievement_id, ea]));

  const rarityCounts = packRarities.reduce<Record<string, number>>((acc, rarity) => {
    acc[rarity] = (acc[rarity] || 0) + 1;
    return acc;
  }, {});

  const luckyPullAchievements = await prisma.achievement.findMany({
    where: { condition: Condition.LUCKY_PULL }
  });

  for (const achievement of luckyPullAchievements) {
    const targetRarity = achievement.value_string;
    if (targetRarity && rarityCounts[targetRarity] >= 2) {
      const existing = existingAchievementMap.get(achievement.id);
      if (!existing || !existing.completed_at) {
        await grantReward(userId, achievement.reward_type, achievement.reward_value);
        await prisma.userAchievement.upsert({
          where: {
            user_id_achievement_id: {
              user_id: userId,
              achievement_id: achievement.id
            }
          },
          update: { completed_at: new Date(), progress: 100 },
          create: {
            user_id: userId,
            achievement_id: achievement.id,
            progress: 100,
            completed_at: new Date()
          }
        });
        
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          select: { clerkId: true }
        });
        if (userData) {
          sendAchievementNotification(userData.clerkId, achievement.name, `${achievement.reward_type}: ${achievement.reward_value}`);
        }
      }
    }
  }

  const checkedTemplates = new Set<number>();
  const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
  const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
  
  // Get all cards the user owns in one query
  const allUserCards = await prisma.userCards.findMany({
    where: { user_id: userId },
    select: { card_template_id: true, quality: true, enhancement: true }
  });
  
  // Group by template
  const cardsByTemplate = new Map<number, Set<string>>();
  for (const card of allUserCards) {
    if (!cardsByTemplate.has(card.card_template_id)) {
      cardsByTemplate.set(card.card_template_id, new Set());
    }
    cardsByTemplate.get(card.card_template_id)!.add(`${card.quality}-${card.enhancement}`);
  }
  
  for (const card of createdCards) {
    const templateId = card.card_template_id;
    if (checkedTemplates.has(templateId)) continue;
    checkedTemplates.add(templateId);
    
    const userVariants = cardsByTemplate.get(templateId) || new Set();
    const totalVariants = allQualities.length * allEnhancements.length;
    
    if (userVariants.size >= totalVariants) {
      const setCompletionAchievements = await prisma.achievement.findMany({
        where: { condition: Condition.CARD_SET_COMPLETION }
      });
      for (const achievement of setCompletionAchievements) {
        const existing = existingAchievementMap.get(achievement.id);
        if (!existing || !existing.completed_at) {
          await grantReward(userId, achievement.reward_type, achievement.reward_value);
          await prisma.userAchievement.upsert({
            where: {
              user_id_achievement_id: {
                user_id: userId,
                achievement_id: achievement.id
              }
            },
            update: { completed_at: new Date(), progress: 100 },
            create: {
              user_id: userId,
              achievement_id: achievement.id,
              progress: 100,
              completed_at: new Date()
            }
          });
        }
      }
    }
  }
  
  const allCardAchievements = await prisma.achievement.findMany({
    where: {
      condition: {
        in: ['CARD_HEALTH', 'CARD_STRENGTH', 'CARD_DEFENCE', 'CARD_NAME_LENGTH', 'CARD_NAME_WORDS', 'CARD_RARITY']
      }
    }
  });
  
  for (const card of createdCards) {
    const template = card.cardTemplate;
    const name = template.name || '';
    const wordCount = name.split(/\s+/).filter((w: string) => w.length > 0).length;
    const charCount = name.length;
    
    for (const ach of allCardAchievements) {
      let isComplete = false;
      let currentValue = 0;
      let targetValue = ach.value_int ?? ach.value_float ?? 0;
      
      switch (ach.condition) {
        case 'CARD_HEALTH':
          currentValue = template.base_hp ?? 0;
          isComplete = currentValue >= targetValue;
          break;
        case 'CARD_STRENGTH':
          currentValue = template.base_atk ?? 0;
          isComplete = currentValue >= targetValue;
          break;
        case 'CARD_DEFENCE':
          currentValue = template.base_def ?? 0;
          isComplete = currentValue >= targetValue;
          break;
        case 'CARD_NAME_LENGTH':
          currentValue = charCount;
          isComplete = currentValue >= targetValue;
          break;
        case 'CARD_NAME_WORDS':
          currentValue = wordCount;
          isComplete = currentValue >= targetValue;
          break;
        case 'CARD_RARITY':
          if (ach.value_string === template.rarity) {
            isComplete = true;
            currentValue = 1;
            targetValue = 1;
          }
          break;
      }
      
      if (isComplete) {
        const existing = existingAchievementMap.get(ach.id);
        if (!existing || !existing.completed_at) {
          await grantReward(userId, ach.reward_type, ach.reward_value);
          await prisma.userAchievement.upsert({
            where: {
              user_id_achievement_id: {
                user_id: userId,
                achievement_id: ach.id
              }
            },
            update: { completed_at: new Date(), progress: 100 },
            create: {
              user_id: userId,
              achievement_id: ach.id,
              progress: 100,
              completed_at: new Date()
            }
          });
        }
      }
    }
  }
  
  await checkAndUpdateAchievements(userId, Condition.CARDS_COLLECTED);
  
  return createdCards;
}

function determineRarity(pack: any): string {
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

app.get('/api/shop/items', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const dbItems = await prisma.shopItem.findMany({
      where: { is_available: true }
    });
    
    const regularItems = dbItems.filter(item => 
      item.item_type !== 'CARD_SLOT' && item.item_type !== 'MYTHICAL_CARD'
    );
    
    const cardSlots = [];
    const allCards = await prisma.cardTemplates.findMany();
    const cardsByRarity = new Map();
    for (const card of allCards) {
      if (!cardsByRarity.has(card.rarity)) cardsByRarity.set(card.rarity, []);
      cardsByRarity.get(card.rarity).push(card);
    }
    
    const rarities = ['COMMON', 'UNCOMMON', 'SPARSE', 'RARE', 'UBER_RARE'];
    for (const rarity of rarities) {
      const cards = cardsByRarity.get(rarity) || []
      if (cards.length > 0) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        // Ensure card has stats before adding to shop
        const ensuredCard = await ensureCardStats(randomCard);
        cardSlots.push({
          id: ensuredCard.id,
          name: ensuredCard.name,
          description: ensuredCard.description || `${rarity} card`,
          item_type: 'CARD_SLOT',
          reference_id: ensuredCard.id,
          price: (ensuredCard.base_price || 1) * 2,
          image_url: ensuredCard.image_url,
          rarity: rarity,
          is_available: true,
          base_hp: ensuredCard.base_hp,
          base_atk: ensuredCard.base_atk,
          base_def: ensuredCard.base_def,
          base_price: ensuredCard.base_price,
          series: ensuredCard.series,
          type: ensuredCard.type 
        });
      }
    }
    
    const mythicalCards = await prisma.cardTemplates.findMany({
      where: { rarity: 'MYTHICAL' as Rarity }
    });
    let mythicalSlot = null;
    if (mythicalCards.length > 0) {
      const randomMythical = mythicalCards[Math.floor(Math.random() * mythicalCards.length)];
      // Ensure mythical card has stats
      const ensuredMythical = await ensureCardStats(randomMythical);
      mythicalSlot = {
        id: ensuredMythical.id,
        name: ensuredMythical.name,
        description: ensuredMythical.description || 'Mythical card',
        item_type: 'MYTHICAL_CARD',
        reference_id: ensuredMythical.id,
        price: (ensuredMythical.base_price || 20) * 2,
        image_url: ensuredMythical.image_url,
        rarity: 'MYTHICAL',
        is_available: true,
        base_hp: ensuredMythical.base_hp,
        base_atk: ensuredMythical.base_atk,
        base_def: ensuredMythical.base_def,
        base_price: ensuredMythical.base_price,
        series: ensuredMythical.series,
        type: ensuredMythical.type 
      };
    }
    
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
  
  const { itemId, quality, enhancement, price, slotId } = req.body;
  
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true, currency: true }
    });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const oneTimeSlots = [1, 9, 10, 11, 12];
    const isOneTime = oneTimeSlots.includes(slotId);
    
    if (isOneTime) {
      const existingPurchase = await prisma.shopPurchase.findFirst({
        where: {
          user_id: user.id,
          slot_id: slotId
        }
      });
      
      if (existingPurchase) {
        return res.status(400).json({ error: 'You have already purchased this item' });
      }
    }
    
    if (user.currency < price) {
      return res.status(400).json({ error: `Insufficient currency. Need $${price}, have $${user.currency.toFixed(2)}` });
    }
    
    let reward = null;
    
    const cardTemplate = await prisma.cardTemplates.findUnique({
      where: { id: itemId }
    });
    
    if (cardTemplate && quality && enhancement) {
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
    
    await prisma.user.update({
      where: { id: user.id },
      data: { currency: { decrement: price } }
    });
    
    await prisma.userStats.update({
      where: { user_id: user.id },
      data: { 
        purchases_made: { increment: 1 },
        total_currency_spent: { increment: price }
      }
    });
    
    if (isOneTime) {
      await prisma.shopPurchase.create({
        data: {
          user_id: user.id,
          slot_id: slotId,
          price_paid: price,
          item_id: itemId
        }
      });
    }
    
    await checkAndUpdateAchievements(user.id, Condition.PURCHASES_MADE);
    await checkAndUpdateAchievements(user.id, Condition.INVENTORY_ITEMS);
    
    res.json({ success: true, reward, newCurrency: user.currency - price });
    
  } catch (error) {
    console.error('Purchase failed:', error);
    res.status(500).json({ error: 'Purchase failed: ' + (error as Error).message });
  }
});

app.get('/api/shop/purchases', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const purchases = await prisma.shopPurchase.findMany({
    where: { user_id: user.id },
    select: { slot_id: true }
  });

  res.json({ purchasedSlots: purchases.map(p => p.slot_id) });
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
    
    if (inventoryItem.item_type === 'PACK') {
      const pack = await prisma.pack.findUnique({
        where: { id: inventoryItem.reference_id }
      });
      if (!pack) {
        return res.status(404).json({ error: 'Pack not found' });
      }
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
      sellPrice = item.price * 0.5;
      itemName = item.name;
    }
    else {
      return res.status(400).json({ error: 'Unknown item type' });
    }
    
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
    
    await updateCurrency(user.id, sellPrice, 'gain');
    await checkAndUpdateAchievements(user.id, Condition.INVENTORY_ITEMS);
    
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
    await updateCurrency(user.id, 100, 'gain');
    
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

app.post('/api/refresh-card-cache', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    await refreshCardCache();
    res.json({ success: true, message: 'Card cache refreshed', count: cachedCardTemplates?.length });
  } catch (error) {
    console.error('Failed to refresh cache:', error);
    res.status(500).json({ error: 'Failed to refresh cache' });
  }
})

app.get('/api/user/all-data', async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, currency: true, user_status: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const [userAchievements, achievements] = await Promise.all([
    prisma.userAchievement.findMany({ where: { user_id: user.id } }),
    prisma.achievement.findMany()
  ]);
  
  res.json({
    currency: user.currency,
    userStatus: user.user_status,
    userAchievements,
    achievements
  });
});

const lastHeartbeat = new Map();
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [key, timestamp] of lastHeartbeat.entries()) {
    if (timestamp < oneHourAgo) {
      lastHeartbeat.delete(key);
    }
  }
}, 3600000);
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

    await checkAndUpdateAchievements(user.id, Condition.PLAY_TIME);
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

app.use(express.static(path.join(__dirname, '../../dist'), {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(jpg|jpeg|png|gif|ico|svg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path.match(/\.(mp3|wav)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day for sounds
    }
  }
}));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});