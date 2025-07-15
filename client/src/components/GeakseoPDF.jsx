import React, { useRef, useState } from "react";
import html2pdf from "html2pdf.js";

const GeakseoPDF = () => {
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
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

  // 오늘 날짜 기본값
  React.useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setDate(`${yyyy}년 ${mm}월 ${dd}일`);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-gray-50 rounded-lg shadow max-w-lg mx-auto">
      <div className="w-full">
        <label className="block mb-2 font-semibold">각서 내용</label>
        <textarea
          className="w-full border border-gray-300 rounded p-2 min-h-[120px]"
          placeholder="여기에 각서 내용을 입력하세요."
          value={content}
          onChange={e => setContent(e.target.value)}
        />
      </div>
      <div className="w-full flex gap-4">
        <div className="flex-1">
          <label className="block mb-2 font-semibold">이름</label>
          <input
            className="w-full border border-gray-300 rounded p-2"
            placeholder="서명자 이름"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="block mb-2 font-semibold">날짜</label>
          <input
            className="w-full border border-gray-300 rounded p-2"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
      </div>
      <button
        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
        onClick={handleDownload}
        disabled={!content.trim() || !name.trim()}
      >
        PDF 다운로드
      </button>

      {/* PDF로 저장될 영역 (숨김X) */}
      <div ref={printRef} className="bg-white p-10 mt-8 border border-gray-300 rounded shadow w-full text-gray-900" style={{fontFamily: 'serif', minHeight: 400}}>
        <h1 className="text-2xl font-bold text-center mb-8 tracking-widest">각서</h1>
        <div className="whitespace-pre-line text-lg mb-12 min-h-[120px]">{content || "여기에 각서 내용을 입력하세요."}</div>
        <div className="flex justify-end items-end mt-12">
          <div className="text-right">
            <div>날짜: {date}</div>
            <div className="mt-2">서명: {name || ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeakseoPDF; 