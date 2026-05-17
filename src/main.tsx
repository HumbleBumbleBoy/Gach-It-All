import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { ClerkProvider } from '@clerk/react';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/gacha" element={<App />} />
          <Route path="/collection" element={<App />} />
          <Route path="/shop" element={<App />} />
          <Route path="/battle" element={<App />} />
          <Route path="/trade" element={<App />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);