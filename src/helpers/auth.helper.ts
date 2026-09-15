import { getAccountInfo, logout } from './auth/auth-account.helper';
import { login } from './auth/auth-login.helper';
import { changePassword } from './auth/auth-password.helper';

export const authOperations = {
  login,
  changePassword,
  getAccountInfo,
  logout,
};
