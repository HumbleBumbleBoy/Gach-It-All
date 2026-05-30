import Navbar from '../../components/Navbar';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/react';
import { apiClient } from '../../../lib/api';
import PackOpeningModal from '../../components/PackOpeningModal';

interface Pack {
  id: number;
  name: string;
  image_url: string;
}

let lastCacheRefresh = 0;

export default function Gacha() {
  const { isSignedIn } = useUser();
  const [isOpening, setIsOpening] = useState(false);
  const [openedCards, setOpenedCards] = useState<any[]>([]);
  const [freePack, setFreePack] = useState<Pack | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [existingCardIds, setExistingCardIds] = useState<Set<number>>(new Set());

  const DrumRoll = useRef<HTMLAudioElement | null>(null);
  const PackOpened = useRef<HTMLAudioElement | null>(null);
  const openTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOpeningRef = useRef(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('soundMuted') === 'true');

  const CACHE_REFRESH_COOLDOWN = 300000;
  useEffect(() => {
    if (isSignedIn) {
      const now = Date.now();
      if (now - lastCacheRefresh > CACHE_REFRESH_COOLDOWN) {
        lastCacheRefresh = now;
        apiClient.refreshCardCache().catch(err => console.warn('Failed to refresh card cache:', err));
      }
      loadExistingCards();
    }
  }, [isSignedIn]);

  useEffect(() => {
    const handleMuteChange = (event: CustomEvent) => {
      setIsMuted(event.detail.isMuted);
    };
    
    window.addEventListener('soundMuteChanged', handleMuteChange as EventListener);
    return () => window.removeEventListener('soundMuteChanged', handleMuteChange as EventListener);
  }, []);

  useEffect(() => {
    fetchFreePack();
    
    const savedVolume = getSavedVolume();
    
    DrumRoll.current = new Audio('/sounds/DrumRoll.wav');
    PackOpened.current = new Audio('/sounds/PackOpened.wav');

    DrumRoll.current.volume = savedVolume;
    PackOpened.current.volume = savedVolume;
    
    DrumRoll.current.load();
    PackOpened.current.load();
    
    return () => {
      if (DrumRoll.current) {
        DrumRoll.current.pause();
        DrumRoll.current.currentTime = 0;
      }
      if (PackOpened.current) {
        PackOpened.current.pause();
        PackOpened.current.currentTime = 0;
      }
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleVolumeChange = (event: CustomEvent) => {
      const volume = event.detail.volume;
      if (DrumRoll.current) DrumRoll.current.volume = volume;
      if (PackOpened.current) PackOpened.current.volume = volume;
    };
    
    window.addEventListener('soundVolumeChanged', handleVolumeChange as EventListener);

    const savedVolume = getSavedVolume();
    if (DrumRoll.current) DrumRoll.current.volume = savedVolume;
    if (PackOpened.current) PackOpened.current.volume = savedVolume;
    
    return () => window.removeEventListener('soundVolumeChanged', handleVolumeChange as EventListener);
  }, []);

  const getSavedVolume = () => {
    const saved = localStorage.getItem('soundVolume');
    return saved !== null ? parseFloat(saved) : 0.5;
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

  const stopDrumRoll = () => {
    if (DrumRoll.current) {
      DrumRoll.current.pause();
      DrumRoll.current.currentTime = 0;
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
      return;
    }
    
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    isOpeningRef.current = true;
    setIsOpening(true);
    
    playSound(DrumRoll);
    
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
    }
    
    openTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await apiClient.openPack(freePack?.id || 1);
        if (result.success && result.cards && result.cards.length > 0) {
          const newCardIds = result.cards.map((card: any) => card.card_template_id);
          setExistingCardIds(prev => new Set([...prev, ...newCardIds]));
          
          stopDrumRoll();
          playSound(PackOpened);
          
          setOpenedCards(result.cards);
          setShowModal(true);
          
          // Dispatch event to refresh achievements
          window.dispatchEvent(new CustomEvent('achievements-updated'));
          window.dispatchEvent(new Event('currency-updated'));
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
    }, 1000);
  };

  const closeModal = () => {
    setShowModal(false);
    setOpenedCards([]);
    loadExistingCards(); // Refresh existing cards after opening
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh] pt-20">
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
        </div>
      </main>

      <PackOpeningModal
        isOpen={showModal}
        cards={openedCards}
        onClose={closeModal}
        existingCardIds={existingCardIds}
      />
    </>
  );
}