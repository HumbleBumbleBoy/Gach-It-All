import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

export default function Collection() {
  const { isSignedIn, user } = useUser();
  const [userCards, setUserCards] = useState([]);

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.getCollection()
        .then(data => {
          console.log('Collection data:', data);
          setUserCards(data.items);
        })
        .catch(err => console.error('Failed to fetch collection:', err));
    }
  }, [isSignedIn, user]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1>Your vast card collection! ({userCards.length} cards)</h1>
        {userCards.length === 0 && <div>Nothing here yet... sorry :/</div>}
        {userCards.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
            {userCards.map((card: any) => (
              <div key={card.id} style={{ border: '1px solid #ccc', padding: '8px', width: '200px', fontSize: '12px' }}>
                {card.cardTemplate?.image_url && (
                  <img 
                    src={card.cardTemplate.image_url} 
                    alt={card.cardTemplate?.name || 'Card'}
                    style={{ width: '100%', height: '120px', objectFit: 'contain', marginBottom: '8px' }}
                  />
                )}
                <div><strong>{card.cardTemplate?.name || `Card #${card.card_template_id}`}</strong></div>
                <div>Quality: {card.quality} | {card.enhancement}</div>
                <div>HP: {card.cardTemplate?.base_hp} | ATK: {card.cardTemplate?.base_atk} | DEF: {card.cardTemplate?.base_def}</div>
                <div>K/D: {card.kills}/{card.deaths}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>{card.cardTemplate?.rarity} | {card.acquired_at?.split('T')[0]}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}