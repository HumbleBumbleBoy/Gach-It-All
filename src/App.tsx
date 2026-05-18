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
        <h1>Hi there {user?.username || "friend"}!</h1>
        
      </main>
    </>
  );
}

export default App;