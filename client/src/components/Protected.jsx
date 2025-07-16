import { useAuth } from '../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

export default function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // 스피너 가능
  if (!user.isAuthenticated) {
    console.log('Protected: 로그인 안됨 → /');
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (!user.isRegistered) {
    console.log('Protected: 닉네임 미등록 → /register');
    return <Navigate to="/register" replace state={{ from: location }} />;
  }
  return children;
}
