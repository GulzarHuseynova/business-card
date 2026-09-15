import { Routes, Route, Navigate } from 'react-router';
import Login from '../../pages/login';
import PublicCard from '../../pages/public/public-card';
import type { PublicRouteProps } from '../../types/route.type';

export default function PublicRoute({ onLoginSuccess }: PublicRouteProps) {
  return (
    <Routes>
      <Route path="/" element={<Login onLoginSuccess={onLoginSuccess} />} />
      <Route path="/login" element={<Login onLoginSuccess={onLoginSuccess} />} />
      <Route path="/card/:cardId" element={<PublicCard />} />
      <Route path="/v/:cardId" element={<PublicCard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
