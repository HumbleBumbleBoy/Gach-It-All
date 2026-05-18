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
    return count === 1 ? 'item' : 'items';
  };

  return (
    <>
        <Navbar />
        <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
            <h1>Welcome to the Inventory section!</h1>
            <div>We found a total of {items.length} {getItemText(items.length)}!</div>
            
        </main>
    </>
  ) 
}