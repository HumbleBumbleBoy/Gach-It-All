import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';
import PackOpeningModal from '../../components/PackOpeningModal';

interface InventoryItem {
  id: number;
  name: string;
  description: string;
  image_url: string;
  quantity: number;
  item_type: string;
  reference_id: number;
  acquired_at: string;
  can_sell?: boolean;
  sell_price?: number;
}

export default function Inventory() {
  const { isSignedIn, user } = useUser();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [openingPack, setOpeningPack] = useState<InventoryItem | null>(null);
  const [openedCards, setOpenedCards] = useState<any[]>([]);
  const [showPackModal, setShowPackModal] = useState(false);
  const [existingCardIds, setExistingCardIds] = useState<Set<number>>(new Set());
  const [selling, setSelling] = useState<number | null>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      refreshInventory();
      loadExistingCards();
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      loadExistingCards();
    }
  }, [isSignedIn]);

  const loadExistingCards = async () => {
    try {
      const collection = await apiClient.getCollection();
      const existingIds = new Set<number>(collection.items.map((c: any) => c.card_template_id));
      setExistingCardIds(existingIds);
    } catch (error) {
      console.error('Failed to load existing cards:', error);
    }
  };

  const refreshInventory = async () => {
    try {
      const data = await apiClient.getInventory();
      setItems(data.items);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const openPack = async (pack: InventoryItem) => {
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    setOpeningPack(pack);
    
    try {
      const result = await apiClient.openPack(pack.reference_id);
      if (result.success && result.cards && result.cards.length > 0) {
        setOpenedCards(result.cards);
        setShowPackModal(true);
        
        await refreshInventory();
        
        window.dispatchEvent(new CustomEvent('achievements-updated'));
        window.dispatchEvent(new Event('currency-updated'));
      } else {
        alert('Failed to open pack');
      }
    } catch (error) {
      console.error('Failed to open pack:', error);
      alert('Failed to open pack');
    } finally {
      setOpeningPack(null);
    }
  };

  const sellItem = async (item: InventoryItem) => {
    if (!isSignedIn) {
      alert('Please sign in first!');
      return;
    }
    
    const sellPrice = item.sell_price || 0;
    if (!confirm(`Sell ${item.quantity > 1 ? `${item.quantity}x ` : ''}${item.name} for $${sellPrice.toFixed(2)}?`)) {
      return;
    }
    
    setSelling(item.id);
    
    try {
      const result = await apiClient.sellInventoryItem(item.id);
      
      if (result.success) {
        alert(`Sold ${item.name} for $${result.sellPrice.toFixed(2)}!`);
        await refreshInventory();
        window.dispatchEvent(new Event('currency-updated'));
        window.dispatchEvent(new CustomEvent('achievements-updated'));
      } else {
        alert(result.error || 'Failed to sell item');
      }
    } catch (error) {
      console.error('Failed to sell item:', error);
      alert('Failed to sell item');
    } finally {
      setSelling(null);
    }
  };

  const closeModal = () => {
    setShowPackModal(false);
    setOpenedCards([]);
    loadExistingCards();
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Inventory</h1>
        <div className="text-gray-400 mb-4">Total items: {items.length}</div>
        
        {items.length === 0 && <div className="text-gray-500">Nothing here yet...</div>}
        
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            {items.map((item: InventoryItem) => (
              <div key={item.id} className="bg-gray-800 rounded-lg p-3">
                <img src={item.image_url} alt={item.name} className="h-32 w-32 rounded mb-2 mx-auto object-contain" />
                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                <p className="text-gray-400 text-xs">{item.description}</p>
                <div className='flex justify-between items-center gap-1 mt-1 text-xs'>
                  {item.quantity > 1 && (
                    <p className="text-gray-500">{item.quantity}x</p>
                  )}
                </div>
                {item.item_type === 'PACK' && (
                  <button
                    onClick={() => openPack(item)}
                    disabled={!!openingPack}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {openingPack?.id === item.id ? 'Opening...' : 'Open Pack'}
                  </button>
                )}
                {item.can_sell && (
                  <button
                    onClick={() => sellItem(item)}
                    disabled={selling === item.id}
                    className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white text-xs py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {selling === item.id ? 'Selling...' : 'Sell'}
                  </button>
                )}
                {item.name === "Welcome badge" && (
                  <p className="text-yellow-400 text-xs mt-1">Joined: {new Date(item.acquired_at).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      
      <PackOpeningModal
        isOpen={showPackModal}
        cards={openedCards}
        onClose={closeModal}
        existingCardIds={existingCardIds}
      />
    </>
  );
}