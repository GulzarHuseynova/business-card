import { axiosInstance } from '../../api/client';

export const fallbackPut = async (url: string, bodies: unknown[]) => {
  let lastError: unknown = null;

  for (const body of bodies) {
    try {
      const response = await axiosInstance.put(url, body);
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const fallbackPost = async (url: string, bodies: unknown[]) => {
  let lastError: unknown = null;

  for (const body of bodies) {
    try {
      const response = await axiosInstance.post(url, body);
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const cleanObject = (data: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
};
