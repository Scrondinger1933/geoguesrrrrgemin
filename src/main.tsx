import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Client-Side Quota Defense Listener (Tier 1 per GMP Skill Section 8)
if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const isQuotaMessage = (msg: string) =>
    msg.includes('OverQuotaMapError') ||
    msg.includes('BillingNotEnabledMapError') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('exceeded your request quota') ||
    msg.includes('api-key-and-billing-errors');

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) || '')).join(' ');
    if (isQuotaMessage(msg)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      return; // Handled gracefully by Quota Defense banner
    }
    origError.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) || '')).join(' ');
    if (isQuotaMessage(msg)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      return; // Handled gracefully by Quota Defense banner
    }
    origWarn.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(<App />);
