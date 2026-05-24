import Navbar from '../../components/Navbar';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';
import { apiClient } from '../../../lib/api';

interface Card {
  id: number;
  name: string;
  rarity: string;
  image_url?: string;
  description?: string;
  quality?: string;
  enhancement?: string;
  cardTemplate?: {
    name: string;
    image_url: string;
    rarity: string;
    description?: string;
    base_hp?: number;
    base_atk?: number;
    base_def?: number;
    series?: string;
    type?: string;
  };
}

interface Pack {
  id: number;
  name: string;
  image_url: string;
}

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

function getRarityStyle(rarity: string) {
  return rarityConfig[rarity] || rarityConfig.COMMON;
}

export default function Gacha() {
  const { isSignedIn } = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [freePack, setFreePack] = useState<Pack | null>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [showCards, setShowCards] = useState(false);

  useEffect(() => {
    fetchFreePack();
  }, []);

  const fetchFreePack = async () => {
    try {
      const data = await apiClient.getPacks();
      const pack = data.packs?.find((p: any) => p.price === 0);
      if (pack) setFreePack(pack);
    } catch (error) {
      console.error('Failed to fetch free pack:', error);
    }
  };

  const openFreePack = async () => {
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    setIsOpening(true);
    setOpenedCards([]);
    setShowCards(false);
    setHoveredCard(null);
    
    try {
      const result = await apiClient.openPack(freePack?.id || 1);
      if (result.success && result.cards && result.cards.length > 0) {
        setTimeout(() => {
          setOpenedCards(result.cards);
          setShowCards(true);
          setIsOpening(false);
        }, 2000);
      } else {
        alert('Failed to open pack');
        setIsOpening(false);
      }
    } catch (error) {
      console.error('Failed to open pack:', error);
      alert('Failed to open pack');
      setIsOpening(false);
    }
  };

  const closeModal = () => {
    setOpenedCards([]);
    setShowCards(false);
    setHoveredCard(null);
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] pt-20">
          {openedCards.length === 0 && !showCards ? (
            <div className="flex flex-col items-center justify-center relative">
              <img
                src={freePack?.image_url || '/default-pack.png'}
                alt="Free Pack"
                onClick={openFreePack}
                className={`w-lg h-128 object-contain cursor-pointer hover:scale-105 transition-transform ${isOpening ? 'opacity-50 cursor-wait animate-pulse' : ''}`}
              />
              {isOpening && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20 bg-gray-700 p-6 rounded-2xl">
                  <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-300 mt-2">Animation coming soon...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 animate-in fade-in duration-500">
              <div className="relative max-w-6xl w-full mx-4">
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  {openedCards.map((card, index) => {
                    const rarity = card.rarity || card.cardTemplate?.rarity || 'COMMON';
                    const style = getRarityStyle(rarity);
                    const cardName = card.name || card.cardTemplate?.name;
                    
                    return (
                      <div
                        key={index}
                        onMouseEnter={() => setHoveredCard(index)}
                        onMouseLeave={() => setHoveredCard(null)}
                        className="relative transition-all cursor-pointer animate-in zoom-in duration-300"
                        style={{
                          transform: hoveredCard === index ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.2s ease-in-out',
                          animationDelay: `${index * 100}ms`
                        }}
                      >
                        <div className={`bg-gray-800 rounded-lg p-3 w-40 border-2 ${style.borderColor} ${style.aura || ''}`}>
                          {card.image_url || card.cardTemplate?.image_url ? (
                            <img 
                              src={card.image_url || card.cardTemplate?.image_url} 
                              alt={cardName}
                              className="w-full h-32 object-contain rounded-lg mb-2"
                            />
                          ) : (
                            <div className="w-full h-32 bg-gray-700 rounded-lg mb-2 flex items-center justify-center">
                              <span className="text-4xl">🎴</span>
                            </div>
                          )}
                          <p className={`text-sm font-semibold truncate text-center ${style.textColor}`}>
                            {cardName}
                          </p>
                          <p className={`text-xs text-center mt-1 ${style.textColor} opacity-75`}>
                            {rarity}
                          </p>
                          {card.quality && (
                            <p className="text-xs text-gray-500 text-center mt-1">
                              {card.quality} • {card.enhancement}
                            </p>
                          )}
                        </div>
                        
                        {hoveredCard === index && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl z-30 border border-gray-700 min-w-37.5">
                            <p className={`font-semibold mb-1 ${style.textColor}`}>{cardName}</p>
                            <p className="text-gray-300 text-[10px]">{card.cardTemplate?.description || 'No description'}</p>
                            <p className={`text-[10px] mt-1 pt-1 ${style.textColor} opacity-75`}>
                              {card.cardTemplate?.series || 'Unknown'} | {card.cardTemplate?.type || 'Unknown'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={closeModal}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-7 py-2 rounded-lg transition-colors z-30"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}