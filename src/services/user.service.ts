import { axiosInstance as apiClient } from '../api/client';

export const userService = {
  getUserById: (userId: string) =>
    apiClient.get(`/api/User/${encodeURIComponent(userId)}`),

  updateProfile: (data: unknown) =>
    apiClient.put('/api/User/profile', data),

  uploadProfilePhoto: (data: FormData) =>
    apiClient.post('/api/User/profile/photo', data),

  uploadCardBackground: (data: FormData) =>
    apiClient.post('/api/User/profile/card-background', data),

  uploadSocialIcon: (data: FormData) =>
    apiClient.post('/api/User/profile/social-icon', data),
};
