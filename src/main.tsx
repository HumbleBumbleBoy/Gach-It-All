import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Gacha from './pages/Gacha/Gacha.tsx';
import Collection from './pages/Collection/Collection.tsx';
import Inventory from './pages/Inventory/Inventory.tsx';
import Shop from './pages/Shop/Shop.tsx';
import Battle from './pages/Battle/Battle.tsx';
import Market from './pages/Market/Market.tsx';
import Stats from './pages/Stats/Stats.tsx';
import Profile from './pages/Profile/Profile.tsx';
import Settings from './pages/Settings/Settings.tsx';
import SignInPage from './pages/Auth/SignIn';
import SignUpPage from './pages/Auth/SignUp';
import { ClerkProvider } from '@clerk/react';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/gacha" element={<Gacha />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/market" element={<Market />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);