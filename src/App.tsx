import './App.css';
import { useUser } from '@clerk/react';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import { apiClient } from '../lib/api';

function App() {
  const { isSignedIn, user } = useUser();

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
          <p className="text-gray-400">This is still in heavy production, Limited gambling cause adding cards takes so long.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800/50 rounded-lg p-6 h-48"></div>
          <div className="bg-gray-800/50 rounded-lg p-6 h-48"></div>
          <div className="bg-gray-800/50 rounded-lg p-6 h-48"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-gray-800/50 rounded-lg p-6 h-64"></div>
          <div className="bg-gray-800/50 rounded-lg p-6 h-64"></div>
        </div>
      </main>
    </>
  );
}

export default App;