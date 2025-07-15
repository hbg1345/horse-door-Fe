import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function KakaoCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    const code = new URL(window.location.href).searchParams.get('code');
    if (code) {
      fetch(`/auth/kakao/callback?code=${code}`, {
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) throw new Error('로그인 실패');
          return res.json();
        })
        .then(async () => {
          // 로그인 성공 후 user 정보 갱신
          const res = await fetch('/api/user', { credentials: 'include' });
          const data = await res.json();
          setUser(data);
          navigate('/');
        })
        .catch(err => {
          alert('카카오 로그인 실패');
        });
    }
  }, [navigate, setUser]);

  return <div>카카오 로그인 콜백 처리 중...</div>;
} 