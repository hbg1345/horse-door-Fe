// src/pages/Home.jsx
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    console.log("useEffect",user);
    if (!loading && user) {
      console.log(user.isAuthenticated, user.isRegistered);
      if (user.isAuthenticated && user.isRegistered) {
        if (location.state?.from) {
          navigate(location.state.from.pathname + location.state.from.search, { replace: true });
        } else {
          navigate('/dashboard');
        }
      } else if (user.isAuthenticated && !user.isRegistered) {
        // navigate('/register');
        console.log("navigated to register", user)
      }
    }
  }, [user, loading, navigate, location]);

  if (loading) return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-green-400 text-xl font-mono">로딩 중...</div>
    </div>
  );

  if (user?.isAuthenticated) return null; // 리다이렉트 중

  const login = () => {
    window.location.href = '/auth/kakao';
  };

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-8 text-green-400 font-mono">
          말문철 서비스
        </h1>
        <button
          onClick={login}
          className="bg-green-500 hover:bg-green-600 text-black py-4 px-8 rounded-lg shadow-lg transition-all duration-200 font-mono font-bold text-lg border-2 border-green-400 hover:border-green-300"
        >
          카카오로 로그인
        </button>
      </div>
    </div>
  );
}
