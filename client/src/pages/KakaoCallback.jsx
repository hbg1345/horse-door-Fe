import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function KakaoCallback() {
  const navigate = useNavigate();

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
        .then(data => {
          // 로그인 성공 처리 (예: 토큰 저장, 페이지 이동 등)
          navigate('/dashboard');
        })
        .catch(err => {
          alert('카카오 로그인 실패');
        });
    }
  }, [navigate]);

  return <div>카카오 로그인 콜백 처리 중...</div>;
} 