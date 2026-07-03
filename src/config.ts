const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  return `${window.location.protocol}//${window.location.hostname}:5000`;
};

export const API_URL = getApiUrl();

