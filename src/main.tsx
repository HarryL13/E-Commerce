// Changes:
// - Wrapped <App /> with <PasswordGate /> so the entire app requires a password
//   to enter. Password is configured via VITE_APP_PASSWORD env var.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import PasswordGate from './components/PasswordGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <App />
    </PasswordGate>
  </StrictMode>,
);
