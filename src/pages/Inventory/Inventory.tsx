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
        .then(data => setItems(data.items))  // do something productive with it later
        .catch(err => console.error('Failed to fetch inventory:', err));
    }
  }, [isSignedIn]);

  const getItemText = (count: number) => {
    return count === 1 ? 'item!' : items.length > 0 ? 'items!' : 'items... ouch';
  };

  return (
    <>
        <Navbar />
        <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
            <h1>All non-card items land here!</h1>
            <div>We found a total of {items.length} {getItemText(items.length)}</div>
            {items.length === 0 && <div>Nothing here yet... sorry :/</div>}
            {items.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
                {items.map((item: any) => (
                  <div key={item.id} className="bg-gray-800 rounded-lg p-4">
                    <img src={item.image_url} alt={item.name} className="w-full h-32 object-cover rounded" />
                    <p className="text-white">{item.name}</p>
                    <p className="text-white">{item.item_type} id: {item.reference_id}</p>
                    <p className="text-white text-sm">Quantity: {item.quantity}</p>
                  </div>
                ))}
              </div>
            )}
        </main>
    </>
  ) 
}