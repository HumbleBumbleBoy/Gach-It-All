import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

export default function Collection() {
  const { isSignedIn, user } = useUser();
  const [cards, setItems] = useState([]);

  useEffect(() => {
  if (isSignedIn && user) {
      apiClient.getCollection()
        .then(data => setItems(data.cards))  // do something productive with it later
        .catch(err => console.error('Failed to fetch collection:', err));
    }
  }, [isSignedIn]);

  const getCollectionText = (count: number) => {
    return count === 1 ? 'card!' : cards.length > 0 ? 'cards!' : 'cards... ouch';
  };

  return (
    <>
        <Navbar />
        <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
            <h1>Your vast card collection!</h1>
            <div>We found a total of {cards.length} {getCollectionText(cards.length)}</div>
            <div>Nothing here yet... sorry :/</div>
        </main>
    </>
  ) 
}