import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import Gacha from './pages/Gacha/Gacha.tsx';
import Collection from './pages/Collection/Collection.tsx';
import Shop from './pages/Shop/Shop.tsx';
import Battle from './pages/Battle/Battle.tsx';
import Trade from './pages/Trade/Trade.tsx';
import { ClerkProvider } from '@clerk/react';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/gacha" element={<Gacha />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/battle" element={<Battle />} />
          <Route path="/trade" element={<Trade />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);