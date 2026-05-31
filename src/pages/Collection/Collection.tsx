import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../../../lib/api';
import { ArrowUpIcon, ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { clientState } from '../../../lib/clientState';

// Pricing multipliers
const QUALITY_MULTIPLIERS = {
  TARNISHED: 0.3,
  POOR: 0.66,
  REGULAR: 1,
  GOOD: 1.25,
  CRISP: 1.5
};

const ENHANCEMENT_MULTIPLIERS = {
  BASIC: 1,
  FOILED: 1.25,
  SHINY: 1.5,
  SIGNED: 2
};

// Stat multipliers from enhancements
const ENHANCEMENT_STATS = {
  FOILED: { def: 1.5, hp: 1, atk: 1 },
  SHINY: { hp: 1.5, def: 1, atk: 1 },
  SIGNED: { atk: 1.5, hp: 1, def: 1 },
  BASIC: { hp: 1, def: 1, atk: 1 }
};

// Rarity configurations
const rarityConfig: Record<string, { textColor: string; borderColor: string; aura?: string }> = {
  COMMON: { textColor: 'text-gray-400', borderColor: 'border-gray-500' },
  UNCOMMON: { textColor: 'text-green-400', borderColor: 'border-green-600' },
  SPARSE: { textColor: 'text-blue-400', borderColor: 'border-blue-600' },
  RARE: { textColor: 'text-purple-400', borderColor: 'border-purple-600' },
  UBER_RARE: { textColor: 'text-pink-400', borderColor: 'border-pink-600' },
  MYTHICAL: { 
    textColor: 'text-orange-400', 
    borderColor: 'border-orange-500',
    aura: 'shadow-[0_0_10px_rgba(251,146,60,0.5)]'
  },
  LEGENDARY: { 
    textColor: 'text-yellow-400', 
    borderColor: 'border-yellow-500',
    aura: 'shadow-[0_0_15px_rgba(234,179,8,0.6)]'
  },
  SPECIAL: { 
    textColor: 'text-red-400', 
    borderColor: 'border-red-500',
    aura: 'shadow-[0_0_15px_rgba(248,113,113,0.6)]'
  }
};

const rarityOrder: Record<string, number> = {
  COMMON: 0,
  UNCOMMON: 1,
  SPARSE: 2,
  RARE: 3,
  UBER_RARE: 4,
  MYTHICAL: 5,
  LEGENDARY: 6,
  SPECIAL: 7
};

const RARITY_CATEGORIES = ['COMMON', 'UNCOMMON', 'SPARSE', 'RARE', 'UBER_RARE', 'MYTHICAL', 'LEGENDARY', 'SPECIAL'];
const qualityOrder = ['CRISP', 'GOOD', 'REGULAR', 'POOR', 'TARNISHED'];
const enhancementOrder = ['SIGNED', 'SHINY', 'FOILED', 'BASIC'];

function getRarityStyle(rarity: string) {
  return rarityConfig[rarity] || rarityConfig.COMMON;
}

function calculateCardPrice(basePrice: number, quality: string, enhancement: string): number {
  const qualityMultiplier = QUALITY_MULTIPLIERS[quality as keyof typeof QUALITY_MULTIPLIERS] || 1;
  const enhancementMultiplier = ENHANCEMENT_MULTIPLIERS[enhancement as keyof typeof ENHANCEMENT_MULTIPLIERS] || 1;
  const price = basePrice * qualityMultiplier * enhancementMultiplier;
  return Math.round(price * 100) / 100;
}

function calculateCardStats(baseHp: number, baseAtk: number, baseDef: number, enhancement: string) {
  const stats = ENHANCEMENT_STATS[enhancement as keyof typeof ENHANCEMENT_STATS] || ENHANCEMENT_STATS.BASIC;
  return {
    hp: Math.floor(baseHp * stats.hp),
    atk: Math.floor(baseAtk * stats.atk),
    def: Math.floor(baseDef * stats.def)
  };
}

export default function Collection() {
  const { isSignedIn, user } = useUser();
  const [userCards, setUserCards] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [rootCards, setRootCards] = useState<any[]>([]);
  const [selectedRootCard, setSelectedRootCard] = useState<any>(null);
  const [selectedVariants, setSelectedVariants] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'your' | 'entire'>('entire');
  const [selectedCardInfo, setSelectedCardInfo] = useState<any>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [totalValue, setTotalValue] = useState(0);
  const [rarityCounts, setRarityCounts] = useState<Record<string, number>>({});
  const [totalCardsPerRarity, setTotalCardsPerRarity] = useState<Record<string, number>>({});
  const [completedRewardsGiven, setCompletedRewardsGiven] = useState<Set<number>>(new Set());
  const [completedCardsCount, setCompletedCardsCount] = useState(0);
  const [completedCardsPerRarity, setCompletedCardsPerRarity] = useState<Record<string, number>>({});
  const tooltipRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [currentPage, setCurrentPage] = useState(1);
  const CARDS_PER_PAGE = 35
    const [sortBy, setSortBy] = useState<'rarity' | 'name' | 'base_price' | 'quantity' | 'completion' | 'base_hp' | 'base_def' | 'base_atk'>(() => {
    const saved = localStorage.getItem('collectionSortBy');
    return (saved && ['rarity', 'name', 'base_price', 'quantity', 'completion', 'base_hp', 'base_def', 'base_atk'].includes(saved)) ? saved as any : 'rarity';
  });

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('collectionSortDirection');
    return (saved === 'asc' || saved === 'desc') ? saved : 'asc';
  });

  const [showOnlyFavorites, setShowOnlyFavorites] = useState(() => {
    const saved = localStorage.getItem('collectionShowOnlyFavorites');
    return saved === 'true';
  });

  const [priorityEnhancements, setPriorityEnhancements] = useState(() => {
    const saved = localStorage.getItem('collectionPriorityEnhancements');
    return saved === 'true';
  });

  const [variantSortDirection, setVariantSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('collectionVariantSortDirection');
    return (saved === 'asc' || saved === 'desc') ? saved : 'desc';
  });

  useEffect(() => {
    localStorage.setItem('collectionSortBy', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('collectionSortDirection', sortDirection);
  }, [sortDirection]);

  useEffect(() => {
    localStorage.setItem('collectionShowOnlyFavorites', String(showOnlyFavorites));
  }, [showOnlyFavorites]);

  useEffect(() => {
    localStorage.setItem('collectionPriorityEnhancements', String(priorityEnhancements));
  }, [priorityEnhancements]);

  useEffect(() => {
    localStorage.setItem('collectionVariantSortDirection', variantSortDirection);
  }, [variantSortDirection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, sortDirection, showOnlyFavorites, viewMode]);

  // Initialize totals from allCards
  useEffect(() => {
    if (allCards && allCards.length > 0) {
      const totals: Record<string, number> = {};
      RARITY_CATEGORIES.forEach(rarity => {
        totals[rarity] = 0;
      });
      
      allCards.forEach((template: any) => {
        const rarity = template.rarity;
        if (rarity && totals[rarity] !== undefined) {
          totals[rarity]++;
        }
      });
      setTotalCardsPerRarity(totals);
    }
  }, [allCards]);

  useEffect(() => {
    if (!isSignedIn || !rootCards.length) return;
    
    const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
    const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
    
    const checkCompletions = async () => {
      for (const rootCard of rootCards) {
        const hasAllVariants = allQualities.every(quality =>
          allEnhancements.every(enhancement => {
            const variant = rootCard.variants?.find((v: any) => 
              v.quality === quality && v.enhancement === enhancement
            );
            return variant && variant.quantity > 0;
          })
        );
        
        if (hasAllVariants && !completedRewardsGiven.has(rootCard.templateId)) {
          try {
            const data = await apiClient.checkCardCompletion(rootCard.templateId);
            
            if (data.rewarded) {
              setCompletedRewardsGiven(prev => new Set([...prev, rootCard.templateId]));
              
              // Show toast
              const toast = document.createElement('div');
              toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-right duration-500';
              toast.textContent = `Completed "${rootCard.name}"! +100 currency!`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3000);
              
              // Refresh currency display
              window.dispatchEvent(new Event('currency-updated'));
            }
          } catch (error) {
            console.error('Failed to check completion:', error);
          }
        }
      }
    };
    
    checkCompletions();
  }, [rootCards, isSignedIn, completedRewardsGiven]);

  useEffect(() => {
    if (!isSignedIn || rootCards.length === 0) {
      setCompletedCardsCount(0);
      return;
    }

    const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
    const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
    
    let completed = 0;
    for (const rootCard of rootCards) {
      // Check if user has ALL 20 variants for this card
      const hasAllVariants = allQualities.every(quality =>
        allEnhancements.every(enhancement => {
          const variant = rootCard.variants?.find((v: any) => 
            v.quality === quality && v.enhancement === enhancement
          );
          return variant && variant.quantity > 0;
        })
      );
      
      if (hasAllVariants) {
        completed++;
      }
    }
    
    setCompletedCardsCount(completed);
  }, [rootCards, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || rootCards.length === 0) {
      const zeros: Record<string, number> = {};
      RARITY_CATEGORIES.forEach(rarity => {
        zeros[rarity] = 0;
      });
      setCompletedCardsPerRarity(zeros);
      return;
    }

    const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
    const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
    
    const completedByRarity: Record<string, number> = {};
    RARITY_CATEGORIES.forEach(rarity => {
      completedByRarity[rarity] = 0;
    });
    
    for (const rootCard of rootCards) {
      // Check if user has ALL 20 variants for this card
      const hasAllVariants = allQualities.every(quality =>
        allEnhancements.every(enhancement => {
          const variant = rootCard.variants?.find((v: any) => 
            v.quality === quality && v.enhancement === enhancement
          );
          return variant && variant.quantity > 0;
        })
      );
      
      if (hasAllVariants && rootCard.rarity) {
        completedByRarity[rootCard.rarity] = (completedByRarity[rootCard.rarity] || 0) + 1;
      }
    }
    
    setCompletedCardsPerRarity(completedByRarity);
  }, [rootCards, isSignedIn]);

  // Set zeros when not logged in
  useEffect(() => {
    if (!isSignedIn) {
      const zeros: Record<string, number> = {};
      RARITY_CATEGORIES.forEach(rarity => {
        zeros[rarity] = 0;
      });
      setRarityCounts(zeros);
    }
  }, [isSignedIn]);

  // Load all cards on mount
  useEffect(() => {
    fetchAllCards();
  }, []);

  // User-specific data
  useEffect(() => {
    if (isSignedIn && user) {
      refreshCollection();
      loadFavorites();
    } else {
      setUserCards([]);
      setFavorites(new Set());
      setTotalValue(0);
      if (viewMode === 'your') {
        setViewMode('entire');
        localStorage.setItem('collectionViewMode', 'entire');
      }
    }
  }, [isSignedIn, user]);

  // Calculate total value
  useEffect(() => {
    if (userCards && userCards.length > 0 && isSignedIn) {
      const sum = userCards.reduce((acc, card: any) => {
        const cardPrice = calculateCardPrice(
          card.cardTemplate?.base_price ?? 0,
          card.quality ?? 'REGULAR',
          card.enhancement ?? 'BASIC'
        );
        return acc + cardPrice;
      }, 0);
      setTotalValue(sum);
    } else {
      setTotalValue(0);
    }
  }, [userCards, isSignedIn]);

  useEffect(() => {
    const savedViewMode = localStorage.getItem('collectionViewMode');
    if (savedViewMode === 'your' || savedViewMode === 'entire') {
      setViewMode(savedViewMode);
    }
  }, []);

  const loadFavorites = async () => {
    if (!isSignedIn) return;
    try {
      const data = await apiClient.getFavorites();
      setFavorites(new Set(data.favorites || []));
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const fetchAllCards = async () => {
    try {
      const data = await apiClient.getCards();
      setAllCards(data.items || []);
      groupAllCards(data.items || []);
    } catch (error) {
      console.error('Failed to fetch cards:', error);
    }
  };

  const calculateRarityProgress = (cards: any[]) => {
    if (!cards || cards.length === 0) {
      const zeros: Record<string, number> = {};
      RARITY_CATEGORIES.forEach(rarity => {
        zeros[rarity] = 0;
      });
      setRarityCounts(zeros);
      return;
    }
    
    const counts: Record<string, number> = {};
    RARITY_CATEGORIES.forEach(rarity => {
      counts[rarity] = 0;
    });

    const uniqueTemplates = new Set();
    cards.forEach((card: any) => {
      const templateId = card.card_template_id;
      if (!uniqueTemplates.has(templateId)) {
        uniqueTemplates.add(templateId);
        const rarity = card.cardTemplate?.rarity;
        if (rarity && counts[rarity] !== undefined) {
          counts[rarity]++;
        }
      }
    });
    
    setRarityCounts(counts);
  };

  const refreshCollection = async () => {
    if (!isSignedIn) return;
    try {
      const data = await apiClient.getCollection();
      setUserCards(data.items || []);
      calculateRarityProgress(data.items || []);
      groupByRootCard(data.items || []);
    } catch (error) {
      console.error('Failed to refresh collection:', error);
    }
  };

  const groupByRootCard = (cards: any[]) => {
    if (!cards || cards.length === 0) {
      setRootCards([]);
      return;
    }
    
    const rootMap = new Map();
    
    cards.forEach((card: any) => {
      const templateId = card.card_template_id;
      
      if (!rootMap.has(templateId)) {
        rootMap.set(templateId, {
          templateId: templateId,
          name: card.cardTemplate?.name,
          image_url: card.cardTemplate?.image_url,
          rarity: card.cardTemplate?.rarity,
          description: card.cardTemplate?.description,
          series: card.cardTemplate?.series,
          type: card.cardTemplate?.type,
          base_hp: card.cardTemplate?.base_hp,
          base_atk: card.cardTemplate?.base_atk,
          base_def: card.cardTemplate?.base_def,
          base_price: card.cardTemplate?.base_price,
          totalQuantity: 0,
          variants: []
        });
      }
        
      const root = rootMap.get(templateId);
      root.totalQuantity++;
      
      const variantKey = `${card.quality}-${card.enhancement}`;
      let variant = root.variants.find((v: any) => v.key === variantKey);
      
      if (!variant) {
        const cardPrice = calculateCardPrice(card.cardTemplate?.base_price ?? 0, card.quality, card.enhancement);
        const sellPrice = cardPrice * 0.8;
        const stats = calculateCardStats(
          card.cardTemplate?.base_hp ?? 0,
          card.cardTemplate?.base_atk ?? 0,
          card.cardTemplate?.base_def ?? 0,
          card.enhancement
        );
        
        variant = {
          key: variantKey,
          quality: card.quality,
          enhancement: card.enhancement,
          quantity: 0,
          cards: [],
          sellPrice: sellPrice,
          cardPrice: cardPrice,
          base_hp: stats.hp,
          base_atk: stats.atk,
          base_def: stats.def,
          original_hp: card.cardTemplate?.base_hp,
          original_atk: card.cardTemplate?.base_atk,
          original_def: card.cardTemplate?.base_def
        };
        root.variants.push(variant);
      }
      
      variant.quantity++;
      variant.cards.push(card);
    });
    
    setRootCards(Array.from(rootMap.values()));
  };

  const groupAllCards = (cards: any[]) => {
    if (!cards || cards.length === 0) {
      setRootCards([]);
      return;
    }
    
    const rootMap = new Map();
    
    cards.forEach((card: any) => {
      if (!rootMap.has(card.id)) {
        rootMap.set(card.id, {
          templateId: card.id,
          name: card.name,
          image_url: card.image_url,
          rarity: card.rarity,
          description: card.description,
          series: card.series,
          type: card.type,
          base_hp: card.base_hp,
          base_atk: card.base_atk,
          base_def: card.base_def,
          base_price: card.base_price,
          totalQuantity: 0,
          variants: []
        });
      }
    });
    
    setRootCards(Array.from(rootMap.values()));
  };

  const getCurrentCards = () => {
    if (viewMode === 'your' && isSignedIn) {
      return rootCards;
    } else {
      return allCards.map((card: any) => ({
        templateId: card.id,
        name: card.name,
        image_url: card.image_url,
        rarity: card.rarity,
        description: card.description,
        series: card.series,
        type: card.type,
        base_hp: card.base_hp,
        base_atk: card.base_atk,
        base_def: card.base_def,
        base_price: card.base_price,
        totalQuantity: 0,
        variants: []
      }));
    }
  };

  const sellOneCard = async (card: any, variant: any, rootCard: any) => {
    if (!confirm(`Sell 1 "${rootCard.name}" (${variant.quality} • ${variant.enhancement}) for $${variant.sellPrice.toFixed(2)}?`)) return;
    
    try {
      await apiClient.sellCard(card.id);
      await refreshCollection();
      window.dispatchEvent(new Event('currency-updated'));
      window.dispatchEvent(new CustomEvent('achievements-updated'))
      
      const updatedVariants = selectedVariants.map((v: any) => {
        if (v.key === variant.key) {
          const newQuantity = v.quantity - 1;
          if (newQuantity === 0) {
            return null;
          }
          return {
            ...v,
            quantity: newQuantity,
            cards: v.cards.filter((c: any) => c.id !== card.id)
          };
        }
        return v;
      }).filter((v: any) => v !== null);
      
      setSelectedVariants(updatedVariants);
      
      if (updatedVariants.length === 0) {
        setSelectedRootCard(null);
      }

      clientState.addCurrency(variant.sellPrice);
    } catch (error) {
      console.error('Failed to sell card:', error);
      alert('Failed to sell card');
    }
  };

  const sellAllFromVariant = async (variant: any, rootCard: any) => {
    if (!confirm(`Sell ALL ${variant.quantity} ${rootCard.name} (${variant.quality} • ${variant.enhancement}) cards for $${(variant.sellPrice * variant.quantity).toFixed(2)}?`)) return;
    
    try {
      for (const card of variant.cards) {
        await apiClient.sellCard(card.id);
      }
      await refreshCollection();
      window.dispatchEvent(new Event('currency-updated'));
      window.dispatchEvent(new CustomEvent('achievements-updated'))
      
      const updatedVariants = selectedVariants.filter((v: any) => v.key !== variant.key);
      setSelectedVariants(updatedVariants);
      
      if (updatedVariants.length === 0) {
        setSelectedRootCard(null);
      }

      clientState.addCurrency(variant.sellPrice);
    } catch (error) {
      console.error('Failed to sell cards:', error);
      alert('Failed to sell cards');
    }
  };

  const sellAllUntilOne = async (_rootCard: any) => {
    const variantMap = new Map<string, any[]>();
    for (const variant of selectedVariants) {
      for (const card of variant.cards) {
        const key = `${card.quality}-${card.enhancement}`;
        if (!variantMap.has(key)) variantMap.set(key, []);
        variantMap.get(key)!.push(card);
      }
    }
    
    const cardsToSell: any[] = [];
    const qualityOrderLocal = ['CRISP', 'GOOD', 'REGULAR', 'POOR', 'TARNISHED'];
    const enhancementOrderLocal = ['SIGNED', 'SHINY', 'FOILED', 'BASIC'];
    
    for (const [_, cards] of variantMap) {
      if (cards.length > 1) {
        const bestCard = cards.reduce((best: any, current: any) => {
          const currentQualityIndex = qualityOrderLocal.indexOf(current.quality);
          const bestQualityIndex = qualityOrderLocal.indexOf(best.quality);
          if (currentQualityIndex < bestQualityIndex) return current;
          if (currentQualityIndex > bestQualityIndex) return best;
          const currentEnhancementIndex = enhancementOrderLocal.indexOf(current.enhancement);
          const bestEnhancementIndex = enhancementOrderLocal.indexOf(best.enhancement);
          return currentEnhancementIndex < bestEnhancementIndex ? current : best;
        });
        
        for (const card of cards) {
          if (card.id !== bestCard.id) cardsToSell.push(card);
        }
      }
    }
    
    if (cardsToSell.length === 0) {
      alert('You already have only 1 of each variant. Nothing to sell.');
      return;
    }
    
    const totalSellPrice = cardsToSell.reduce((sum: number, card: any) => {
      const variant = selectedVariants.find(v => v.cards.some((c: any) => c.id === card.id));
      return sum + (variant?.sellPrice || 0);
    }, 0);
    
    if (!confirm(`Keep 1 of each variant and sell ${cardsToSell.length} duplicate cards for $${totalSellPrice.toFixed(2)}?`)) return;
    
    try {
      const cardIds = cardsToSell.map(card => card.id);
      // Use batch sell - ONE API call instead of many
      const result = await apiClient.batchSellCards(cardIds);
      if (result.success) {
        clientState.addCurrency(result.totalSellPrice);
      }
      
      await refreshCollection();
      window.dispatchEvent(new Event('currency-updated'));
      window.dispatchEvent(new CustomEvent('achievements-updated'));
      setSelectedRootCard(null);
      setSelectedVariants([]);
    } catch (error) {
      console.error('Failed to sell cards:', error);
      alert('Failed to sell cards');
    }
  };

  const openRootCardDetails = (rootCard: any) => {
    setSelectedRootCard(rootCard);
    setSelectedVariants(rootCard.variants);
    setSelectedCardInfo(rootCard);
  };

  const getSortedRootCards = (cards: any[]) => {
    if (!cards || cards.length === 0) return [];
    
    let filtered = [...cards];

    if (showOnlyFavorites && isSignedIn) {
      filtered = filtered.filter(card => favorites.has(card.templateId));
    }
    
    switch (sortBy) {
      case 'rarity':
        filtered.sort((a, b) => {
          const orderA = rarityOrder[a.rarity] ?? 999;
          const orderB = rarityOrder[b.rarity] ?? 999;
          return sortDirection === 'asc' ? orderA - orderB : orderB - orderA;
        });
        break;
      case 'name':
        filtered.sort((a, b) => {
          return sortDirection === 'asc' 
            ? (a.name || '').localeCompare(b.name || '')
            : (b.name || '').localeCompare(a.name || '');
        });
        break;
      case 'base_price':
        filtered.sort((a, b) => {
          let priceA, priceB;
          
          if (viewMode === 'your' && isSignedIn) {
            priceA = a.variants?.length > 0 
              ? Math.max(...a.variants.map((v: any) => v.cardPrice))
              : 0;
            priceB = b.variants?.length > 0 
              ? Math.max(...b.variants.map((v: any) => v.cardPrice))
              : 0;
          } else {
            priceA = a.base_price || 0;
            priceB = b.base_price || 0;
          }
          
          return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
        });
        break;
      case 'quantity':
        filtered.sort((a, b) => {
          return sortDirection === 'asc' 
            ? (a.totalQuantity || 0) - (b.totalQuantity || 0)
            : (b.totalQuantity || 0) - (a.totalQuantity || 0);
        });
        break;
      case 'completion':
        filtered.sort((a, b) => {
          const totalVariants = 20;
          const completionA = a.variants?.length / totalVariants;
          const completionB = b.variants?.length / totalVariants;
          return sortDirection === 'asc' ? completionA - completionB : completionB - completionA;
        });
        break;
      case 'base_hp':
        filtered.sort((a, b) => {
          return sortDirection === 'asc' 
            ? (a.base_hp || 0) - (b.base_hp || 0)
            : (b.base_hp || 0) - (a.base_hp || 0);
        });
        break;
      case 'base_def':
        filtered.sort((a, b) => {
          return sortDirection === 'asc' 
            ? (a.base_def || 0) - (b.base_def || 0)
            : (b.base_def || 0) - (a.base_def || 0);
        });
        break;
      case 'base_atk':
        filtered.sort((a, b) => {
          return sortDirection === 'asc' 
            ? (a.base_atk || 0) - (b.base_atk || 0)
            : (b.base_atk || 0) - (a.base_atk || 0);
        });
        break;
    }
    
    return filtered;
  };

  const getPaginatedCards = () => {
    const sortedCards = getSortedRootCards(getCurrentCards());
    const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
    const endIndex = startIndex + CARDS_PER_PAGE;
    return sortedCards.slice(startIndex, endIndex);
  };

  const totalPages = () => {
    const sortedCards = getSortedRootCards(getCurrentCards());
    return Math.ceil(sortedCards.length / CARDS_PER_PAGE);
  };

  const goToPage = (page: number) => {
    const total = totalPages();
    if (page >= 1 && page <= total) {
      setCurrentPage(page);
      // Scroll to top of grid
      const gridElement = document.getElementById('card-grid');
      if (gridElement) {
        gridElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getSortedVariants = () => {
    const sorted = [...selectedVariants];
    
    if (priorityEnhancements) {
      // Sort by enhancement first, then quality
      sorted.sort((a, b) => {
        const enhancementIndexA = enhancementOrder.indexOf(a.enhancement);
        const enhancementIndexB = enhancementOrder.indexOf(b.enhancement);
        
        if (enhancementIndexA !== enhancementIndexB) {
          return variantSortDirection === 'asc' ? enhancementIndexA - enhancementIndexB : enhancementIndexB - enhancementIndexA;
        }
        
        const qualityIndexA = qualityOrder.indexOf(a.quality);
        const qualityIndexB = qualityOrder.indexOf(b.quality);
        
        return variantSortDirection === 'asc' ? qualityIndexA - qualityIndexB : qualityIndexB - qualityIndexA;
      });
    } else {
      // Sort by quality first, then enhancement (original behavior)
      sorted.sort((a, b) => {
        const qualityIndexA = qualityOrder.indexOf(a.quality);
        const qualityIndexB = qualityOrder.indexOf(b.quality);
        
        if (qualityIndexA !== qualityIndexB) {
          return variantSortDirection === 'asc' ? qualityIndexA - qualityIndexB : qualityIndexB - qualityIndexA;
        }
        
        const enhancementIndexA = enhancementOrder.indexOf(a.enhancement);
        const enhancementIndexB = enhancementOrder.indexOf(b.enhancement);
        
        return variantSortDirection === 'asc' ? enhancementIndexA - enhancementIndexB : enhancementIndexB - enhancementIndexA;
      });
    }
    
    return sorted;
  };

  const isCardOwned = (cardId: number) => {
    if (!isSignedIn) return false;
    return userCards.some((c: any) => c.card_template_id === cardId);
  };

  const toggleFavorite = async (cardId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSignedIn) {
      alert('Please sign in to favorite cards');
      return;
    }
    
    const newFavorited = !favorites.has(cardId);
    
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorited) {
        newFavorites.add(cardId);
      } else {
        newFavorites.delete(cardId);
      }
      return newFavorites;
    });
    
    try {
      await apiClient.toggleFavorite(cardId, newFavorited);
    } catch (error) {
      setFavorites(prev => {
        const newFavorites = new Set(prev);
        if (newFavorited) {
          newFavorites.delete(cardId);
        } else {
          newFavorites.add(cardId);
        }
        return newFavorites;
      });
      console.error('Failed to save favorite:', error);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {RARITY_CATEGORIES.map((rarity) => {
            const style = getRarityStyle(rarity);
            const owned = rarityCounts[rarity] || 0;
            const total = totalCardsPerRarity[rarity] || 0;
            const completed = completedCardsPerRarity[rarity] || 0;
            const percentage = total > 0 ? (owned / total) * 100 : 0;
            const completionPercentage = total > 0 ? (completed / total) * 100 : 0;
            
            return (
              <div 
                key={rarity}
                className={`bg-gray-900 rounded-lg p-3 border-2 ${style.borderColor} ${style.aura || ''} relative`}
              >
                {completed === total && total > 0 && (
                  <div className="absolute -top-2 -right-2 z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-yellow-400 rounded-full blur-sm opacity-50 animate-pulse"></div>
                      <span className="relative text-yellow-400 text-xl drop-shadow-lg">⭐</span>
                    </div>
                  </div>
                )}
                
                <div className={`text-xs font-semibold ${style.textColor} text-center`}>{rarity}</div>
                <div className="text-xl font-bold text-white mt-1">
                  {owned}
                  <span className="text-xs text-gray-500">/{total}</span>
                  {completed > 0 && (
                    <span className='float-right text-yellow-400 font-semibold'>
                      <span className='text-xl'>{completed}</span>
                      <span className='text-xs'>/{total}</span>
                    </span>
                  )}
                </div>
                
                {/* Collection progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      percentage === 100 ? 'bg-green-500' : 
                      rarity === 'COMMON' ? 'bg-gray-500' :
                      rarity === 'UNCOMMON' ? 'bg-green-500' :
                      rarity === 'SPARSE' ? 'bg-blue-500' :
                      rarity === 'RARE' ? 'bg-purple-500' :
                      rarity === 'UBER_RARE' ? 'bg-pink-500' :
                      rarity === 'MYTHICAL' ? 'bg-orange-500' :
                      rarity === 'LEGENDARY' ? 'bg-yellow-500' :
                      rarity === 'SPECIAL' ? 'bg-red-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                
                {/* Completed cards progress bar */}
                {completed > 0 && (
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div 
                      className="h-1.5 rounded-full transition-all duration-300 bg-yellow-500"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="flex flex-col gap-1 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">
              <button
                onClick={() => {
                  if (!isSignedIn) {
                    alert('Please sign in to view your collection');
                    return;
                  }
                  setViewMode('your');
                  localStorage.setItem('collectionViewMode', 'your');
                  refreshCollection();
                }}
                className={`px-2 py-1 rounded transition-colors underline ${viewMode === 'your' && isSignedIn ? 'text-white text-2xl' : 'text-gray-400 hover:text-white text-2l'}`}
              >
                Your
              </button>
              <span className="text-gray-500">/</span>
              <button
                onClick={() => {
                  setViewMode('entire');
                  localStorage.setItem('collectionViewMode', 'entire');
                  groupAllCards(allCards);
                }}
                className={`px-2 py-1 rounded transition-colors underline ${viewMode === 'entire' ? 'text-white text-2xl' : 'text-gray-400 hover:text-white text-2l'}`}
              >
                Entire
              </button>
              <span>Collection</span>
              <span className="text-gray-400 ml-2 font-normal text-base">
                ({viewMode === 'your' && isSignedIn ? userCards.length : allCards.length} total cards)
              </span>
            </h2>
          </div>
          
          {viewMode === 'your' && isSignedIn && (
            <div className="flex gap-4 text-sm text-gray-400">
              <span>Total value: ${totalValue.toFixed(2)}</span>
              {completedCardsCount > 0 && <span>Completed cards: {completedCardsCount}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSortBy('rarity')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'rarity' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By Rarity
            </button>
            <button
              onClick={() => setSortBy('base_price')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'base_price' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By Price
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'name' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By Name
            </button>
            <button
              onClick={() => setSortBy('quantity')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'quantity' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By Quantity
            </button>
            <button
              onClick={() => setSortBy('completion')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'completion' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By Completion
            </button>
            <button
              onClick={() => setSortBy('base_hp')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'base_hp' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By HP
            </button>
            <button
              onClick={() => setSortBy('base_def')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'base_def' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By DEF
            </button>
            <button
              onClick={() => setSortBy('base_atk')}
              className={`px-3 py-1 text-xs rounded transition-colors ${sortBy === 'base_atk' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              By ATK
            </button>
          </div>
          {isSignedIn && (
            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${showOnlyFavorites ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              ❤️
            </button>
          )}
          <button
            onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-1 text-xs rounded transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Card grid */}
        {getCurrentCards().length > 0 && (
          <>
            <div id="card-grid" className="flex flex-wrap gap-3 mt-10 justify-around sm:justify-start">
              {getPaginatedCards().map((rootCard: any) => {
                const style = getRarityStyle(rootCard.rarity);
                const owned = viewMode === 'your' && isSignedIn ? true : isCardOwned(rootCard.templateId);
                
                return (
                  <div 
                    id={`card-${rootCard.templateId}`}
                    key={rootCard.templateId}
                    onClick={() => viewMode === 'your' && isSignedIn ? openRootCardDetails(rootCard) : null}
                    onMouseEnter={() => setHoveredCard(rootCard.templateId)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className={`relative border-2 p-2 w-37.5 cursor-pointer transition-colors rounded-lg ${style.borderColor} ${style.aura || ''} ${
                      !owned && viewMode === 'entire' ? 'opacity-40 grayscale hover:opacity-60' : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                  style={(() => {
                    const hasSignedCrisp = rootCard.variants?.some((v: any) => 
                      v.enhancement === 'SIGNED' && v.quality === 'CRISP' && v.quantity > 0
                    );
                    if (hasSignedCrisp) {
                      const rarityColor = style.textColor.replace('text-', '');
                      let glowColor = '';
                      
                      switch (rarityColor) {
                        case 'gray-400': glowColor = '107,114,128'; break;
                        case 'green-400': glowColor = '74,222,128'; break;
                        case 'blue-400': glowColor = '96,165,250'; break;
                        case 'purple-400': glowColor = '192,132,252'; break;
                        case 'pink-400': glowColor = '244,114,182'; break;
                        case 'orange-400': glowColor = '251,146,60'; break;
                        case 'yellow-400': glowColor = '250,204,21'; break;
                        case 'red-400': glowColor = '248,113,113'; break;
                        default: glowColor = '255,255,255';
                      }
                      
                      return { boxShadow: `0 0 16px 1.5px rgba(${glowColor}, 0.5)` };
                    }
                    return {};
                  })()}
                >
                  {viewMode === 'your' && isSignedIn && (() => {
                    const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
                    const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
                    
                    const hasAllVariants = allQualities.every(quality =>
                      allEnhancements.every(enhancement => {
                        const variant = rootCard.variants?.find((v: any) => 
                          v.quality === quality && v.enhancement === enhancement
                        );
                        return variant && variant.quantity > 0;
                      })
                    );
                    
                    return hasAllVariants ? (
                      <>
                        <div className="absolute inset-0 rounded-lg pointer-events-none z-5 overflow-hidden">
                          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 opacity-50 to-transparent animate-shine skew-x-12"></div>
                        </div>
                      </>
                    ) : null;
                  })()}
                  {viewMode === 'your' && isSignedIn && rootCard.totalQuantity > 1 && (
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                      x{rootCard.totalQuantity}
                    </div>
                  )}
                  {rootCard.image_url && (
                    <img 
                      src={rootCard.image_url} 
                      alt={rootCard.name}
                      className="w-full h-25 object-contain mb-2"
                    />
                  )}
                  {viewMode === 'your' && isSignedIn && (
                    <button
                      onClick={(e) => toggleFavorite(rootCard.templateId, e)}
                      className={`absolute top-1 left-1 z-10 text-sm bg-gray-800 p-1 rounded-xl border-2 ${style.borderColor}`}
                    >
                      {favorites.has(rootCard.templateId) ? '❤️' : '🩶'}
                    </button>
                  )}

                  {viewMode === 'your' && isSignedIn && (() => {
                    const allQualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
                    const allEnhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
                    
                    const hasAllVariants = allQualities.every(quality =>
                      allEnhancements.every(enhancement => {
                        const variant = rootCard.variants?.find((v: any) => 
                          v.quality === quality && v.enhancement === enhancement
                        );
                        return variant && variant.quantity > 0;
                      })
                    );
                    
                    return hasAllVariants ? (
                      
                      <div className="absolute bottom-1 right-1 z-10 text-yellow-400 text-sm">
                        ⭐
                      </div>
                    ) : null;
                  })()}

                  <div className={`font-semibold text-sm truncate text-center ${style.textColor}`}>
                    {rootCard.name}
                  </div>
                  <div className={`text-xs text-center mt-1 ${style.textColor} opacity-75`}>
                    {rootCard.rarity}
                  </div>

                  {viewMode === 'your' && isSignedIn && rootCard.variants && (
                    <div className="absolute bottom-0 left-1.5 z-10">
                      <div className="">
                        <span className="text-[10px] text-yellow-400 font-mono font-bold">
                          {rootCard.variants.length}/20
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {viewMode === 'entire' && rootCard.base_price && (
                    <div className="text-xs text-center mt-1 text-green-500">
                      ${rootCard.base_price.toFixed(2)}
                    </div>
                  )}
                  
                  {hoveredCard === rootCard.templateId && (
                    <div 
                      ref={(el) => {
                        if (el && tooltipRefs.current) {
                          tooltipRefs.current.set(rootCard.templateId, el);
                          const rect = el.getBoundingClientRect();
                          const cardRect = document.getElementById(`card-${rootCard.templateId}`)?.getBoundingClientRect();
                          if (cardRect && rect.bottom > window.innerHeight) {
                            el.style.top = 'auto';
                            el.style.bottom = '100%';
                            el.style.marginTop = '0';
                            el.style.marginBottom = '8px';
                          }
                        }
                      }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl z-30 border border-gray-700 min-w-37.5"
                    >
                      <p className={`font-semibold mb-1 text-[14px] ${style.textColor}`}>{rootCard.name}</p>
                      <p className="text-gray-300 text-[12px] line-clamp-16">{rootCard.description || 'No description'}</p>
                      <p className={`text-[10px] mt-1 pt-1 ${style.textColor} opacity-75`}>{rootCard.series || 'Missing Series'} | {rootCard.type || 'Missing Type'}</p>
                      {viewMode === 'entire' && rootCard.base_price && (
                        <p className={`text-[10px] mt-1 pt-1 ${style.textColor}`}>Price: ${rootCard.base_price.toFixed(2)}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

            {totalPages() > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-lg flex items-center transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  
                  <ChevronLeftIcon className="w-4 h-" />
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                <ChevronLeftIcon className="w-4 h-4" />
                  
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">
                    Page {currentPage} of {totalPages()}
                  </span>
                </div>
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages()}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    currentPage === totalPages()
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToPage(totalPages())}
                  disabled={currentPage === totalPages()}
                  className={`px-3 py-2 rounded-lg flex items-center transition-colors ${
                    currentPage === totalPages()
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  
                  <ChevronRightIcon className="w-4 h-" />
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Show total count */}
            <div className="text-center text-gray-500 text-sm mt-2">
              Showing {Math.min(CARDS_PER_PAGE, getSortedRootCards(getCurrentCards()).length - (currentPage - 1) * CARDS_PER_PAGE)} of {getSortedRootCards(getCurrentCards()).length} cards
            </div>
          </>
        )}

        {isSignedIn && viewMode === 'your' && selectedRootCard && selectedVariants.length > 0 && (
          <div 
            onClick={() => { setSelectedRootCard(null); setSelectedVariants([]); }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-lg max-w-5xl w-[95%] max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Header - stays at top */}
              <div className="p-5 pb-2 border-b border-gray-700 shrink-0">
                <div className="flex justify-between items-center">
                  <h2 className={`text-2xl font-bold ${getRarityStyle(selectedRootCard.rarity).textColor}`}>
                    {selectedRootCard.name}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPriorityEnhancements(!priorityEnhancements)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        priorityEnhancements 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      title={priorityEnhancements ? 'Prioritizing Enhancements' : 'Prioritizing Quality'}
                    >
                      Enhancements First
                    </button>
                    <button
                      onClick={() => setVariantSortDirection(variantSortDirection === 'asc' ? 'desc' : 'asc')}
                      className="px-2 py-1 text-xs rounded transition-colors bg-gray-700 text-gray-300 hover:bg-gray-600"
                      title={variantSortDirection === 'asc' ? 'Ascending (Worst to Best)' : 'Descending (Best to Worst)'}
                    >
                      {variantSortDirection === 'asc' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Two-column layout inside scrollable area */}
              <div className="flex-1 min-h-0">
                <div className="flex h-full">
                  {/* Left column */}
                  <div className="flex-1 overflow-y-auto p-5 max-h-[calc(85vh-200px)]">
                    {getSortedVariants().map((variant: any) => (
                      <div 
                        key={variant.key}
                        className="border border-gray-700 rounded-lg p-3 mb-3 bg-gray-900"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <span className="font-semibold">Quality: {variant.quality}</span>
                            <span className="mx-2 text-gray-500">•</span>
                            <span>Enhancement: {variant.enhancement}</span>
                          </div>
                          <span className="bg-gray-700 px-2 py-1 rounded-full text-xs">
                            x{variant.quantity}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-300 mb-2">
                          <div className="mt-1">HP: {variant.base_hp} | ATK: {variant.base_atk} | DEF: {variant.base_def} 
                            {variant.enhancement !== 'BASIC' && (
                            <span className="text-green-500 text-xs ml-3">
                              {variant.enhancement === 'FOILED' && '+50% DEF'}
                              {variant.enhancement === 'SHINY' && '+50% HP'}
                              {variant.enhancement === 'SIGNED' && '+50% ATK'}
                            </span>
                            )}
                          </div> 
                        </div>
                        
                        <div className="text-sm mb-3 flex justify-between items-baseline">
                          <span>Value: ${variant.cardPrice.toFixed(2)} | Sell: ${variant.sellPrice.toFixed(2)} each</span>
                          {variant.quantity > 1 && (
                            <span className="text-xs text-gray-400">
                              Total: ${(variant.sellPrice * variant.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => sellOneCard(variant.cards[0], variant, selectedRootCard)}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-1.5 rounded transition-colors"
                          >
                            Sell 1
                          </button>
                          {variant.quantity > 1 && (
                            <button
                              onClick={() => sellAllFromVariant(variant, selectedRootCard)}
                              className="flex-1 bg-red-700 hover:bg-red-800 text-white text-sm py-1.5 rounded transition-colors"
                            >
                              Sell All ({variant.quantity})
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedCardInfo && (
                    <div className="hidden md:block w-80 border-l border-gray-700 flex flex-col shrink-0 overflow-y-auto max-h-[calc(85vh-200px)]">
                      <div className="p-4 border-b border-gray-700 shrink-0">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-bold text-lg ${getRarityStyle(selectedCardInfo.rarity).textColor}`}>
                            {selectedCardInfo.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap wrap-break-words">
                          {selectedCardInfo.description || 'No description available.'}
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                          {selectedCardInfo.series || 'Unknown'} | {selectedCardInfo.type || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - sticks to bottom */}
              <div className="flex gap-2 p-5 pt-3 bg-gray-800 border-t border-gray-700 shrink-0">
                {selectedVariants.flatMap(v => v.cards).length > 1 && (
                  <button
                    onClick={() => sellAllUntilOne(selectedRootCard)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded transition-colors"
                  >
                    Sell All Until 1
                  </button>
                )}
                <button
                  onClick={() => { setSelectedRootCard(null); setSelectedVariants([]); }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}