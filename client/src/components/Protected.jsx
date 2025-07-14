import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // 스피너 가능
  if (!user.isAuthenticated) return <Navigate to="/" replace />;
  if (!user.isRegistered)   return <Navigate to="/register" replace />;
  return children;
}
