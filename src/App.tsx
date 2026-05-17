import './App.css';
import { useUser } from '@clerk/react';
import { useEffect } from 'react';
import Navbar from './components/Navbar';

function App() {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      fetch('/api/user-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      .then(res => res.json())
      .then(data => console.log('Backend response:', data))
      .catch(err => console.error('Error calling backend:', err));
    }
  }, [isSignedIn, user]);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white">Hi there {user?.username || "friend"}!</h1>
        
      </main>
    </>
  );
}

export default App;