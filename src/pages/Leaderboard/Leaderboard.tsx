import { useEffect, useRef, useState } from 'react';
import Navbar from '../../components/Navbar';
import { apiClient } from '../../../lib/api';

type Category =
  | 'packs_opened'
  | 'currency'
  | 'cards_collected'
  | 'wins'
  | 'battle_rating'
  | 'play_time'
  | 'trades_completed';

const CATEGORIES: { key: Category; label: string; format: (v: number) => string }[] = [
  { key: 'packs_opened',     label: 'Packs Opened',     format: v => `${v}` },
  { key: 'currency',         label: 'Currency',         format: v => `$${v.toFixed(2)}` },
  { key: 'cards_collected',  label: 'Unique Cards',     format: v => `${v}` },
  { key: 'wins',             label: 'Wins',             format: v => `${v}` },
  { key: 'battle_rating',    label: 'Battle Rating',    format: v => `${Math.floor(v)}` },
  { key: 'play_time',        label: 'Play Time',        format: v => `${v} min` },
  { key: 'trades_completed', label: 'Trades',           format: v => `${v}` },
];

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface Entry {
  userId: number;
  name: string;
  value: number;
}

export default function Leaderboard() {
  const [category, setCategory] = useState<Category>('packs_opened');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeCategory = CATEGORIES.find(c => c.key === category)!;

  const fetchLeaderboard = async (cat: Category) => {
    try {
      setLoading(true);
      const data = await apiClient.getLeaderboard(cat);
      setEntries(data.entries || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on category change
  useEffect(() => {
    fetchLeaderboard(category);
  }, [category]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchLeaderboard(category);
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [category]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Leaderboard</h1>

        {/* Category selector */}
        <div className="flex flex-wrap gap-1 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                category === cat.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_140px] px-4 py-3 border-b border-gray-700 text-xs uppercase tracking-wide text-gray-400 font-semibold">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">{activeCategory.label}</div>
          </div>

          {/* Body */}
          {loading && entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No data yet.</div>
          ) : (
            entries.map((entry, idx) => {
              const rank = idx + 1;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-[60px_1fr_140px] px-4 py-3 border-b border-gray-700/50 last:border-b-0 items-center text-sm ${
                    isTop3 ? 'bg-gray-800/80' : ''
                  }`}
                >
                  <div className={`font-semibold ${isTop3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    #{rank}
                  </div>
                  <div className="text-white truncate">{entry.name}</div>
                  <div className="text-right text-gray-200 font-medium">
                    {activeCategory.format(entry.value)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {lastUpdated && (
          <div className="text-center text-gray-500 text-xs mt-4">
            Last updated: {lastUpdated.toLocaleTimeString()} · refreshes every 5 minutes
          </div>
        )}
      </main>
    </>
  );
}