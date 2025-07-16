import React, { useRef, useState, useEffect } from "react";
import html2pdf from "html2pdf.js";

const GeakseoPDF = ({ onClose }) => {
  const [content, setContent] = useState("");
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [date, setDate] = useState("");
  const printRef = useRef();

  const handleDownload = () => {
    const element = printRef.current;
    const opt = {
      margin: 0.5,
      filename: "각서.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };
    html2pdf().set(opt).from(element).save();
  };

  const handleClose = () => {
    if (onClose && typeof onClose === 'function') {
      onClose();
    }
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 오늘 날짜 기본값
  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}년 ${mm}월 ${dd}일`);
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center"
      style={{ zIndex: 9999 }}
      onClick={handleBackgroundClick}
    >
      <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border-2 border-gray-600" style={{ maxHeight: '90vh', minHeight: '600px' }}>
        <div className="flex justify-between items-center p-5 border-b border-gray-600">
          <h2 className="text-xl font-bold text-white font-mono">각서 작성</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl font-bold transition-colors cursor-pointer"
            type="button"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          <div className="flex flex-col gap-5">
            <div className="w-full">
              <label className="block mb-2 font-semibold text-gray-300 font-mono">각서 내용</label>
              <textarea
                className="w-full bg-gray-700 border border-gray-500 rounded-lg p-3 min-h-[120px] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                placeholder="여기에 각서 내용을 입력하세요."
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </div>
            <div className="w-full flex gap-4">
              <div className="flex-1">
                <label className="block mb-2 font-semibold text-gray-300 font-mono">당사자A</label>
                <input
                  className="w-full bg-gray-700 border border-gray-500 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  placeholder="당사자A 이름"
                  value={nameA}
                  onChange={e => setNameA(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block mb-2 font-semibold text-gray-300 font-mono">당사자B</label>
                <input
                  className="w-full bg-gray-700 border border-gray-500 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
                  placeholder="당사자B 이름"
                  value={nameB}
                  onChange={e => setNameB(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-5 py-3 bg-indigo-600 text-white rounded-lg font-bold font-mono text-base hover:bg-indigo-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed border-2 border-indigo-500 hover:border-indigo-400"
                onClick={handleDownload}
                disabled={!content.trim() || !nameA.trim() || !nameB.trim()}
                type="button"
              >
                PDF 다운로드
              </button>
            </div>
          </div>
          {/* 미리보기 */}
          <div className="mt-8 flex justify-center items-center w-full">
            <div
              ref={printRef}
              className="bg-white p-5 border-2 border-yellow-500 rounded-lg shadow-lg text-gray-900"
              style={{ fontFamily: 'serif', maxWidth: 600, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <h1 className="text-2xl font-bold text-center mb-5 tracking-widest text-black">각서</h1>
              <div className="whitespace-pre-line text-lg mb-6 min-h-[60px] text-gray-800 w-full text-left">{content || "여기에 각서 내용을 입력하세요."}</div>
              <div className="flex flex-col items-end mt-6 w-full gap-1">
                <div className="text-gray-700 text-lg">{date}</div>
                <div className="text-gray-700 text-lg">서명: {nameA || ""}</div>
                <div className="text-gray-700 text-lg">서명: {nameB || ""}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeakseoPDF; 