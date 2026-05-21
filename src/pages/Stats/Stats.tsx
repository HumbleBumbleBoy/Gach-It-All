import Navbar from '../../components/Navbar';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';

export default function Stats() {
  const { isSignedIn, user } = useUser();
  const [stats, setStats] = useState<any>(null);
  const [playTimeUnit, setPlayTimeUnit] = useState('minutes');

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

  const getPlayTime = () => {
    if (!stats) return 0;
    const minutes = stats.total_play_minutes;
    if (playTimeUnit === 'hours') return (minutes / 60).toFixed(1);
    if (playTimeUnit === 'days') return (minutes / 60 / 24).toFixed(1);
    return minutes;
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Your Stats</h1>
        {stats && (
          <div className="columns-1 sm:columns-2 gap-6 space-y-6">
            {/* Battle Rating Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Battle Rating</h2>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">Battle rating:</p>
                <p className="text-base font-semibold text-white">{Math.floor(stats.battle_rating)}</p>
              </div>
            </div>

            {/* Cards & Pulls Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Cards & Pulls</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total pulls:</p>
                  <p className="text-base font-semibold text-white">{stats.total_pulls}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Unique cards:</p>
                  <p className="text-base font-semibold text-white">{stats.unique_cards}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total cards sold:</p>
                  <p className="text-base font-semibold text-white">{stats.total_cards_sold}</p>
                </div>
              </div>
            </div>

            {/* Battles Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Battles</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Wins:</p>
                  <p className="text-base font-semibold text-white">{stats.wins}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Losses:</p>
                  <p className="text-base font-semibold text-white">{stats.losses}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Consecutive wins:</p>
                  <p className="text-base font-semibold text-white">{stats.consecutive_wins}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Highest win streak:</p>
                  <p className="text-base font-semibold text-white">{stats.highest_win_streak}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Consecutive losses:</p>
                  <p className="text-base font-semibold text-white">{stats.consecutive_losses}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Highest lose streak:</p>
                  <p className="text-base font-semibold text-white">{stats.highest_lose_streak}</p>
                </div>
              </div>
            </div>

            {/* Trading Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Trading</h2>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-300">Trades completed:</p>
                <p className="text-base font-semibold text-white">{stats.trades_completed}</p>
              </div>
            </div>

            {/* Shop Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Shop</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Purchases made:</p>
                  <p className="text-base font-semibold text-white">{stats.purchases_made}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total currency spent:</p>
                  <p className="text-base font-semibold text-white">${stats.total_currency_spent}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total currency gained:</p>
                  <p className="text-base font-semibold text-white">${stats.total_currency_gained}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Net profit:</p>
                  <p className="text-base font-semibold text-white">${stats.total_currency_gained - stats.total_currency_spent}</p>
                </div>
              </div>
            </div>

            {/* Login Activity Section */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Login Activity</h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Login streak:</p>
                  <p className="text-base font-semibold text-white">{stats.login_streak} days</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total logins:</p>
                  <p className="text-base font-semibold text-white">{stats.login_count}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Total play
                    <select 
                      className="bg-gray-700 text-white text-sm rounded px-2 py-1 mx-2"
                      value={playTimeUnit}
                      onChange={(e) => setPlayTimeUnit(e.target.value)}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </p>
                  
                  <p className="text-base font-semibold text-white">{getPlayTime()}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}