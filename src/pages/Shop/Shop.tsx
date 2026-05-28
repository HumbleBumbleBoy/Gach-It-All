import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';
import PackOpeningModal from '../../components/PackOpeningModal';

interface ShopItem {
  id: number;
  name: string;
  description: string;
  item_type: string;
  price: number;
  image_url: string;
  rarity?: string;
}

// Fixed shop slots configuration
const SHOP_SLOTS = [
  // Row 1: Special Pack + 2 Boosted Packs
  { id: 1, type: 'ONE_TIME_PACK', title: 'Special Pack', description: 'Limited edition pack', section: 'row1', refreshDaily: true, limitOne: true, highlighted: true, canBuyMultiple: false },
  { id: 2, type: 'MULTI_BUY_PACK', title: 'Boosted Pack', description: 'Enhanced rates', section: 'row1', refreshDaily: true, limitOne: false, canBuyMultiple: true },
  { id: 3, type: 'MULTI_BUY_PACK', title: 'Boosted Pack', description: 'Enhanced rates', section: 'row1', refreshDaily: true, limitOne: false, canBuyMultiple: true },
  
  // Row 2: 5 Cards + Mythical Card
  { id: 4, type: 'CARD_SLOT', title: 'Common Card', description: 'Random common card', section: 'row2', rarity: 'COMMON', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 5, type: 'CARD_SLOT', title: 'Uncommon Card', description: 'Random uncommon card', section: 'row2', rarity: 'UNCOMMON', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 6, type: 'CARD_SLOT', title: 'Sparse Card', description: 'Random sparse card', section: 'row2', rarity: 'SPARSE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 7, type: 'CARD_SLOT', title: 'Rare Card', description: 'Random rare card', section: 'row2', rarity: 'RARE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 8, type: 'CARD_SLOT', title: 'Uber Rare Card', description: 'Random uber rare card', section: 'row2', rarity: 'UBER_RARE', refreshOnPurchase: false, limitOne: false, canBuyMultiple: true },
  { id: 9, type: 'MYTHICAL_CARD', title: 'Mythic Card', description: 'Random mythical card', section: 'row2', refreshDaily: true, limitOne: true, highlighted: true, canBuyMultiple: false },
  
  // Row 3: 3 Cosmetic Items
  { id: 10, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
  { id: 11, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
  { id: 12, type: 'ITEM_SLOT', title: 'Cosmetic', description: 'Special cosmetic item', section: 'row3', refreshDaily: true, limitOne: true, canBuyMultiple: false },
];

export default function Shop() {
  const { isSignedIn } = useUser();
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [openedCards, setOpenedCards] = useState<any[]>([]);
  const [existingCardIds, setExistingCardIds] = useState<Set<number>>(new Set());
  const [purchasedSlots, setPurchasedSlots] = useState<Set<number>>(new Set());
  const [slotItems, setSlotItems] = useState<Map<number, ShopItem>>(new Map());
  const [timeUntilRefresh, setTimeUntilRefresh] = useState<string>('');

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

  // Save shop items to localStorage whenever they change
  useEffect(() => {
    if (slotItems.size > 0) {
      const toSave: Record<number, ShopItem> = {};
      slotItems.forEach((value, key) => {
        toSave[key] = value;
      });
      localStorage.setItem('shopItems', JSON.stringify(toSave));
    }
  }, [slotItems]);

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
    const saved = localStorage.getItem('purchasedSlots');
    if (saved) {
      setPurchasedSlots(new Set(JSON.parse(saved)));
    }
  };

  const loadShop = async () => {
    // Check if we already have shop items saved today
    const lastRefresh = localStorage.getItem('shopLastRefresh');
    const today = new Date().toDateString();
    
    // Always check localStorage directly instead of relying on state
    const savedShopItems = localStorage.getItem('shopItems');
    const hasSavedItems = savedShopItems && JSON.parse(savedShopItems) && Object.keys(JSON.parse(savedShopItems)).length > 0;
    
    if (lastRefresh === today && hasSavedItems) {
      // Restore from localStorage if not already in state
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
        
        // Skip mythical card slot if no mythical cards exist
        if (slot.type === 'MYTHICAL_CARD' && availableItems.length === 0) {
          continue;
        }
        
        if (availableItems.length > 0) {
          const selectedItem = slot.type === 'CARD_SLOT' 
            ? availableItems[0]
            : availableItems[Math.floor(Math.random() * availableItems.length)];
          newSlotItems.set(slot.id, selectedItem);
        }
      }
      
      setSlotItems(newSlotItems);
      localStorage.setItem('shopLastRefresh', today);
    } catch (error) {
      console.error('Failed to load shop:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchaseItem = async (slot: typeof SHOP_SLOTS[0]) => {
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    const item = slotItems.get(slot.id);
    if (!item) {
      alert('Item not available');
      return;
    }
    
    if (!item.id) {
      alert('Invalid item ID');
      return;
    }
    
    if (slot.limitOne && purchasedSlots.has(slot.id)) {
      alert('You already purchased this item');
      return;
    }
    
    setPurchasing(slot.id);
    
    try {
      const result = await apiClient.purchaseShopItem(item.id);
      
      if (result.success) {
        if (result.reward?.type === 'pack') {
          alert(`Pack purchased! It has been added to your inventory.`);
        } else if (result.reward?.type === 'card') {
          alert(`You received: ${result.reward.card.cardTemplate.name}`);
        } else if (result.reward?.type === 'item') {
          alert(`You received: ${result.reward.item.name}`);
        }
        
        if (slot.limitOne) {
          const newPurchased = new Set(purchasedSlots);
          newPurchased.add(slot.id);
          setPurchasedSlots(newPurchased);
          localStorage.setItem('purchasedSlots', JSON.stringify(Array.from(newPurchased)));
        }
        
        // Refresh the specific slot with a new random card of the same rarity
        if (slot.type === 'CARD_SLOT' && !slot.limitOne) {
          await refreshCardSlot(slot);
        }
        
        window.dispatchEvent(new Event('currency-updated'));
        window.dispatchEvent(new CustomEvent('achievements-updated'));
      } else {
        alert(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const refreshCardSlot = async (slot: typeof SHOP_SLOTS[0]) => {
    try {
      const data = await apiClient.getShopItems();
      const items = data.items || [];
      
      // Get a new random card of the same rarity
      const availableItems = items.filter((item: ShopItem) => 
        item.item_type === slot.type && item.rarity === slot.rarity
      );
      
      if (availableItems.length > 0) {
        const newCard = availableItems[Math.floor(Math.random() * availableItems.length)];
        setSlotItems(prev => {
          const newMap = new Map(prev);
          newMap.set(slot.id, newCard);
          
          // Update localStorage immediately
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

  const getSlotContent = (slot: typeof SHOP_SLOTS[0]) => {
    const item = slotItems.get(slot.id);
    const isPurchased = slot.limitOne && purchasedSlots.has(slot.id);
    
    if (!item) {
      return {
        title: slot.title,
        description: 'Loading...',
        price: 0,
        image: null,
        canPurchase: false
      };
    }
    
    return {
      title: item.name || slot.title,
      description: item.description || slot.description,
      price: item.price,
      image: item.image_url,
      canPurchase: !isPurchased
    };
  };

  const row1Slots = SHOP_SLOTS.filter(s => s.section === 'row1');
  const row2Slots = SHOP_SLOTS.filter(s => {
    if (s.section !== 'row2') return false;
    // If it's a mythical card slot, only show if we have an item for it
    if (s.type === 'MYTHICAL_CARD') {
      return slotItems.has(s.id);
    }
    return true;
  });
  const row3Slots = SHOP_SLOTS.filter(s => s.section === 'row3');

  const renderSlot = (slot: typeof SHOP_SLOTS[0], isHighlighted = false) => {
    const content = getSlotContent(slot);
    const isPurchased = slot.limitOne && purchasedSlots.has(slot.id);
    
    // Generate random quality for card slots
    const qualities = ['TARNISHED', 'POOR', 'REGULAR', 'GOOD', 'CRISP'];
    const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
    const qualityMultipliers = {
      TARNISHED: 0.3,
      POOR: 0.66,
      REGULAR: 1,
      GOOD: 1.25,
      CRISP: 1.5
    };
    const qualityBonus = qualityMultipliers[randomQuality as keyof typeof qualityMultipliers];
    const qualityText = randomQuality.charAt(0) + randomQuality.slice(1).toLowerCase();
    
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
          <h3 className="text-xl font-bold text-white truncate">{content.title}</h3>
        </div>
        
        {content.image && (
          <div className="relative group">
            <img 
              src={content.image} 
              alt={content.title}
              className="w-32 h-32 object-contain mx-auto my-4 cursor-pointer"
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-50">
              <p className="font-semibold text-sm">{content.title}</p>
              <p className="text-gray-400 text-xs mt-1">{content.description}</p>
              <div className="mt-2 pt-2 border-t border-gray-700">
                {slot.type === 'CARD_SLOT' || slot.type === 'MYTHICAL_CARD' ? (
                  <>
                    <p className="text-xs">
                      <span className="text-gray-400">Quality:</span>{' '}
                      <span className="text-blue-400 font-semibold">{qualityText}</span>
                      <span className="text-gray-500 text-[10px] ml-1">({qualityBonus}x)</span>
                    </p>
                    <p className="text-xs mt-1">
                      <span className="text-gray-400">Value:</span>{' '}
                      <span className="text-green-400 font-semibold">${(content.price * qualityBonus).toFixed(2)}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-xs">
                    <span className="text-gray-400">Price:</span>{' '}
                    <span className="text-green-400 font-semibold">${content.price.toFixed(2)}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
          <span className="text-2xl font-bold text-green-400">
            ${content.price.toFixed(2)}
          </span>
          
          <button
            onClick={() => purchaseItem(slot)}
            disabled={!content.canPurchase || purchasing === slot.id || isPurchased}
            className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
              content.canPurchase && !isPurchased
                ? isHighlighted
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 cursor-not-allowed text-gray-400'
            } disabled:opacity-50`}
          >
            {isPurchased ? 'Purchased' : 'Buy'}
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
      
      <PackOpeningModal
        isOpen={showPackModal}
        cards={openedCards}
        onClose={() => {
          setShowPackModal(false);
          setOpenedCards([]);
          loadExistingCards();
        }}
        existingCardIds={existingCardIds}
      />
    </>
  );
}