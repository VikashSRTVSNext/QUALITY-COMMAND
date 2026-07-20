import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Extend Axios request configurations to support retry mechanisms
interface CustomRequestConfig extends InternalAxiosRequestConfig {
  retry?: number;
  retryDelay?: number;
  __retryCount?: number;
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'Factory-Command-Center-4K',
  },
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as CustomRequestConfig;
    if (!config || !config.retry) {
      return Promise.reject(error);
    }
    
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= config.retry) {
      return Promise.reject(error);
    }
    
    config.__retryCount += 1;
    const backoff = new Promise((resolve) => {
      setTimeout(() => resolve(null), config.retryDelay || 1000);
    });
    
    await backoff;
    return httpClient(config);
  }
);
