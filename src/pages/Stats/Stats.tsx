import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../../lib/api';

export default function Stats() {
  const { isSignedIn, user } = useUser();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      fetch('/api/user/stats', {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => setStats(data.stats))
        .catch(err => console.error('Failed to fetch stats:', err));
    }
  }, [isSignedIn, user]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1>Tracker of all the things you did <span>and didn't</span> do!</h1>
        {stats && (
          <div>
            <p>Total pulls: {stats.total_pulls}</p>
            <p>Total pulls: {stats.total_pulls}</p>
            <p>Unique cards: {stats.unique_cards}</p>
            <p>Wins: {stats.wins}</p>
            <p>Losses: {stats.losses}</p>
            <p>Trades completed: {stats.trades_completed}</p>
            <p>Purchases made: {stats.purchases_made}</p>
            <p>Total currency spent: ${stats.total_currency_spent}</p>
            <p>Total currency gained: ${stats.total_currency_gained}</p>
            <p>Net profit: ${stats.total_currency_gained - stats.total_currency_spent}</p>
            <p>Login streak: {stats.login_streak} days</p>
            <p>Total logins: {stats.login_count}</p>
            <p>Total play minutes: {stats.total_play_minutes}</p>
            <p>Total cards sold: {stats.total_cards_sold}</p>
            <p>Consecutive wins: {stats.consecutive_wins}</p>
            <p>Highest win streak: {stats.highest_win_streak}</p>
            <p>Consecutive losses: {stats.consecutive_losses}</p>
            <p>Highest lose streak: {stats.highest_lose_streak}</p>
            <p>Battle rating: {Math.floor(stats.battle_rating)}</p>
          </div>
        )}
      </main>
    </>
  );
}