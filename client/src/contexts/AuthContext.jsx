import { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);      // null = 로딩 중
  const [loading, setLoading] = useState(true);

  // 첫 로드에 로그인 상태 확인
  useEffect(() => {
    api.get('/api/user')
      .then(({ data }) => setUser(data))
      .catch(() => setUser({ isAuthenticated: false }))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    try {
      // 서버 로그아웃 및 카카오 로그아웃 URL 받기
      const { data } = await api.post('/api/logout');
      
      // 카카오 로그아웃으로 리다이렉트
      window.location.href = data.kakaoLogoutUrl;
    } catch (error) {
      console.error('로그아웃 에러:', error);
      // 에러가 발생해도 홈 화면으로 이동
      setUser({ isAuthenticated: false });
      window.location.href = '/';
    }
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}