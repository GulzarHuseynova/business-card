import axios from 'axios';
import { getAuthHeaders } from '../utils/api.utils';
import { mockApiAdapter } from '../mock/mock.api';

// Deploy/demo rejimində backend-ə heç bir sorğu getmir.
// Bütün /api sorğuları mockApiAdapter tərəfindən brauzerin içində cavablandırılır.
export const MOCK_API_ENABLED = true;
export const API_TARGET_URL = '';
export const API_BASE_URL = '';
export const API_TIMEOUT_MS = 15000;

export const axiosInstance = axios.create({
  timeout: API_TIMEOUT_MS,
  adapter: mockApiAdapter,
});

export const publicAxiosInstance = axios.create({
  timeout: API_TIMEOUT_MS,
  adapter: mockApiAdapter,
});

const isAuthFreeEndpoint = (url = '') => url.includes('/api/Auth/login');

axiosInstance.interceptors.request.use(
  (config) => {
    if (isAuthFreeEndpoint(config.url || '')) return config;

    const { Authorization } = getAuthHeaders();
    if (Authorization) {
      config.headers.set?.('Authorization', Authorization);
      if (!config.headers.set) config.headers.Authorization = Authorization;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(error),
);
