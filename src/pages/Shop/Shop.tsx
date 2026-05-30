import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

interface ShopItem {
  id: number;
  name: string;
  description: string;
  item_type: string;
  price: number;
  image_url: string;
  rarity?: string;
  quality?: string;
  enhancement?: string;
  finalPrice?: number;
  qualityMult?: number;
  enhancementMult?: number;
  base_hp?: number;
  base_atk?: number;
  base_def?: number;
  base_price?: number;
  series?: string;
  type?: string; 
}

// Fixed shop slots configuration
const SHOP_SLOTS = [
  { id: 1, type: 'ONE_TIME_PACK', title: 'Special Pack', description: 'Limited edition pack', section: 'row1', refreshDaily: true, limitOne: true, highlighted: true, canBuyMultiple: false },
  { id: 2, type: 'MULTI_BUY_PACK', title: 'Boosted Pack', description: 'Enhanced rates', section: 'row1', refreshDaily: true, limitOne: false, canBuyMultiple: true },
  { id: 3, type: 'MULTI_BUY_PACK', title: 'Boosted Pack', description: 'Enhanced rates', section: 'row1', refreshDaily: true, limitOne: false, canBuyMultiple: true },
  { id: 4, type: 'CARD_SLOT', title: 'Common Card', description: 'Random common card', section: 'row2', rarity: 'COMMON', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 5, type: 'CARD_SLOT', title: 'Uncommon Card', description: 'Random uncommon card', section: 'row2', rarity: 'UNCOMMON', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 6, type: 'CARD_SLOT', title: 'Sparse Card', description: 'Random sparse card', section: 'row2', rarity: 'SPARSE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 7, type: 'CARD_SLOT', title: 'Rare Card', description: 'Random rare card', section: 'row2', rarity: 'RARE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 8, type: 'CARD_SLOT', title: 'Uber Rare Card', description: 'Random uber rare card', section: 'row2', rarity: 'UBER_RARE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 9, type: 'MYTHICAL_CARD', title: 'Mythic Card', description: 'Random mythical card', section: 'row2', rarity: 'MYTHICAL', refreshDaily: true, limitOne: true, highlighted: true, canBuyMultiple: false },
  { id: 10, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
  { id: 11, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
  { id: 12, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
];

const qualityMultipliers = {
  TARNISHED: 0.3,
  POOR: 0.66,
  REGULAR: 1,
  GOOD: 1.25,
  CRISP: 1.5
};

const enhancementMultipliers = {
  BASIC: 1,
  FOILED: 1.25,
  SHINY: 1.5,
  SIGNED: 2
};

const rarityColors: Record<string, string> = {
  COMMON: 'text-gray-400',
  UNCOMMON: 'text-green-400',
  SPARSE: 'text-blue-400',
  RARE: 'text-purple-400',
  UBER_RARE: 'text-pink-400',
  MYTHICAL: 'text-orange-400',
  LEGENDARY: 'text-yellow-400',
  SPECIAL: 'text-red-400'
};

export default function Shop() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [_existingCardIds, setExistingCardIds] = useState<Set<number>>(new Set());
  const [purchasedSlots, setPurchasedSlots] = useState<Set<number>>(new Set());
  const [slotItems, setSlotItems] = useState<Map<number, ShopItem>>(new Map());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [purchasedSlotsLoaded, setPurchasedSlotsLoaded] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      loadShop();
      loadExistingCards();
      loadPurchasedHistory();
      calculateRefreshTime();
      
      const interval = setInterval(calculateRefreshTime, 60000);
      return () => clearInterval(interval);
    }
  }, [isSignedIn]);

  const calculateRefreshTime = () => {
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    setTimeUntilRefresh(`${hours}h ${minutes}m`);
  };

  const loadExistingCards = async () => {
    try {
      const collection = await apiClient.getCollection();
      const existingIds = new Set<number>(collection.items.map((c: any) => c.card_template_id));
      setExistingCardIds(existingIds);
    } catch (error) {
      console.error('Failed to load existing cards:', error);
    }
  };

  const loadPurchasedHistory = async () => {
    try {
      const data = await apiClient.getPurchasedSlots();
      setPurchasedSlots(new Set(data.purchasedSlots || []));
      setPurchasedSlotsLoaded(true);
    } catch (error) {
      console.error('Failed to load purchased history:', error);
      setPurchasedSlotsLoaded(true);
    }
  };

  const loadShop = async () => {
    const lastRefresh = localStorage.getItem('shopLastRefresh');
    const today = new Date().toDateString();
    
    const savedShopItems = localStorage.getItem('shopItems');
    const hasSavedItems = savedShopItems && JSON.parse(savedShopItems) && Object.keys(JSON.parse(savedShopItems)).length > 0;
    
    if (lastRefresh === today && hasSavedItems) {
      if (slotItems.size === 0 && savedShopItems) {
        const parsed = JSON.parse(savedShopItems);
        const restoredMap = new Map();
        Object.entries(parsed).forEach(([key, value]) => {
          restoredMap.set(parseInt(key), value);
        });
        setSlotItems(restoredMap);
      }
      return;
    }
    
    setLoading(true);
    try {
      const data = await apiClient.getShopItems();
      const items = data.items || [];
      
      const newSlotItems = new Map();
      
      for (const slot of SHOP_SLOTS) {
        let availableItems = [];
        
        if (slot.type === 'CARD_SLOT') {
          availableItems = items.filter((item: ShopItem) => 
            item.item_type === slot.type && item.rarity === slot.rarity
          );
        } else {
          availableItems = items.filter((item: ShopItem) => item.item_type === slot.type);
        }
        
        if (slot.type === 'MYTHICAL_CARD' && availableItems.length === 0) {
          continue;
        }
        
        if (availableItems.length > 0) {
          const selectedItem = slot.type === 'CARD_SLOT' 
            ? availableItems[0]
            : availableItems[Math.floor(Math.random() * availableItems.length)];
          
          if (slot.type === 'CARD_SLOT' || slot.type === 'MYTHICAL_CARD') {
            const qualities = slot.type === 'MYTHICAL_CARD' 
              ? ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP']
              : ['TARNISHED', 'POOR', 'REGULAR', 'GOOD'];
            const enhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
            const enhancementWeights = [85, 10, 4, 1];
            
            let enhancementRandom = Math.random() * 100;
            let enhancementCumulative = 0;
            let selectedEnhancement = 'BASIC';
            for (let i = 0; i < enhancements.length; i++) {
              enhancementCumulative += enhancementWeights[i];
              if (enhancementRandom <= enhancementCumulative) {
                selectedEnhancement = enhancements[i];
                break;
              }
            }
            
            const quality = qualities[Math.floor(Math.random() * qualities.length)];
            const enhancement = selectedEnhancement;
            const qualityMult = qualityMultipliers[quality as keyof typeof qualityMultipliers];
            const enhancementMult = enhancementMultipliers[enhancement as keyof typeof enhancementMultipliers];
            const finalPrice = selectedItem.price * qualityMult * enhancementMult;
            
            newSlotItems.set(slot.id, {
              ...selectedItem,
              quality: quality,
              enhancement: enhancement,
              finalPrice: finalPrice,
              qualityMult: qualityMult,
              enhancementMult: enhancementMult
            });
          } else {
            newSlotItems.set(slot.id, selectedItem);
          }
        }
      }
      
      setSlotItems(newSlotItems);
      
      // SAVE TO LOCALSTORAGE
      const toSave: Record<number, ShopItem> = {};
      newSlotItems.forEach((value, key) => {
        toSave[key] = value;
      });
      localStorage.setItem('shopItems', JSON.stringify(toSave));
      localStorage.setItem('shopLastRefresh', today);
      
    } catch (error) {
      console.error('Failed to load shop:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseItem = async (slot: typeof SHOP_SLOTS[0], item: ShopItem) => {
    if (!isSignedIn) {
      setToast({ show: true, message: 'Please sign in first!', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    if (slot.limitOne && purchasedSlots.has(slot.id)) {
      setToast({ show: true, message: 'You already purchased this item!', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    setPurchasing(slot.id);
    
    try {
      const result = await apiClient.purchaseShopItem({
        itemId: item.id,
        quality: item.quality,
        enhancement: item.enhancement,
        price: item.finalPrice || item.price,
        slotId: slot.id
      });
      
      if (result.success) {
        let message = '';
        if (slot.limitOne) {
          const newPurchased = new Set(purchasedSlots);
          newPurchased.add(slot.id);
          setPurchasedSlots(newPurchased);
        }
        if (result.reward?.type === 'pack') {
          message = `Pack purchased! Added to inventory.`;
        } else if (result.reward?.type === 'card') {
          const qualityText = item.quality ? item.quality.toLowerCase() : 'unknown';
          const enhancementText = item.enhancement ? item.enhancement.toLowerCase() : 'unknown';
          message = `Received: ${result.reward.card.cardTemplate.name} (${qualityText}, ${enhancementText})`;
        } else if (result.reward?.type === 'item') {
          message = `Received: ${result.reward.item.name}`;
        }
        
        setToast({ show: true, message, type: 'success' });
        setTimeout(() => setToast(null), 4000);
        
        if (slot.limitOne) {
          const newPurchased = new Set(purchasedSlots);
          newPurchased.add(slot.id);
          setPurchasedSlots(newPurchased);
        }
        
        if (slot.type === 'CARD_SLOT' && !slot.limitOne) {
          await refreshCardSlot(slot);
        }
        
        window.dispatchEvent(new Event('currency-updated'));
        window.dispatchEvent(new CustomEvent('achievements-updated'));
      } else {
        setToast({ show: true, message: result.error || 'Purchase failed', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      setToast({ show: true, message: 'Purchase failed!', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPurchasing(null);
    }
  };

  const refreshCardSlot = async (slot: typeof SHOP_SLOTS[0]) => {
    try {
      const data = await apiClient.getShopItems();
      const items = data.items || [];
      
      const availableItems = items.filter((item: ShopItem) => 
        item.item_type === slot.type && item.rarity === slot.rarity
      );
      
      if (availableItems.length > 0) {
        const newCard = availableItems[Math.floor(Math.random() * availableItems.length)];
        
        const qualities = slot.type === 'MYTHICAL_CARD' 
          ? ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP']
          : ['TARNISHED', 'POOR', 'REGULAR', 'GOOD'];
        const enhancements = ['BASIC', 'FOILED', 'SHINY', 'SIGNED'];
        const enhancementWeights = [85, 10, 4, 1];
        
        let enhancementRandom = Math.random() * 100;
        let enhancementCumulative = 0;
        let selectedEnhancement = 'BASIC';
        for (let i = 0; i < enhancements.length; i++) {
          enhancementCumulative += enhancementWeights[i];
          if (enhancementRandom <= enhancementCumulative) {
            selectedEnhancement = enhancements[i];
            break;
          }
        }
        
        const quality = qualities[Math.floor(Math.random() * qualities.length)];
        const enhancement = selectedEnhancement;
        const qualityMult = qualityMultipliers[quality as keyof typeof qualityMultipliers];
        const enhancementMult = enhancementMultipliers[enhancement as keyof typeof enhancementMultipliers];
        const finalPrice = newCard.price * qualityMult * enhancementMult;
        
        const fullCardItem = {
          ...newCard,
          quality: quality,
          enhancement: enhancement,
          finalPrice: finalPrice,
          qualityMult: qualityMult,
          enhancementMult: enhancementMult
        };
        
        setSlotItems(prev => {
          const newMap = new Map(prev);
          newMap.set(slot.id, fullCardItem);
          
          const toSave: Record<number, ShopItem> = {};
          newMap.forEach((value, key) => {
            toSave[key] = value;
          });
          localStorage.setItem('shopItems', JSON.stringify(toSave));
          
          return newMap;
        });
      }
    } catch (error) {
      console.error('Failed to refresh card slot:', error);
    }
  };

  const row1Slots = SHOP_SLOTS.filter(s => s.section === 'row1');
  const row2Slots = SHOP_SLOTS.filter(s => {
    if (s.section !== 'row2') return false;
    if (s.type === 'MYTHICAL_CARD') {
      return slotItems.has(s.id);
    }
    return true;
  });
  const row3Slots = SHOP_SLOTS.filter(s => s.section === 'row3');

  const Toast = () => {
    if (!toast?.show) return null;
    
    return (
      <div className="fixed bottom-4 right-4 z-50 animate slide-in-from-right duration-500">
        <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-75 ${
          toast.type === 'success' ? 'bg-green-500' : 
          toast.type === 'error' ? 'bg-red-600' : 
          'bg-blue-600'
        }`}>
          {toast.type === 'success' && (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p className="text-white text-sm">{toast.message}</p>
        </div>
      </div>
    );
  };

  const renderSlot = (slot: typeof SHOP_SLOTS[0], isHighlighted = false) => {
    const item = slotItems.get(slot.id) as ShopItem | undefined;
    const isPurchased = slot.limitOne && purchasedSlots.has(slot.id);
    const titleColor = slot.rarity ? rarityColors[slot.rarity] || 'text-white' : 'text-white';
    
    if (!item || !purchasedSlotsLoaded) {
        return (
          <div key={slot.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="text-center text-gray-400">Loading...</div>
          </div>
        );
      }
    
    const isCard = slot.type === 'CARD_SLOT' || slot.type === 'MYTHICAL_CARD';
    const displayPrice = isCard && item.finalPrice ? item.finalPrice : item.price;
    const quality = isCard && item.quality ? item.quality : null;
    const enhancement = isCard && item.enhancement ? item.enhancement : null;
    const qualityMult = isCard && item.qualityMult ? item.qualityMult : null;
    const enhancementMult = isCard && item.enhancementMult ? item.enhancementMult : null;
    const rarityColor = item.rarity ? rarityColors[item.rarity] || 'text-gray-400' : 'text-gray-400';
    
    return (
      <div 
        key={slot.id} 
        className={`bg-gray-800 rounded-lg p-6 border transition-colors ${
          isHighlighted 
            ? 'border-gray-500 ring-2 ring-gray-600/50 bg-linear-to-br from-gray-800 to-gray-900/50' 
            : 'border-gray-700 hover:border-gray-500'
        }`}
      >
        <div>
          <h3 className={`text-xl font-bold truncate text-center ${titleColor}`}>{item.name || slot.title}</h3>
        </div>
        
        {item.image_url && (
          <div className="relative group">
            <img 
              src={item.image_url} 
              alt={item.name || slot.title}
              className="w-32 h-32 object-contain mx-auto my-4 cursor-pointer"
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-50">
              <p className={`font-semibold text-sm ${rarityColor}`}>{item.name || slot.title}</p>
              <p className="text-gray-400 text-xs mt-1 line-clamp-10">{item.description}</p>
              <div className="mt-2 pt-2 border-t border-gray-700">
                {isCard && quality && enhancement ? (
                  <>                    
                    <p className="text-xs mt-1">
                      <span className="text-gray-400">Quality:</span>{' '}
                      <span className="text-blue-400 font-semibold">{quality.toLowerCase()}</span>
                      <span className="text-gray-500 text-[10px] ml-1">({qualityMult}x)</span>
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-gray-400">Enhancement:</span>{' '}
                      <span className="text-purple-400 font-semibold">{enhancement.toLowerCase()}</span>
                      <span className="text-gray-500 text-[10px] ml-1">({enhancementMult}x)</span>
                    </p>
                    {(item.base_hp !== undefined || item.base_atk !== undefined || item.base_def !== undefined) && (
                      <p className={`text-xs mt-1 ${rarityColor}`}>
                        <span>{item.base_hp || '?'} HP</span> |{' '}
                        <span>{item.base_def || '?'} DEF</span> |{' '}
                        <span>{item.base_atk || '?'} ATK</span>
                      </p>
                    )}
                    <p className={`text-[10px] mt-1 ${rarityColor}`}>
                      {item.series && <span>{item.series}</span>}
                      {item.series && item.type && <span> | </span>}
                      {item.type && <span>{item.type}</span>}
                    </p>
                  </>
                ) : (
                  <p className="text-xs">
                    <span className="text-gray-400">Price:</span>{' '}
                    <span className="text-green-400 font-semibold">${displayPrice.toFixed(2)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <span className="text-lg font-bold text-green-400">
            ${displayPrice.toFixed(2)}
          </span>
          
          <button
            onClick={() => purchaseItem(slot, item)}
            disabled={slot.limitOne ? (purchasedSlots.has(slot.id) || isPurchased || purchasing === slot.id) : (purchasing === slot.id)}
            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
              (!slot.limitOne || !purchasedSlots.has(slot.id)) && !isPurchased
                ? isHighlighted
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            } disabled:opacity-50`}
          >
            {isPurchased ? 'Sold' : 'Buy'}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-8">Loading shop...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-gray-400">Items will refresh in {timeUntilRefresh}.</p>
        </div>

        {row1Slots.length > 0 && (
          <div className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {row1Slots.map((slot, index) => renderSlot(slot, index === 0))}
            </div>
          </div>
        )}

        {row2Slots.length > 0 && (
          <div className="mb-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {row2Slots.map((slot, index) => renderSlot(slot, index === 5))}
            </div>
          </div>
        )}

        {row3Slots.length > 0 && (
          <div className="mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {row3Slots.map(slot => renderSlot(slot))}
            </div>
          </div>
        )}
      </main>

      <Toast />
    </>
  );
}