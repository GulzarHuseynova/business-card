import { axiosInstance as apiClient, publicAxiosInstance as publicApiClient } from '../api/client';
import type { ChangePasswordRequest, LoginFormValues } from '../types/auth.type';

type LoginPayload = LoginFormValues | Record<string, unknown>;

export const authService = {
  login: (data: LoginPayload) =>
    publicApiClient.post('/api/Auth/login', data),

  getAccountInfo: () =>
    apiClient.get('/api/Auth/account-info'),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.post('/api/Auth/change-password', {
      oldPassword: data.currentPassword,
      newPassword: data.newPassword,
    }),
};
