
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import { SparklesIcon, CopyIcon, CheckIcon, TrashIcon, ArrowRightIcon, UploadIcon, SaveIcon, DatabaseIcon, DownloadIcon, HeartPulseIcon } from './components/Icon';
import { RefineMode, ProcessingState, StoredADN, HealthTopic, GeneratedIdea, HealthScriptFormat, ScriptSection } from './types';
import { refineTranscript, generateScriptOutline, generateScriptSection, finalizeHealthScript } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'transcript' | 'rewrite' | 'brainstorm' | 'health'>('transcript');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [processingState, setProcessingState] = useState<ProcessingState>({ isProcessing: false, error: null, progressStep: '' });
  const [copied, setCopied] = useState(false);
  const [adnLibrary, setAdnLibrary] = useState<StoredADN[]>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const [brainstormIdeas, setBrainstormIdeas] = useState<GeneratedIdea[]>([]);
  const [transcriptMode, setTranscriptMode] = useState<RefineMode>(RefineMode.PODCAST_DIALOGUE);
  
  const [healthConfig, setHealthConfig] = useState({
    detailedIdea: '', programName: '', hostName: '', hostGender: 'Nữ',
    doctorName: '', doctorGender: 'Nam', doctorRole: 'DOCTOR' as 'DOCTOR' | 'PSYCHOLOGIST',
    callerName: '', callerIdentityMode: 'NAME' as 'NAME' | 'ANONYMOUS' | 'LOCATION',
    format: HealthScriptFormat.STUDIO_PODCAST, charCount: 20000, 
    sampleScript: '', 
    characterDNA: ''  
  });

  useEffect(() => {
    const savedData = localStorage.getItem('transcript_adn_library');
    if (savedData) { try { setAdnLibrary(JSON.parse(savedData)); } catch (e) {} }
  }, []);

  useEffect(() => {
    setOutputText('');
    setProcessingState({ isProcessing: false, error: null, progressStep: '' });
    if (activeTab !== 'health') setInputText('');
  }, [activeTab]);

  const saveToLibrary = useCallback(() => {
    if (!outputText && brainstormIdeas.length === 0) return;
    const timestamp = new Date();
    const newADN: StoredADN = {
      id: Date.now().toString(),
      title: `${activeTab.toUpperCase()} ADN - ${timestamp.toLocaleString()}`,
      content: activeTab === 'brainstorm' ? JSON.stringify(brainstormIdeas) : outputText,
      originalRaw: activeTab === 'health' ? healthConfig.detailedIdea : inputText,
      mode: activeTab === 'health' ? RefineMode.HEALTH_SCRIPT : transcriptMode,
      createdAt: Date.now()
    };
    const updated = [newADN, ...adnLibrary];
    setAdnLibrary(updated);
    localStorage.setItem('transcript_adn_library', JSON.stringify(updated));
    alert("Đã lưu ADN thành công!");
  }, [outputText, brainstormIdeas, activeTab, healthConfig, inputText, transcriptMode, adnLibrary]);

  const deleteFromLibrary = (id: string) => {
    const updated = adnLibrary.filter(item => item.id !== id);
    setAdnLibrary(updated);
    localStorage.setItem('transcript_adn_library', JSON.stringify(updated));
  };

  const handleProcess = useCallback(async () => {
    setProcessingState({ isProcessing: true, error: null, progressStep: 'Đang khởi tạo biên kịch AI...' });
    try {
       if (activeTab === 'health') {
          if (!healthConfig.detailedIdea.trim() || !healthConfig.sampleScript.trim()) throw new Error("Vui lòng nhập đầy đủ ý tưởng và kịch bản nguồn.");
          
          const hostLabel = healthConfig.hostName || 'MC';
          const guestLabel = healthConfig.doctorName || (healthConfig.doctorRole === 'DOCTOR' ? 'Bác sĩ' : 'Chuyên gia');
          const guestRoleType = healthConfig.doctorRole === 'DOCTOR' ? 'Bác sĩ' : 'Chuyên gia';
          
          let callerDisplayName = '';
          let callerRoleLabel = '';
          let mcGreetingRequirement = '';
          
          if (healthConfig.callerIdentityMode === 'NAME') {
            callerDisplayName = healthConfig.callerName || 'Thành';
            callerRoleLabel = 'Thính giả';
            mcGreetingRequirement = `- MC chào mừng thính giả "${callerDisplayName}" đến với chương trình.`;
          } else if (healthConfig.callerIdentityMode === 'ANONYMOUS') {
            callerDisplayName = 'Thính giả';
            callerRoleLabel = 'Giấu tên';
            mcGreetingRequirement = `- MC chào thính giả giấu tên đang kết nối. TUYỆT ĐỐI không xưng tên riêng.`;
          } else if (healthConfig.callerIdentityMode === 'LOCATION') {
            callerDisplayName = 'Thính giả';
            callerRoleLabel = healthConfig.callerName || 'Hà Nội';
            mcGreetingRequirement = `- MC BẮT BUỘC mở đầu bằng câu: "Alo, ${callerRoleLabel} mình đâu ạ?". Tuyệt đối không xưng tên riêng, chỉ gọi bằng địa danh "${callerRoleLabel}".`;
          }

          const contextPrompt = `
          === HƯỚNG DẪN BIÊN KỊCH CHUYÊN NGHIỆP ===
          BỐI CẢNH: ${healthConfig.format === HealthScriptFormat.STUDIO_PODCAST ? 'PODCAST STUDIO (MC, Chuyên gia và Thính giả ngồi trực tiếp tại studio)' : 'HOTLINE RADIO (Kết nối điện thoại)'}
          
          NHÂN VẬT & GIỌNG VĂN:
          - ${hostLabel} (MC): Người dẫn dắt. Học cách dùng từ từ mục "ADN LỜI THOẠI". CHỈ ĐƯỢC hỏi, thấu cảm. CẤM TƯ VẤN.
          - ${guestLabel} (${guestRoleType}): Người tư vấn. Học cách dùng từ từ mục "ADN LỜI THOẠI". DUY NHẤT người này được đưa ra lời khuyên.
          - ${callerDisplayName} (${callerRoleLabel}): Người chia sẻ vấn đề.

          LUẬT MỞ ĐẦU:
          ${mcGreetingRequirement}

          === DỮ LIỆU ADN LỜI THOẠI (BẮT BUỘC HỌC THEO CÁCH DÙNG TỪ) ===
          """
          ${healthConfig.characterDNA}
          """

          === CẤU TRÚC KỊCH BẢN MẪU (ADN PHONG CÁCH) ===
          """
          ${healthConfig.sampleScript}
          """

          Ý TƯỞNG CẦN TRIỂN KHAI: ${healthConfig.detailedIdea}
          
          LUẬT BIÊN TẬP SỐNG CÒN:
          1. CẤM: Chỉ dẫn sân khấu (ngoặc đơn).
          2. CẤM: Lặp ý giữa các phần.
          3. CẤM: Ghi "Phần 1", "Phần 2".
          `;

          const outline = await generateScriptOutline(contextPrompt, healthConfig.charCount);
          let fullResult = "";
          let accumulatedContent = "";

          // Bước 1: Viết từng phần
          for (let i = 0; i < outline.length; i++) {
              setProcessingState(p => ({ ...p, progressStep: `Đang biên tập phần ${i+1}/${outline.length}: ${outline[i].title}...` }));
              if (i > 0) await new Promise(r => setTimeout(r, 1500));
              const part = await generateScriptSection(outline[i], contextPrompt, accumulatedContent, i, outline.length, outline);
              fullResult += (i > 0 ? "\n\n" : "") + part;
              accumulatedContent += part + " ";
              setOutputText(fullResult);
          }

          // Bước 2: Rà soát và hoàn thiện cuối cùng (MỚI)
          setProcessingState(p => ({ ...p, progressStep: `Đang rà soát lỗi nhân vật, xưng hô và chuẩn hóa kịch bản...` }));
          await new Promise(r => setTimeout(r, 1000));
          const finalizedScript = await finalizeHealthScript(fullResult, healthConfig);
          setOutputText(finalizedScript);

       } else {
          const result = await refineTranscript(inputText, transcriptMode);
          setOutputText(result);
       }
    } catch (err: any) {
      setProcessingState({ isProcessing: false, error: err.message, progressStep: '' });
    } finally {
      setProcessingState(p => ({ ...p, isProcessing: false, progressStep: '' }));
    }
  }, [activeTab, healthConfig, inputText, transcriptMode]);

  const renderStyledOutput = (text: string) => {
    return text.split('\n').filter(l => l.trim()).map((line, i) => {
      const colon = line.indexOf(':');
      if (colon > 0 && colon < 60) {
        const speaker = line.substring(0, colon);
        const content = line.substring(colon + 1);
        const color = activeTab === 'health' ? 'text-rose-700' : 'text-indigo-700';
        return (
          <div key={i} className="mb-5 group">
            <span className={`font-black ${color} text-lg tracking-tight uppercase group-hover:underline decoration-2 underline-offset-4`}>
              {speaker}:
            </span>
            <span className="ml-3 text-slate-800 leading-relaxed text-base font-medium">{content}</span>
          </div>
        );
      }
      return <div key={i} className="mb-3 text-slate-400 italic px-5 border-l-4 border-slate-100 py-1">{line}</div>;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        <div className="flex justify-center mb-10 gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
          {(['transcript', 'rewrite', 'brainstorm', 'health'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-xl shadow-slate-200 ring-1 ring-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
              {tab === 'health' ? 'Radio Sức Khỏe' : tab}
            </button>
          ))}
        </div>

        {activeTab === 'health' && (
          <div className="mb-10 space-y-8 animate-fade-in">
             <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-rose-100 border border-slate-200 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-rose-900 uppercase tracking-widest ml-1">Tên Chương Trình Radio</label>
                      <input placeholder="VD: Sức Khỏe Trong Tầm Tay" className="w-full p-3.5 border-2 border-slate-200 rounded-2xl focus:border-rose-500 focus:ring-4 focus:ring-rose-50 outline-none transition-all font-bold text-slate-800" value={healthConfig.programName} onChange={e => setHealthConfig({...healthConfig, programName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-rose-900 uppercase tracking-widest ml-1">Hình Thức Radio</label>
                      <div className="flex items-center gap-6 h-[54px] bg-slate-100 rounded-2xl px-6 border-2 border-slate-200">
                          <label className="flex items-center gap-2.5 cursor-pointer font-black text-xs text-slate-800"><input type="radio" className="w-5 h-5 text-rose-700 border-2" checked={healthConfig.format === HealthScriptFormat.STUDIO_PODCAST} onChange={() => setHealthConfig({...healthConfig, format: HealthScriptFormat.STUDIO_PODCAST})} /> TẠI PHÒNG THU</label>
                          <label className="flex items-center gap-2.5 cursor-pointer font-black text-xs text-rose-900"><input type="radio" className="w-5 h-5 text-rose-700 border-2" checked={healthConfig.format === HealthScriptFormat.HOTLINE_CALL} onChange={() => setHealthConfig({...healthConfig, format: HealthScriptFormat.HOTLINE_CALL})} /> HOTLINE TRỰC TIẾP</label>
                      </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-5 border-2 border-slate-200 rounded-3xl bg-slate-100/50 space-y-4 shadow-sm">
                      <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">MC DẪN CHƯƠNG TRÌNH</p>
                      <input placeholder="VD: Thành Văn / Đinh Đoàn" className="w-full p-2.5 border-2 border-white rounded-xl text-sm font-bold shadow-sm text-slate-900" value={healthConfig.hostName} onChange={e => setHealthConfig({...healthConfig, hostName: e.target.value})} />
                      <select className="w-full p-2.5 border-2 border-white rounded-xl text-xs font-black bg-white text-slate-900" value={healthConfig.hostGender} onChange={e => setHealthConfig({...healthConfig, hostGender: e.target.value})}><option>Nữ</option><option>Nam</option></select>
                    </div>
                    <div className="p-5 border-2 border-slate-200 rounded-3xl bg-slate-100/50 space-y-3 shadow-sm">
                      <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">KHÁCH MỜI TƯ VẤN</p>
                      <div className="flex gap-4 p-1">
                          <label className="text-[11px] font-black flex items-center gap-1.5 cursor-pointer text-slate-900 uppercase"><input type="radio" checked={healthConfig.doctorRole === 'DOCTOR'} onChange={() => setHealthConfig({...healthConfig, doctorRole: 'DOCTOR'})} /> Bác sĩ</label>
                          <label className="text-[11px] font-black flex items-center gap-1.5 cursor-pointer text-slate-900 uppercase"><input type="radio" checked={healthConfig.doctorRole === 'PSYCHOLOGIST'} onChange={() => setHealthConfig({...healthConfig, doctorRole: 'PSYCHOLOGIST'})} /> Chuyên gia</label>
                      </div>
                      <input placeholder="VD: Thúy Hải" className="w-full p-2.5 border-2 border-white rounded-xl text-sm font-bold shadow-sm text-slate-900" value={healthConfig.doctorName} onChange={e => setHealthConfig({...healthConfig, doctorName: e.target.value})} />
                      <select className="w-full p-2.5 border-2 border-white rounded-xl text-xs font-black bg-white text-slate-900" value={healthConfig.doctorGender} onChange={e => setHealthConfig({...healthConfig, doctorGender: e.target.value})}><option>Nam</option><option>Nữ</option></select>
                    </div>
                    <div className="p-5 border-2 border-slate-200 rounded-3xl bg-slate-100/50 space-y-3 shadow-sm">
                      <p className="text-[10px] font-black text-rose-900 uppercase tracking-widest">THÍNH GIẢ KẾT NỐI</p>
                      <div className="flex flex-wrap gap-3 p-1">
                          <label className="text-[11px] font-black flex items-center gap-1.5 cursor-pointer text-slate-900 uppercase"><input type="radio" checked={healthConfig.callerIdentityMode === 'NAME'} onChange={() => setHealthConfig({...healthConfig, callerIdentityMode: 'NAME'})} /> Tên</label>
                          <label className="text-[11px] font-black flex items-center gap-1.5 cursor-pointer text-slate-900 uppercase"><input type="radio" checked={healthConfig.callerIdentityMode === 'ANONYMOUS'} onChange={() => setHealthConfig({...healthConfig, callerIdentityMode: 'ANONYMOUS'})} /> Ẩn danh</label>
                          <label className="text-[11px] font-black flex items-center gap-1.5 cursor-pointer text-slate-900 uppercase"><input type="radio" checked={healthConfig.callerIdentityMode === 'LOCATION'} onChange={() => setHealthConfig({...healthConfig, callerIdentityMode: 'LOCATION'})} /> Địa danh</label>
                      </div>
                      <input 
                          placeholder={
                            healthConfig.callerIdentityMode === 'LOCATION' ? 'VD: Hà Nội, Hải Phòng...' : 
                            healthConfig.callerIdentityMode === 'ANONYMOUS' ? 'Thính giả giấu tên' : 'Nhập Tên thính giả'
                          } 
                          className="w-full p-2.5 border-2 border-white rounded-xl text-sm font-bold shadow-sm text-slate-900" 
                          value={healthConfig.callerName} 
                          onChange={e => setHealthConfig({...healthConfig, callerName: e.target.value})} 
                          disabled={healthConfig.callerIdentityMode === 'ANONYMOUS'} 
                      />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-rose-900 uppercase tracking-widest ml-1">Ý tưởng/Vấn đề cần khai thác</label>
                    <textarea placeholder="VD: Thính giả tâm sự về việc mất ngủ lâu năm, bác sĩ đưa ra lời khuyên..." className="w-full h-28 p-4 border-2 border-slate-200 rounded-3xl focus:border-rose-500 focus:ring-4 focus:ring-rose-50 outline-none transition-all font-medium text-slate-900 bg-white shadow-inner" value={healthConfig.detailedIdea} onChange={e => setHealthConfig({...healthConfig, detailedIdea: e.target.value})} />
                </div>
                
                <div className="flex flex-col md:flex-row justify-between items-center bg-rose-50 p-6 rounded-3xl border-2 border-rose-200 gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-rose-950 uppercase tracking-widest">ĐỘ DÀI KỊCH BẢN</span>
                      <span className="text-xl font-black text-rose-900">{healthConfig.charCount.toLocaleString()} KÝ TỰ</span>
                    </div>
                    <input type="range" min="5000" max="150000" step="5000" className="flex-grow max-w-xl accent-rose-700 h-2 bg-rose-200 rounded-full appearance-none cursor-pointer" value={healthConfig.charCount} onChange={e => setHealthConfig({...healthConfig, charCount: parseInt(e.target.value)})} />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-8 rounded-[40px] shadow-xl border-2 border-slate-100 flex flex-col space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><DatabaseIcon className="w-5 h-5" /></div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">ADN PHONG CÁCH (Kịch bản mẫu)</h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 italic">Dán kịch bản có cấu trúc bạn muốn AI học theo.</p>
                    <textarea className="flex-grow h-64 p-5 border-2 border-slate-50 rounded-3xl bg-slate-50/50 outline-none focus:border-indigo-300 transition-all font-mono text-xs leading-relaxed" placeholder="Dán kịch bản mẫu tại đây..." value={healthConfig.sampleScript} onChange={e => setHealthConfig({...healthConfig, sampleScript: e.target.value})} />
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-xl border-2 border-rose-100 flex flex-col space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><SparklesIcon className="w-5 h-5" /></div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">ADN LỜI THOẠI (Giọng văn nhân vật)</h3>
                    </div>
                    <p className="text-[10px] font-bold text-rose-400 italic">Dán các câu thoại đặc trưng của Đinh Đoàn, Thành Văn, Thúy Hải...</p>
                    <textarea className="flex-grow h-64 p-5 border-2 border-rose-50 rounded-3xl bg-rose-50/50 outline-none focus:border-rose-300 transition-all font-mono text-xs leading-relaxed" placeholder="VD: Đinh Đoàn: 'Chào bạn, câu chuyện của bạn thực sự làm tôi suy nghĩ...' " value={healthConfig.characterDNA} onChange={e => setHealthConfig({...healthConfig, characterDNA: e.target.value})} />
                </div>
             </div>
          </div>
        )}

        {activeTab !== 'health' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 min-h-[600px]">
            <div className="bg-white rounded-[40px] shadow-2xl border-4 border-white overflow-hidden flex flex-col group">
              <div className="bg-slate-50 p-6 border-b flex justify-between items-center">
                <span className="font-black text-slate-900 text-xs uppercase tracking-[0.2em]">DỮ LIỆU NGUỒN</span>
              </div>
              <textarea className="flex-grow p-8 resize-none outline-none font-mono text-sm leading-[1.8] text-slate-600 bg-slate-50/20" placeholder="Dán dữ liệu thô..." value={inputText} onChange={e => setInputText(e.target.value)} />
            </div>
            
            <div className="bg-white rounded-[40px] shadow-2xl border-4 border-white overflow-hidden flex flex-col relative ring-1 ring-slate-100">
              <div className="bg-slate-900 p-6 border-b flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <span className="text-white font-black text-xs uppercase tracking-[0.2em]">KẾT QUẢ BIÊN TẬP</span>
                    {outputText && (
                      <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-3 py-1 rounded-full font-black border border-emerald-500/30 tracking-widest">
                        {outputText.length.toLocaleString()} CHS
                      </div>
                    )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { navigator.clipboard.writeText(outputText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-[10px] font-black bg-white/5 text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10 tracking-widest">
                      {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
                      {copied ? 'COPIED' : 'COPY'}
                  </button>
                  <button onClick={saveToLibrary} className="text-[10px] font-black bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-xl shadow-indigo-500/30 tracking-widest">
                      <SaveIcon className="w-3 h-3" />
                      LƯU ADN
                  </button>
                </div>
              </div>
              <div className="flex-grow p-10 overflow-y-auto bg-white">
                {processingState.isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-8">
                      <div className="relative">
                        <div className="w-20 h-20 border-8 border-slate-50 rounded-full"></div>
                        <div className="absolute top-0 w-20 h-20 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <div className="text-center space-y-3">
                        <p className="font-black text-slate-900 text-xl tracking-tight uppercase">{processingState.progressStep}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] animate-pulse">AI đang biên tập DNA nội dung</p>
                      </div>
                  </div>
                ) : (
                  outputText ? renderStyledOutput(outputText) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-6">
                        <div className="p-10 bg-slate-50 rounded-full shadow-inner">
                            <SparklesIcon className="w-16 h-16" />
                        </div>
                        <p className="font-black text-[10px] tracking-[0.4em] uppercase opacity-40">Hệ thống sẵn sàng</p>
                      </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && outputText && (
          <div className="mt-10 bg-white rounded-[40px] shadow-2xl border-4 border-white overflow-hidden flex flex-col relative ring-1 ring-rose-100">
            <div className="bg-rose-900 p-6 border-b flex justify-between items-center">
               <div className="flex items-center gap-4">
                  <span className="text-white font-black text-xs uppercase tracking-[0.2em]">KẾT QUẢ KỊCH BẢN RADIO</span>
                  <div className="bg-white/20 text-white text-[10px] px-3 py-1 rounded-full font-black border border-white/30 tracking-widest">
                    {outputText.length.toLocaleString()} CHS
                  </div>
               </div>
               <div className="flex gap-3">
                  <button onClick={() => { navigator.clipboard.writeText(outputText); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-[10px] font-black bg-white/5 text-white px-4 py-2 rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10 tracking-widest">
                      {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}
                      {copied ? 'COPIED' : 'COPY'}
                  </button>
                  <button onClick={saveToLibrary} className="text-[10px] font-black bg-white text-rose-900 px-4 py-2 rounded-xl hover:bg-rose-50 transition-all flex items-center gap-2 shadow-xl tracking-widest">
                      <SaveIcon className="w-3 h-3" />
                      LƯU KỊCH BẢN
                  </button>
               </div>
            </div>
            <div className="p-10 bg-white min-h-[400px]">
                {processingState.isProcessing ? (
                   <div className="flex flex-col items-center justify-center h-64 gap-6">
                      <div className="w-12 h-12 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin"></div>
                      <p className="font-black text-rose-900 text-sm uppercase tracking-widest animate-pulse">{processingState.progressStep}</p>
                   </div>
                ) : renderStyledOutput(outputText)}
            </div>
          </div>
        )}

        <div className="mt-16 flex justify-center">
           <button onClick={handleProcess} disabled={processingState.isProcessing} className="group relative bg-slate-900 text-white px-16 py-7 rounded-[32px] font-black text-2xl shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] hover:shadow-indigo-500/30 hover:-translate-y-1 transition-all flex items-center gap-6 overflow-hidden disabled:bg-slate-300 disabled:translate-y-0">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              <SparklesIcon className="w-8 h-8 text-indigo-400 group-hover:animate-bounce" />
              {processingState.isProcessing ? 'ĐANG BIÊN TẬP...' : 'BẮT ĐẦU XỬ LÝ'}
           </button>
        </div>

        {adnLibrary.length > 0 && (
          <div className="mt-32 border-t-4 border-slate-100 pt-20">
            <div className="flex items-center gap-5 mb-12">
               <div className="p-5 bg-slate-900 rounded-[28px] shadow-2xl shadow-slate-900/40 text-white">
                  <DatabaseIcon className="w-8 h-8" />
               </div>
               <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">KHO ADN DỮ LIỆU</h2>
                  <p className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">Lịch sử biên tập</p>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {adnLibrary.slice(0, 9).map(item => (
                <div key={item.id} className="group bg-white p-8 rounded-[40px] border-2 border-slate-50 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all flex flex-col cursor-pointer" onClick={() => { setOutputText(item.content); setInputText(item.originalRaw); window.scrollTo({top: 400, behavior: 'smooth'}); }}>
                  <div className="flex justify-between items-start mb-5">
                     <span className="text-[9px] font-black bg-slate-900 text-white px-3 py-1.5 rounded-full uppercase tracking-widest">{item.mode}</span>
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-black text-slate-800 text-lg mb-3 line-clamp-1 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                  <p className="text-xs text-slate-500 line-clamp-5 flex-grow mb-8 leading-relaxed font-bold opacity-60 italic">"{item.content.substring(0, 300)}..."</p>
                  <div className="flex justify-between mt-auto border-t-2 border-slate-50 pt-6">
                    <span className="text-[10px] font-black text-indigo-600 flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                       <ArrowRightIcon className="w-4 h-4" /> MỞ LẠI ADN
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); deleteFromLibrary(item.id); }} className="text-[10px] font-black text-slate-200 hover:text-red-500 transition-colors uppercase tracking-widest">XÓA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
