import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [nickname, setNick] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.post('/api/register', { nickname: nickname.trim() });
      const { data } = await api.get('/api/user');
      setUser(data);
      navigate('/dashboard');
    } catch (err) {
      setError('닉네임 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="bg-gray-900 p-10 rounded-xl shadow-2xl w-96 text-center border border-green-400">
        <h2 className="text-3xl font-bold mb-6 text-green-400 font-mono">닉네임 설정</h2>
        <p className="text-gray-300 mb-6 font-mono">서비스 이용을 위해 닉네임을 설정해주세요</p>
        
        {error && (
          <div className="bg-red-900 border border-red-400 text-red-300 px-4 py-3 rounded mb-4 font-mono">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <input
            value={nickname}
            onChange={e => setNick(e.target.value)}
            placeholder="닉네임 입력"
            className="w-full bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono placeholder-gray-500"
            required
            disabled={loading}
          />
          <button 
            type="submit" 
            className={`w-full py-3 rounded-md font-bold transition-all duration-200 font-mono text-lg border-2 ${
              loading 
                ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-500' 
                : 'bg-green-500 hover:bg-green-600 border-green-400 hover:border-green-300 text-black'
            }`}
            disabled={loading}
          >
            {loading ? '처리 중...' : '완료'}
          </button>
        </form>
      </div>
    </div>
  );
}
