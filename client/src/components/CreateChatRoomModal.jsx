import { useState } from 'react';

export default function CreateChatRoomModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    maxParticipants: 10,
    chatType: 'normal', // 'normal' 또는 'ranking'
    isItemBattle: false,
    allowJury: false,
    allowLawyer: false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('채팅방 제목을 입력해주세요.');
      return;
    }
    onSubmit(formData);
    setFormData({
      title: '',
      description: '',
      maxParticipants: 10,
      chatType: 'normal',
      isItemBattle: false,
      allowJury: false,
      allowLawyer: false
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 border border-green-400">
        <h2 className="text-2xl font-bold text-green-400 font-mono mb-6">
          새 채팅방 만들기
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 채팅방 제목 */}
          <div>
            <label className="block text-green-400 font-mono font-semibold mb-2">
              채팅방 제목 *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono"
              placeholder="채팅방 제목을 입력하세요"
              required
            />
          </div>

          {/* 채팅방 설명 */}
          <div>
            <label className="block text-green-400 font-mono font-semibold mb-2">
              채팅방 설명
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="w-full bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono resize-none"
              placeholder="채팅방에 대한 설명을 입력하세요"
            />
          </div>

          {/* 최대 인원 */}
          <div>
            <label className="block text-green-400 font-mono font-semibold mb-2">
              최대 인원
            </label>
            <select
              name="maxParticipants"
              value={formData.maxParticipants}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono"
            >
              <option value={5}>5명</option>
              <option value={10}>10명</option>
              <option value={15}>15명</option>
              <option value={20}>20명</option>
              <option value={30}>30명</option>
            </select>
          </div>

          {/* 채팅방 타입 */}
          <div>
            <label className="block text-green-400 font-mono font-semibold mb-2">
              채팅방 타입
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  name="chatType"
                  value="normal"
                  checked={formData.chatType === 'normal'}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-400 bg-gray-800 border-green-400 focus:ring-green-400 focus:ring-2"
                />
                <label className="ml-3 text-gray-300 font-mono">
                  일반전
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="radio"
                  name="chatType"
                  value="ranking"
                  checked={formData.chatType === 'ranking'}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-400 bg-gray-800 border-green-400 focus:ring-green-400 focus:ring-2"
                />
                <label className="ml-3 text-gray-300 font-mono">
                  랭킹전
                </label>
              </div>
            </div>
          </div>

          {/* 채팅방 설정 */}
          <div>
            <label className="block text-green-400 font-mono font-semibold mb-2">
              채팅방 설정
            </label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isItemBattle"
                  checked={formData.isItemBattle}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-400 bg-gray-800 border-green-400 rounded focus:ring-green-400 focus:ring-2"
                />
                <label className="ml-3 text-gray-300 font-mono">
                  아이템전 허용
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="allowJury"
                  checked={formData.allowJury}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-400 bg-gray-800 border-green-400 rounded focus:ring-green-400 focus:ring-2"
                />
                <label className="ml-3 text-gray-300 font-mono">
                  배심원 허용
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="allowLawyer"
                  checked={formData.allowLawyer}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-400 bg-gray-800 border-green-400 rounded focus:ring-green-400 focus:ring-2"
                />
                <label className="ml-3 text-gray-300 font-mono">
                  변호사 허용
                </label>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-gray-500 hover:border-gray-400"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 bg-green-500 hover:bg-green-600 text-black py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-green-400 hover:border-green-300"
            >
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 