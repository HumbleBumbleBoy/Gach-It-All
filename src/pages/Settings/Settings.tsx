import Navbar from '../../components/Navbar';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/react';

export default function Settings() {
  const { isSignedIn } = useUser();
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('soundVolume');
    return saved !== null ? parseFloat(saved) : 0.5;
  });
  const [isResetting, setIsResetting] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [cookiesAccepted, _setCookiesAccepted] = useState(() => {
    const saved = localStorage.getItem('cookiesAccepted');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('soundVolume', volume.toString());
    window.dispatchEvent(new CustomEvent('soundVolumeChanged', { detail: { volume } }));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('cookiesAccepted', String(cookiesAccepted));
  }, [cookiesAccepted]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const resetCollection = async () => {
    if (!confirm('WARNING \nThis will delete ALL your cards and stats related to card collection! This action cannot be undone. Are you sure?')) return;
    
    setIsResetting(true);
    try {
      const response = await fetch('/api/user/reset-collection', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        alert('Collection reset successfully!');
        window.location.href = '/collection';
      } else {
        alert('Failed to reset collection: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to reset collection:', error);
      alert('Failed to reset collection');
    } finally {
      setIsResetting(false);
    }
  };

  const clearAllUserData = async () => {
    if (!confirm('WARNING\n\nThis will delete EVERYTHING:\n- Your cards\n- Your stats\n- Your items\n- Your achievements \n- Your currency \n\nThis action CANNOT be undone. Are you absolutely sure?')) return;
    if (!confirm('okay but are you REALLY sure?')) return;

    setIsClearingAll(true);
    try {
      const response = await fetch('/api/user/clear-all-data', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        alert('All user data has been cleared! The page will now reload.');
        // Clear local storage as well
        localStorage.removeItem('collectionViewMode');
        localStorage.removeItem('soundMuted');
        window.location.href = '/';
      } else {
        alert('Failed to clear data: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert('Failed to clear data');
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <div className="space-y-6">
          <div>
            <label className="block mb-2">Volume: {Math.round(volume * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
            />
            <p className="text-gray-500 text-xs mt-1">Between you and me, this is here cause i wanted something in the settings section, who is even changing volume on a site like this</p>
          </div>
          
          {isSignedIn && (
            <div className="pt-4 border-t border-gray-700">
              <h2 className="text-xl font-bold mb-4 text-red-500">Danger Zone</h2>
              <div className="space-y-3">
                <div>
                  <button
                    onClick={resetCollection}
                    disabled={isResetting}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 mt-1 mb-1"
                  >
                    {isResetting ? 'Resetting...' : 'Reset Collection'}
                  </button>
                  <p className="text-gray-500 text-xs">This will permanently delete all cards from your collection and card related stats.</p>
                </div>
                <div>
                  <button
                    onClick={clearAllUserData}
                    disabled={isClearingAll}
                    className="bg-red-800 hover:bg-red-900 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 mt-3 mb-1"
                  >
                    {isClearingAll ? 'Clearing...' : 'Clear ALL User Data'}
                  </button>
                  <p className="text-gray-500 text-xs mt-1">This will delete EVERYTHING.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}