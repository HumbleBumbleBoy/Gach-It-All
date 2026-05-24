import Navbar from '../../components/Navbar';
import { useState, useEffect, useRef } from 'react';
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
  const [flippedCards, setFlippedCards] = useState<boolean[]>([]);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('soundMuted') === 'true');

  const DrumRoll = useRef<HTMLAudioElement | null>(null);
  const PackOpened = useRef<HTMLAudioElement | null>(null);
  const CardFlipped = useRef<HTMLAudioElement | null>(null);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOpeningRef = useRef(false);

  useEffect(() => {
    const handleMuteChange = (event: CustomEvent) => {
      setIsMuted(event.detail.isMuted);
    };
    
    window.addEventListener('soundMuteChanged', handleMuteChange as EventListener);
    return () => window.removeEventListener('soundMuteChanged', handleMuteChange as EventListener);
  }, []);

  useEffect(() => {
    fetchFreePack();
    
    // Preload audio files
    DrumRoll.current = new Audio('/sounds/DrumRoll.wav');
    PackOpened.current = new Audio('/sounds/PackOpened.wav');
    CardFlipped.current = new Audio('/sounds/CardFlipped.mp3');
    
    // Preload to reduce delay
    DrumRoll.current.load();
    PackOpened.current.load();
    CardFlipped.current.load();
    
    return () => {
      // Cleanup
      if (DrumRoll.current) {
        DrumRoll.current.pause();
        DrumRoll.current.currentTime = 0;
      }
      if (PackOpened.current) {
        PackOpened.current.pause();
        PackOpened.current.currentTime = 0;
      }
      if (CardFlipped.current) {
        CardFlipped.current.pause();
        CardFlipped.current.currentTime = 0;
      }
      // Clear timeout if component unmounts
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
      }
    };
  }, []);

  const stopDrumRoll = () => {
    if (DrumRoll.current) {
      DrumRoll.current.pause();
      DrumRoll.current.currentTime = 0;
    }
  };

  const playSound = async (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (isMuted) return;
    if (!audioRef.current) return;
    
    try {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
    } catch (error) {
      console.log('Audio play failed:', error);
    }
  };

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
    if (isOpeningRef.current || isOpening) {
      console.log('Pack already opening, ignoring click');
      return;
    }
    
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    // Set opening flags
    isOpeningRef.current = true;
    setIsOpening(true);
    setOpenedCards([]);
    setShowCards(false);
    setHoveredCard(null);
    
    // Play drum roll sound
    playSound(DrumRoll);
    
    // Clear any existing timeout
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
    }
    
    // Start API call
    const openPromise = apiClient.openPack(freePack?.id || 1);
    
    // Set fixed 2 second animation
    openTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await openPromise;
        if (result.success && result.cards && result.cards.length > 0) {
          // Stop drum roll and play pack opened sound
          stopDrumRoll();
          playSound(PackOpened);
          
          setOpenedCards(result.cards);
          setFlippedCards(new Array(result.cards.length).fill(false));
          setShowCards(true);
        } else {
          alert('Failed to open pack');
          stopDrumRoll();
        }
      } catch (error) {
        console.error('Failed to open pack:', error);
        alert('Failed to open pack');
        stopDrumRoll();
      } finally {
        setIsOpening(false);
        isOpeningRef.current = false;
        openTimeoutRef.current = null;
      }
    }, 2000);
  };

  const closeModal = () => {
    setOpenedCards([]);
    setShowCards(false);
    setHoveredCard(null);
  };

  const flipCard = (index: number) => {
    setFlippedCards(prev => {
      const newFlipped = [...prev];
      newFlipped[index] = true;
      return newFlipped;
    });
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
                className={`w-lg h-128 object-contain cursor-pointer hover:scale-105 transition-transform ${isOpening ? 'cursor-wait animate-pulse' : ''}`}
              />
              {isOpening && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-20 bg-gray-700 p-6 rounded-2xl">
                  <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-300 mt-2">Opening pack...</p>
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
                    const isFlipped = flippedCards[index];
                    
                    return (
                      <div
                        key={index}
                        onMouseEnter={() => {
                          if (!isFlipped) {
                            flipCard(index);
                            playSound(CardFlipped);
                          }
                          setHoveredCard(index);
                        }}
                        onMouseLeave={() => setHoveredCard(null)}
                        className="relative transition-all cursor-pointer animate-in zoom-in duration-300 perspective-1000"
                        style={{
                          transform: hoveredCard === index && isFlipped ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.1s ease-in-out',
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        <div className="relative w-40 h-50">
                          <div 
                            className={`relative w-full h-full transition-all duration-500 preserve-3d ${
                              isFlipped ? 'rotate-y-180' : ''
                            }`}
                            style={{ transformStyle: 'preserve-3d' }}
                          >
                          {/* Card Back (face down) */}
                          <div 
                            className={`absolute inset-0 backface-hidden bg-gray-800 rounded-lg p-3 border-2 border-gray-600 h-54.5 self-center ${
                              !isFlipped ? 'block' : 'hidden'
                            }`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-gray-500 text-8xl font-bold transform rotate-30">?</div>
                            </div>
                          </div>
                          
                          {/* Card Front (face up) */}
                          <div 
                            className={`backface-hidden bg-gray-800 rounded-lg p-3 w-40 border-2 ${style.borderColor} ${style.aura || ''} ${
                              isFlipped ? 'block' : 'hidden'
                            }`}
                            style={{ transform: 'rotateY(180deg)' }}
                          >
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
                            <p className={`text-xs text-center mt-1 ${style.textColor}`}>
                              {rarity}
                            </p>
                            {card.quality && (
                              <p className="text-xs text-gray-500 text-center mt-1">
                                {card.quality} • {card.enhancement}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                        
                      {hoveredCard === index && isFlipped && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-xl z-30 border border-gray-700 min-w-37.5">
                          <p className={`font-semibold mb-1 ${style.textColor}`}>{cardName}</p>
                          <p className="text-gray-300 text-[10px]">{card.cardTemplate?.description || 'No description'}</p>
                          <p className={`text-[10px] mt-1 pt-1 ${style.textColor}`}>
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