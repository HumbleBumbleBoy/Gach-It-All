import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

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
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [rootCards, setRootCards] = useState<any[]>([]);
  const [selectedRootCard, setSelectedRootCard] = useState<any>(null);
  const [selectedVariants, setSelectedVariants] = useState<any[]>([]);

  useEffect(() => {
    if (isSignedIn && user) {
      refreshCollection();
    }
  }, [isSignedIn, user]);

  const refreshCollection = async () => {
    const data = await apiClient.getCollection();
    setUserCards(data.items);
    groupByRootCard(data.items);
  };

  const groupByRootCard = (cards: any[]) => {
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
          totalQuantity: 0,
          variants: []
        });
      }
      
      const root = rootMap.get(templateId);
      root.totalQuantity++;
      
      const variantKey = `${card.quality}-${card.enhancement}`;
      let variant = root.variants.find((v: any) => v.key === variantKey);
      
      if (!variant) {
        const cardPrice = calculateCardPrice(card.cardTemplate?.base_price, card.quality, card.enhancement);
        const sellPrice = cardPrice * 0.8;
        const stats = calculateCardStats(
          card.cardTemplate?.base_hp,
          card.cardTemplate?.base_atk,
          card.cardTemplate?.base_def,
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
    
    const sortedRootCards = Array.from(rootMap.values()).sort((a, b) => {
      const orderA = rarityOrder[a.rarity] ?? 999;
      const orderB = rarityOrder[b.rarity] ?? 999;
      return orderA - orderB;
    });
    
    setRootCards(sortedRootCards);
  };

  const sellOneCard = async (card: any, variant: any, rootCard: any) => {
    if (!confirm(`Sell 1 "${rootCard.name}" (${variant.quality} • ${variant.enhancement}) for $${variant.sellPrice.toFixed(2)}?`)) return;
    
    try {
      await apiClient.sellCard(card.id);
      await refreshCollection();
      window.dispatchEvent(new Event('currency-updated'));
      
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
      
      const updatedVariants = selectedVariants.filter((v: any) => v.key !== variant.key);
      setSelectedVariants(updatedVariants);
      
      if (updatedVariants.length === 0) {
        setSelectedRootCard(null);
      }
    } catch (error) {
      console.error('Failed to sell cards:', error);
      alert('Failed to sell cards');
    }
  };

  const openRootCardDetails = (rootCard: any) => {
    setSelectedRootCard(rootCard);
    setSelectedVariants(rootCard.variants);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Your card collection ({userCards.length} total cards)</h1>
        
        {rootCards.length === 0 && <div className="text-gray-400">Nothing here yet...</div>}
        
        {rootCards.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-5">
            {rootCards.map((rootCard: any) => {
              const style = getRarityStyle(rootCard.rarity);
              return (
                <div 
                  key={rootCard.templateId}
                  onClick={() => openRootCardDetails(rootCard)}
                  onMouseEnter={() => setHoveredCard(rootCard.templateId)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className={`relative border-2 p-2 w-37.5 cursor-pointer bg-gray-900 hover:bg-gray-800 transition-colors rounded-lg ${style.borderColor} ${style.aura || ''}`}
                >
                  {rootCard.totalQuantity > 1 && (
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
                  <div className={`font-semibold text-sm truncate text-center ${style.textColor}`}>
                    {rootCard.name}
                  </div>
                  <div className={`text-xs text-center mt-1 ${style.textColor} opacity-75`}>
                    {rootCard.rarity}
                  </div>
                  
                  {hoveredCard === rootCard.templateId && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl z-30 border border-gray-700 min-w-37.5">
                      <p className={`font-semibold mb-1 ${style.textColor}`}>{rootCard.name}</p>
                      <p className="text-gray-300 text-[10px]">{rootCard.description || 'No description'}</p>
                      <p className={`text-[10px] mt-1 ${style.textColor} opacity-75`}>Rarity: {rootCard.rarity}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal showing all variants of the selected card */}
        {selectedRootCard && selectedVariants.length > 0 && (
          <div 
            onClick={() => { setSelectedRootCard(null); setSelectedVariants([]); }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 p-5 rounded-lg max-w-lg w-[90%] max-h-[80vh] overflow-y-auto"
            >
              <h2 className={`text-2xl font-bold mb-4 ${getRarityStyle(selectedRootCard.rarity).textColor}`}>
                {selectedRootCard.name}
              </h2>
              
              {selectedVariants.map((variant: any) => (
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
                    <div>Base Stats: HP: {variant.original_hp} | ATK: {variant.original_atk} | DEF: {variant.original_def}</div>
                    {variant.enhancement !== 'BASIC' && (
                      <div className="text-green-400 text-xs mt-1">
                        {variant.enhancement === 'FOILED' && '+50% DEF'}
                        {variant.enhancement === 'SHINY' && '+50% HP'}
                        {variant.enhancement === 'SIGNED' && '+50% ATK'}
                      </div>
                    )}
                    <div className="mt-1">Final Stats: HP: {variant.base_hp} | ATK: {variant.base_atk} | DEF: {variant.base_def}</div>
                  </div>
                  
                  <div className="text-sm mb-3">
                    Value: ${variant.cardPrice.toFixed(2)} | Sell: ${variant.sellPrice.toFixed(2)} each
                    {variant.quantity > 1 && (
                      <span className="block text-xs text-gray-400 mt-1">
                        Total sell value: ${(variant.sellPrice * variant.quantity).toFixed(2)}
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
              
              <button
                onClick={() => { setSelectedRootCard(null); setSelectedVariants([]); }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 rounded mt-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}