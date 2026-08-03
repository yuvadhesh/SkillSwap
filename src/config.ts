const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${window.location.protocol}//${hostname}:5000`;
    }
    // For deployed environments without explicit VITE_API_URL, default to window.location.origin
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

export const API_URL = getApiUrl();

const getPaymentApiUrl = () => {
  const envUrl = import.meta.env.VITE_PAYMENT_API_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    return window.location.origin;
  }
  return 'http://localhost:8080';
};

export const PAYMENT_API_URL = getPaymentApiUrl();


