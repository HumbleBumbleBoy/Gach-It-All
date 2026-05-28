import { useState, useEffect, useRef } from 'react';

interface Card {
  id: number;
  card_template_id?: number;
  name: string;
  rarity: string;
  image_url?: string;
  description?: string;
  quality?: string;
  enhancement: string;
  cardTemplate?: {
    id: number;
    name: string;
    image_url: string;
    rarity: string;
    description?: string;
    base_price?: number;
    base_hp?: number;
    base_atk?: number;
    base_def?: number;
    series?: string;
    type?: string;
  };
}

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

function calculateCardPrice(basePrice: number, quality: string, enhancement: string): number {
  const qualityMultiplier = QUALITY_MULTIPLIERS[quality as keyof typeof QUALITY_MULTIPLIERS] || 1;
  const enhancementMultiplier = ENHANCEMENT_MULTIPLIERS[enhancement as keyof typeof ENHANCEMENT_MULTIPLIERS] || 1;
  const price = basePrice * qualityMultiplier * enhancementMultiplier;
  return Math.round(price * 100) / 100;
}

interface PackOpeningModalProps {
  isOpen: boolean;
  cards: Card[];
  onClose: () => void;
  existingCardIds?: Set<number>;
}

export default function PackOpeningModal({ isOpen, cards, onClose, existingCardIds = new Set() }: PackOpeningModalProps) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [flippedCards, setFlippedCards] = useState<boolean[]>([]);
  const [tooltipCard, setTooltipCard] = useState<{ card: Card; index: number } | null>(null);
  const [allFlipped, setAllFlipped] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const CardFlipped = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('soundMuted') === 'true');

  useEffect(() => {
    if (cards.length > 0) {
      setFlippedCards(new Array(cards.length).fill(false));
      setAllFlipped(false);
      
      // Load sound
      CardFlipped.current = new Audio('/sounds/CardFlipped.mp3');
      const savedVolume = parseFloat(localStorage.getItem('soundVolume') || '0.5');
      if (CardFlipped.current) CardFlipped.current.volume = savedVolume;
      
      return () => {
        if (CardFlipped.current) {
          CardFlipped.current.pause();
          CardFlipped.current.currentTime = 0;
        }
      };
    }
  }, [cards]);

  useEffect(() => {
    const handleMuteChange = (event: CustomEvent) => {
      setIsMuted(event.detail.isMuted);
    };
    
    window.addEventListener('soundMuteChanged', handleMuteChange as EventListener);
    return () => window.removeEventListener('soundMuteChanged', handleMuteChange as EventListener);
  }, []);

  useEffect(() => {
    if (flippedCards.length > 0 && flippedCards.every(flipped => flipped === true)) {
      setAllFlipped(true);
    }
  }, [flippedCards]);

  useEffect(() => {
    if (hoveredCard !== null && cardRefs.current[hoveredCard]) {
      const cardRect = cardRefs.current[hoveredCard]?.getBoundingClientRect();
      if (cardRect) {
        if (cardRect.top < 200) {
          setTooltipPosition('bottom');
        } else {
          setTooltipPosition('top');
        }
      }
    }
  }, [hoveredCard]);

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

  const flipCard = (index: number) => {
    setFlippedCards(prev => {
      const newFlipped = [...prev];
      newFlipped[index] = true;
      return newFlipped;
    });
  };

  if (!isOpen || cards.length === 0) return null;

  return (
    <div className={`fixed inset-0 bg-black/90 flex ${cards.length < 7 ? 'items-center' : 'items-start'} justify-center z-50 animate-in fade-in duration-500 overflow-y-auto`}>
      <div className="relative max-w-6xl w-full mx-4 mt-8 sm:mt-0">
        <div className={`flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 mt-8 ${
          cards.length > 20 ? 'gap-1 sm:gap-2' : ''
        }`}>
          {cards.map((card, index) => {
            const rarity = card.rarity || card.cardTemplate?.rarity || 'COMMON';
            const style = getRarityStyle(rarity);
            const cardName = card.name || card.cardTemplate?.name;
            const isFlipped = flippedCards[index];
            
            return (
              <div
                key={index}
                ref={el => { cardRefs.current[index] = el; }}
                onMouseEnter={() => {
                  if (!isFlipped) {
                    flipCard(index);
                    playSound(CardFlipped);
                  }
                  setHoveredCard(index);
                  setTooltipCard({ card, index });
                }}
                onMouseLeave={() => {
                  setHoveredCard(null);
                  setTooltipCard(null);
                }}
                className="relative transition-all cursor-pointer animate-in zoom-in duration-300 perspective-1000 overflow-visible"
                style={{
                  transform: hoveredCard === index && isFlipped ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.1s ease-in-out',
                  animationDelay: `${index * 50}ms`,
                  zIndex: hoveredCard === index ? 100 : 1
                }}
              >
                <div className={`relative ${
                  cards.length <= 5 ? 'w-32 h-48 lg:w-40 lg:h-56' :
                  cards.length <= 10 ? 'w-28 h-44 lg:w-36 lg:h-52' :
                  cards.length <= 20 ? 'w-24 h-40 lg:w-32 lg:h-48' :
                  'w-20 h-36 sm:w-24 sm:h-40'
                }`}>
                  <div 
                    className={`relative w-full h-full transition-all duration-500 preserve-3d ${
                      isFlipped ? 'rotate-y-180' : ''
                    }`}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Card Back */}
                    <div 
                      className={`absolute inset-0 backface-hidden bg-gray-800 rounded-lg p-2 sm:p-3 border-2 border-gray-600 w-full h-full ${
                        !isFlipped ? 'block' : 'hidden'
                      }`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-gray-500 text-6xl sm:text-8xl font-bold transform rotate-30">?</div>
                      </div>
                    </div>
                    
                    {/* Card Front */}
                    <div 
                      className={`backface-hidden bg-gray-800 rounded-lg p-2 sm:p-3 w-full h-full border-2 ${style.borderColor} ${style.aura || ''} overflow-hidden ${
                        isFlipped ? 'block' : 'hidden'
                      }`}
                      style={{ transform: 'rotateY(180deg)' }}
                    >
                      {isFlipped && !existingCardIds.has(card.cardTemplate?.id ?? 0) && (
                        <div className="fixed -top-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-1 z-20" style={{ animation: 'bounce 1.5s 1.5' }}>
                          NEW!
                        </div>
                      )}
                      {card.image_url || card.cardTemplate?.image_url ? (
                        <img 
                          src={card.image_url || card.cardTemplate?.image_url} 
                          alt={cardName}
                          className={`w-full object-contain rounded-lg mb-1 sm:mb-2 ${
                            cards.length <= 5 ? 'h-24 sm:h-28 lg:h-32' :
                            cards.length <= 10 ? 'h-20 sm:h-24 lg:h-28' :
                            cards.length <= 20 ? 'h-16 sm:h-20 lg:h-24' :
                            'h-12 sm:h-16'
                          }`}
                        />
                      ) : (
                        <div className="w-full h-24 sm:h-32 bg-gray-700 rounded-lg mb-1 sm:mb-2 flex items-center justify-center">
                          <span className="text-3xl sm:text-4xl">🎴</span>
                        </div>
                      )}
                      <p className={`font-semibold truncate text-center ${style.textColor} ${
                        cards.length <= 5 ? 'text-sm sm:text-base' :
                        cards.length <= 10 ? 'text-xs sm:text-sm' :
                        cards.length <= 20 ? 'text-[11px] sm:text-xs' :
                        'text-[10px] sm:text-xs'
                      }`}>
                        {cardName}
                      </p>
                      <p className={`text-center mt-1 ${style.textColor} ${
                        cards.length <= 5 ? 'text-xs sm:text-sm' :
                        cards.length <= 10 ? 'text-[10px] sm:text-xs' :
                        cards.length <= 20 ? 'text-[9px] sm:text-[11px]' :
                        'text-[8px] sm:text-[10px]'
                      }`}>
                        {rarity}
                      </p>
                      {card.quality && (
                        <div className="text-center mt-1">              
                          <p className={`text-gray-500 truncate ${
                            cards.length > 20 ? 'text-[6px] sm:text-[8px]' : 'text-[8px] sm:text-xs'
                          }`}>
                            {card.quality} • {card.enhancement}
                          </p>                                  
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {hoveredCard === index && isFlipped && (
                  <div 
                    className={`absolute ${
                      tooltipPosition === 'top' 
                        ? 'bottom-full mb-2' 
                        : 'top-full mt-2'
                    } left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 sm:px-3 sm:py-2 rounded-lg shadow-xl border border-gray-700 min-w-37.5 sm:min-w-37.5 sm:max-w-37.5 lg:max-w-50 hidden sm:block`}
                    style={{ zIndex: 9999 }}
                  >
                    <p className={`font-semibold mb-1 text-xs sm:text-sm truncate flex items-center justify-between ${style.textColor}`}>
                      <span>{cardName}</span>
                      <span className="text-[10px] text-green-500 font-semibold">
                        ${calculateCardPrice(card.cardTemplate?.base_price || 0, card.quality || 'REGULAR', card.enhancement || 'BASIC').toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-300 leading-relaxed text-[9px] lg:text-[10px] line-clamp-6 lg:line-clamp-10">
                      {card.cardTemplate?.description || 'No description'}
                    </p>
                    <p className={`text-[10px] mt-1 pt-1 truncate ${style.textColor}`}>
                      {card.cardTemplate?.base_hp || 'NULL HP'}HP | {card.cardTemplate?.base_def || 'NULL DEF'}DEF | {card.cardTemplate?.base_atk || 'NULL ATK'}ATK
                    </p>
                    <p className={`text-[10px] mt-1 truncate ${style.textColor}`}>
                      {card.cardTemplate?.series || 'Unknown'} | {card.cardTemplate?.type || 'Unknown'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {allFlipped && (
          <button
            onClick={onClose}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white px-7 py-2 rounded-lg transition-colors z-30"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}