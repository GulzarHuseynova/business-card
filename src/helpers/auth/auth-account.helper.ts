import { authService } from '../../services/auth.service';
import { authSessionStorage } from '../../storage/auth-session.storage';

export const getAccountInfo = async () => {
  const response = await authService.getAccountInfo();
  return response.data;
};

export const logout = (): void => {
  authSessionStorage.clear();
  window.location.href = '/login';
};
