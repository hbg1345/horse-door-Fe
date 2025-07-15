import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function EditRoomModal({ room, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxParticipants: 10,
    isRanking: false,
    isItemBattle: false,
    allowJury: true,
    allowLawyer: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (room) {
      setFormData({
        name: room.title || '', // 서버에서는 title 필드 사용
        description: room.description || '',
        maxParticipants: room.maxParticipants || 10,
        isRanking: Boolean(room.isRanking),
        isItemBattle: Boolean(room.isItemBattle),
        allowJury: room.allowJury !== false,
        allowLawyer: room.allowLawyer !== false
      });
    }
  }, [room]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 서버 API에 맞게 필드명 변경 (name -> title)
      const requestData = {
        ...formData,
        title: formData.name
      };
      delete requestData.name; // name 필드 제거
      
      await api.patch(`/api/chatrooms/${room._id}`, requestData);
      onSave();
    } catch (error) {
      alert('방 정보 수정에 실패했습니다: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1e293b',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '500px',
        border: '2px solid #4f46e5',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            color: '#a5b4fc',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            margin: 0
          }}>
            방 정보 수정
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e0e7ef',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              방 이름
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e0e7ef',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              방 설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              style={{
                width: '100%',
                padding: '12px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: '#e0e7ef',
              marginBottom: '8px',
              fontWeight: 'bold'
            }}>
              최대 인원
            </label>
            <select
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleChange}
              style={{
                width: '100%',
                padding: '12px',
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '16px'
              }}
            >
              {[6, 8, 10, 12, 14, 16, 18, 20].map(num => (
                <option key={num} value={num}>{num}명</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                color: '#e0e7ef',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="isRanking"
                  checked={formData.isRanking}
                  onChange={handleChange}
                  style={{
                    marginRight: '8px',
                    width: '16px',
                    height: '16px'
                  }}
                />
                랭킹전 활성화
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                color: '#e0e7ef',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="isItemBattle"
                  checked={formData.isItemBattle}
                  onChange={handleChange}
                  style={{
                    marginRight: '8px',
                    width: '16px',
                    height: '16px'
                  }}
                />
                아이템전 활성화
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                color: '#e0e7ef',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="allowJury"
                  checked={formData.allowJury}
                  onChange={handleChange}
                  style={{
                    marginRight: '8px',
                    width: '16px',
                    height: '16px'
                  }}
                />
                배심원 참가 허용
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                color: '#e0e7ef',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  name="allowLawyer"
                  checked={formData.allowLawyer}
                  onChange={handleChange}
                  style={{
                    marginRight: '8px',
                    width: '16px',
                    height: '16px'
                  }}
                />
                변호사 참가 허용
              </label>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '12px 24px',
                background: '#64748b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: loading ? '#475569' : '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 