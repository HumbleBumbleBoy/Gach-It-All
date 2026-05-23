import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Condition, Comparator, Quality, Reward, Enhancement, UserStatus } from "@prisma/client";
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
      case Condition.CARDS_SOLD:
        currentValue = user.userStats.total_cards_sold;
        break;
      case Condition.CARDS_COLLECTED:
        currentValue = user.userStats.unique_cards;
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
        // Count cards with non-BASIC enhancement
        const enhancedCards = await prisma.userCards.count({
          where: { user_id: userId, enhancement: { not: 'BASIC' } }
        });
        currentValue = enhancedCards;
        break;
      case Condition.CARDS_COLLECTED:
        currentValue = user.userStats.unique_cards;
        break;
      case Condition.CARDS_SOLD:
        currentValue = user.userStats.total_cards_sold;
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
        case Comparator.MORE_OR_EQUAL:
          isComplete = currentValue >= targetValue;
          break;
        case Comparator.LESS_OR_EQUAL:
          isComplete = currentValue <= targetValue;
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
    
    if (progress >= targetValue && existing && !existing.completed_at) {
      await prisma.userAchievement.update({
        where: { id: existing.id },
        data: { completed_at: new Date(), progress: 100 }
      });
      await grantReward(userId, ach.reward_type, ach.reward_value);
      
      // pop up you got an achievement
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { clerkId: true }
      });
      if (user) {
        sendAchievementNotification(user.clerkId, ach.name, `${ach.reward_type}: ${ach.reward_value}`);
      }
    }
  }
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
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
    if (inv.item_type === 'ITEM') {
      details = await prisma.item.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true, description: true }
      });
    } else if (inv.item_type === 'PACK') {
      details = await prisma.pack.findUnique({
        where: { id: inv.reference_id },
        select: { name: true, image_url: true, description: true }
      });
    }
    
    return {
      ...inv,
      name: details?.name || 'Unknown',
      image_url: details?.image_url,
      description: details?.description || ''
    };
  }));
  
  res.json({ items: itemsWithDetails });
});

app.get('/api/cards', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: 'Unauthorized' });
    
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
  
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true, currency: true }
  });
  
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  const card = await prisma.userCards.findFirst({
    where: { id: cardId, user_id: user.id },
    include: { cardTemplate: true }
  });
  
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const qualityMultipliers = { TARNISHED: 0.3, POOR: 0.66, REGULAR: 1, GOOD: 1.25, CRISP: 1.5 };
  const enhancementMultipliers = { BASIC: 1, FOILED: 1.25, SHINY: 1.5, SIGNED: 2 };
  
  const qualityMult = qualityMultipliers[card.quality] || 1;
  const enhancementMult = enhancementMultipliers[card.enhancement] || 1;
  const cardValue = card.cardTemplate.base_price * qualityMult * enhancementMult;
  const sellPrice = roundCurrency(cardValue * 0.8);
  
  await updateCurrency(user.id, sellPrice, 'gain');
  
  // Update sold cards count
  await prisma.userStats.update({
    where: { user_id: user.id },
    data: { total_cards_sold: { increment: 1 } }
  });
  
  await prisma.userCards.delete({ where: { id: cardId } });
  
  const uniqueCardTemplates = await prisma.userCards.findMany({
    where: { user_id: user.id },
    select: { card_template_id: true },
    distinct: ['card_template_id']
  });
  
  await prisma.userStats.update({
    where: { user_id: user.id },
    data: { unique_cards: uniqueCardTemplates.length }
  });
  
  await checkAndUpdateAchievements(user.id, Condition.CARDS_SOLD);
  await checkAndUpdateAchievements(user.id, Condition.CARDS_COLLECTED);
  
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { currency: true }
  });
  
  res.json({ success: true, sellPrice, newCurrency: updatedUser?.currency });
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
  
  // Check if user has pack in inventory or can buy
  if (pack.price > 0) {
    const inventoryPack = await prisma.userInventory.findFirst({
      where: {
        user_id: user.id,
        item_type: 'PACK',
        reference_id: packId,
        quantity: { gt: 0 }
      }
    });
    
    if (!inventoryPack && user.currency < pack.price) {
      return res.status(400).json({ error: 'Insufficient currency' });
    }
    
    if (inventoryPack) {
      // Use from inventory
      if (inventoryPack.quantity === 1) {
        await prisma.userInventory.delete({ where: { id: inventoryPack.id } });
      } else {
        await prisma.userInventory.update({
          where: { id: inventoryPack.id },
          data: { quantity: { decrement: 1 } }
        });
      }
    } else {

      await updateCurrency(user.id, pack.price, 'spend');
    }
  }

  const cards = await generatePackCards(pack, user.id);

  await prisma.userStats.update({
    where: { user_id: user.id },
    data: { 
      total_pulls: { increment: 1 }  // 1 pack
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
  
  // Handle guaranteed cards
  const guaranteedCards: CardTemplates[] = [];
  if (pack.guaranteed_card_ids && Array.isArray(pack.guaranteed_card_ids) && pack.guaranteed_count > 0) {
    const guaranteedIds = pack.guaranteed_card_ids as number[];
    for (let i = 0; i < Math.min(pack.guaranteed_count, guaranteedIds.length); i++) {
      const guaranteedCard = await prisma.cardTemplates.findUnique({
        where: { id: guaranteedIds[i] }
      });
      if (guaranteedCard) {
        guaranteedCards.push(guaranteedCard);
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