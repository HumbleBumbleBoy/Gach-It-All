import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

export default function Inventory() {
  const { isSignedIn, user } = useUser();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.getInventory()
        .then(data => setItems(data.items))
        .catch(err => console.error('Failed to fetch inventory:', err));
    }
  }, [isSignedIn]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Inventory</h1>
        <div className="text-gray-400 mb-4">Total items: {items.length}</div>
        
        {items.length === 0 && <div className="text-gray-500">Nothing here yet...</div>}
        
        {items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            {items.map((item: any) => (
              <div key={item.id} className="bg-gray-800 rounded-lg p-3">
                <img src={item.image_url} alt={item.name} className="h-32 w-32 rounded mb-2 mx-auto object-contain" />
                <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                <p className="text-gray-400 text-xs ">{item.description}</p>
                <div className='flex justify-between gap-1 mt-1 text-xs'>
                  {item.quantity > 1 && <p className="text-gray-500">x{item.quantity}</p>}
                </div>
                {item.name === "Welcome badge" && (
                  <p className="text-yellow-400 text-xs mt-1">Joined: {new Date(item.acquired_at).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}