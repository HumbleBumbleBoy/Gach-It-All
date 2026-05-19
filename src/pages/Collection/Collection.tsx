import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

export default function Collection() {
  const { isSignedIn, user } = useUser();
  const [cards, setCards] = useState([]);

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.getCollection()
        .then(data => {
          console.log('Collection data:', data);
          setCards(data.items);
        })
        .catch(err => console.error('Failed to fetch collection:', err));
    }
  }, [isSignedIn, user]);

  const getCollectionText = (count: number) => {
    if (count === 0) return 'cards... ouch';
    if (count === 1) return 'card!';
    return 'cards!';
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1>Your vast card collection!</h1>
        <div>We found a total of {cards?.length || 0} {getCollectionText(cards?.length || 0)}</div>
        {cards.length === 0 && <div>Nothing here yet... sorry :/</div>}
        {cards.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
            {cards.map((card: any) => (
              <div key={card.id} className="bg-gray-800 rounded-lg p-4">
                <p className="text-white text-center">Card ID: {card.card_template_id}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}