import './App.css';
import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import { useEffect } from 'react';

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
      <header>
        <Show when="signed-out">
          <SignInButton></SignInButton>
          <SignUpButton></SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>

      <Show when="signed-in">
        <h1>Hey there {user?.username}!</h1>
      </Show>
    </>
  )
}

export default App
