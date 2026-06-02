import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { ClerkProvider } from '@clerk/react';
import Heartbeat from './components/Heartbeat.tsx';

const Gacha = lazy(() => import('./pages/Gacha/Gacha.tsx'));
const Collection = lazy(() => import('./pages/Collection/Collection.tsx'));
const Inventory = lazy(() => import('./pages/Inventory/Inventory.tsx'));
const Shop = lazy(() => import('./pages/Shop/Shop.tsx'));
const Battle = lazy(() => import('./pages/Battle/Battle.tsx'));
const Market = lazy(() => import('./pages/Market/Market.tsx'));
const Stats = lazy(() => import('./pages/Stats/Stats.tsx'));
const Profile = lazy(() => import('./pages/Profile/Profile.tsx'));
const Settings = lazy(() => import('./pages/Settings/Settings.tsx'));
const SignInPage = lazy(() => import('./pages/Auth/SignIn'));
const SignUpPage = lazy(() => import('./pages/Auth/SignUp'));

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider 
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <Heartbeat />
      <BrowserRouter>
        <Suspense fallback={null}>
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
        </Suspense>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);