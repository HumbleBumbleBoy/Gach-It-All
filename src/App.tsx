import './App.css';
import { useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import { apiClient } from '../lib/api';

function App() {
  const { isSignedIn, user } = useUser();
  const [showChances, setShowChances] = useState(false);

  useEffect(() => {
    if (isSignedIn && user) {
      apiClient.userLogin()
        .then(data => console.log('Backend response:', data))
        .catch(err => console.error('Error calling backend:', err));
    }
  }, [isSignedIn, user]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to Gatch It All!</h1>
          <p className="text-gray-400">This is still in heavy production. Limited gambling cause adding cards takes so long.</p>
        </div>

        {/* Introduction Section */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
          <p className="text-gray-300 leading-relaxed">
            Hi there! This site is a gacha-like card game where you try to fill your collection 
            while enjoying all the different features. The game is still under heavy development and there are 
            missing features, but I try my best to expand it daily. The whole idea of taking random categories and putting 
            them into item sets, or the entire site really, was inspired by{' '}
            <a 
              href="https://wikigacha.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              WikiGacha
            </a>
            . I spent a lot of time on there and it definitely influenced my decisions a lot.
          </p>
          <p className="text-gray-300 leading-relaxed pt-2">
            Anyways, why don't you go to that <a href='/gacha' className='text-indigo-400 hover:text-indigo-300 underline'>Gacha</a> section and get started on your collection!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card Quality */}
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Card Quality</h2>
            <div className="space-y-3 mt-6">
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Tarnished</span>
                </div>
                <span className="text-gray-400 text-sm">0.30x price</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Poor</span>
                </div>
                <span className="text-gray-400 text-sm">0.66x price</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Regular</span>
                </div>
                <span className="text-gray-400 text-sm">1.00x price</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Good</span>
                </div>
                <span className="text-gray-400 text-sm">1.25x price</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Crisp</span>
                </div>
                <span className="text-gray-400 text-sm">1.50x price</span>
              </div>
            </div>
          </div>

          {/* Enhancements & Effects */}
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white text-center">Enhancements & Effects</h2>
            <div className="space-y-3 mt-6">
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Basic</span>
                </div>
                <span className="text-gray-400 text-sm">1.00x price</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Foiled</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-sm block">1.25x price</span>
                  <span className="text-gray-400 text-xs">+50% DEF</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Shiny</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-sm block">1.50x price</span>
                  <span className="text-gray-400 text-xs">+50% HP</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-medium">Signed</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 text-sm block">2.00x price</span>
                  <span className="text-gray-400 text-xs">+50% ATK</span>
                </div>
              </div>
            </div>
            <p className="text-gray-500 text-xs text-center pt-5">Enhancements prices stack with quality modifiers</p>
          </div>
        </div>

        {/* Series & Types Info */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-3">Series & Types</h2>
          <p className="text-gray-300 leading-relaxed">
            All cards have a <span className="text-indigo-400">set (Series)</span> and a{' '}
            <span className="text-indigo-400">type</span> that they are a part of. This helps you sort things out in your 
            collection as well as purchasing packs that include only that set or type of cards. I might add type counters later, but don't quote me on that!
          </p>
        </div>

        {/* Shop & Market Info */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-3">Shop & The Market</h2>
          <p className="text-gray-300 leading-relaxed">
            When checking the nav bar you might notice that there are 2 stores. This is a way to give you both fixed prices and regular items in <a href='/shop' className='text-indigo-400 hover:text-indigo-300 underline'>the shop</a>, as well as allow trade between players with any item or currency they want to use in <a href='/market' className='text-indigo-400 hover:text-indigo-300 underline'>the market</a>. <span className='text-gray-500 text-xs'>Market currently under development.</span>
          </p>
        </div>

        {/* Battles Info */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-3">Battles</h2>
          <p className="text-gray-300 leading-relaxed">
            Here you will be able to fight random ai opponents, weekly champions and user made loadouts. If you win your battles, you will actually be rewarded with currency or card packs! <span className='text-gray-500 text-xs'>Currently under development.</span>
          </p>
        </div>

        {/* Chances Button & Modal */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowChances(!showChances)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {showChances ? 'Hide Chances' : 'View Drop Chances'}
          </button>
        </div>

        {showChances && (
          <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 text-center">Free Pack Drop Rates</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
              {/* Rarity Chances */}
              <div>
                <h3 className="font-semibold text-indigo-400 mb-3">Card Rarity</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">COMMON</span>
                    <span className="text-gray-400">62.24%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">UNCOMMON</span>
                    <span className="text-gray-400">21.52%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">SPARSE</span>
                    <span className="text-gray-400">10.23%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">RARE</span>
                    <span className="text-gray-400">4.14%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">UBER_RARE</span>
                    <span className="text-gray-400">1.31%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">MYTHICAL</span>
                    <span className="text-gray-400">0.44%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">LEGENDARY</span>
                    <span className="text-gray-400">0.12%</span>
                  </div>
                </div>
              </div>

              {/* Quality & Enhancement Chances */}
              <div>
                <h3 className="font-semibold text-indigo-400 mb-3">Quality & Enhancement</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-gray-300 text-sm mb-2">Quality</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Tarnished/Poor/Regular/Good/Crisp</span>
                        <span className="text-gray-500">20% / 30% / 30% / 15% / 5%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 text-sm mb-2">Enhancement</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">Basic/Foiled/Shiny/Signed</span>
                        <span className="text-gray-500">85% / 10% / 4% / 1%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <h3 className="font-semibold text-indigo-400 mb-2">Card Stats Generation</h3>
              <p className="text-gray-400 text-sm">
                Card stats (HP, ATK, DEF) and price are determined by the card's rarity. 
                Higher rarity = higher potential stats. Stats are weighted toward the median, 
                with price influencing stat distribution (higher price = better stats).
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default App;