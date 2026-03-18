// ============================================================
// KanoQuestionGenerator.jsx — 題目產生器主元件
// ============================================================

import React, { useState, useRef, useMemo } from 'react';
import {
  Wand, Zap, BarChart, Download, FileText, Eye, Key,
  ImageIcon, Upload, Info, Save, FolderOpen, RefreshCw,
  Trash, Search, X,
} from 'lucide-react';
import { SYSTEM_PROMPT_V12, CATEGORY_COLORS, SHORT_NAMES, DEFAULT_GUIDE } from './constants';
import { callGeminiAPI, fileToBase64 } from './helpers';
import { AmiorStatsSummary, AmiorGuideSection } from './components';

const KanoQuestionGenerator = ({ showNotification, generatorState, setGeneratorState }) => {
  const { apiKey = '', files, description, prompt, generatedQuestions, generatedGuide } = generatorState;
  const [isGenerating, setIsGenerating]       = useState(false);
  const [refineTarget, setRefineTarget]         = useState('1');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [isRefining, setIsRefining]             = useState(false);
  const [analyzingStep, setAnalyzingStep]       = useState('');
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const projectInputRef = useRef(null);

  // --- 檔案上傳 ---
  const handleFileChange = (e) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : 'image',
    }));
    setGeneratorState((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }));
  };

  const removeFile = (id) =>
    setGeneratorState((prev) => ({ ...prev, files: prev.files.filter((f) => f.id !== id) }));

  const handlePromptChange      = (e) => setGeneratorState((prev) => ({ ...prev, prompt: e.target.value }));
  const handleDescriptionChange = (e) => setGeneratorState((prev) => ({ ...prev, description: e.target.value }));

  // --- 生成題目 ---
  const generateQuestions = async () => {
    if (!apiKey.trim()) { showNotification('請先輸入 Gemini API Key', 'error'); return; }
    if (!description.trim() && files.length === 0) {
      showNotification('請輸入描述或上傳圖片/影片，以便系統進行分析', 'error');
      return;
    }

    setIsGenerating(true);
    setAnalyzingStep('分析內容中 (呼叫 AI)...');

    try {
      let payload;

      if (files.length > 0) {
        const parts = [
          { text: `[System Instruction]\n${prompt}\n\n[User Request]\n${description || '請根據提供的圖片/影片生成題目。'}` },
        ];
        for (const f of files) {
          if (f.type === 'image' || f.type === 'video') {
            try {
              const base64Data = await fileToBase64(f.file);
              parts.push({ inlineData: { mimeType: f.file.type, data: base64Data } });
            } catch (e) {
              console.warn('Failed to convert file:', f.file.name);
            }
          }
        }
        payload = { contents: [{ role: 'user', parts }] };
      } else {
        payload = {
          contents: [{ parts: [{ text: description || '請生成問卷題目' }] }],
          systemInstruction: { parts: [{ text: prompt }] },
        };
      }

      const resultData = await callGeminiAPI(payload, apiKey);
      const generatedText = resultData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) throw new Error('No text generated in response');

      let parsedData = {};
      let cleanText = generatedText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

      try {
        parsedData = JSON.parse(cleanText);
      } catch {
        const match = cleanText.match(/\{[\s\S]*\}/) || cleanText.match(/\[[\s\S]*\]/);
        if (match) {
          try { parsedData = JSON.parse(match[0]); } catch { throw new Error('Invalid JSON format from AI'); }
        } else {
          throw new Error('Invalid JSON format from AI');
        }
      }

      let newQuestions = [];
      let newGuide = null;

      if (Array.isArray(parsedData)) {
        newQuestions = parsedData;
      } else if (parsedData.questions) {
        newQuestions = parsedData.questions;
        newGuide = parsedData.guide;
      }

      if (Array.isArray(newQuestions)) {
        setGeneratorState((prev) => ({ ...prev, generatedQuestions: newQuestions, generatedGuide: newGuide }));
        showNotification(`成功生成 ${newQuestions.length} 組題目！`, 'success');
      } else {
        throw new Error('AI returned unexpected format');
      }
    } catch (error) {
      console.error('Generation Failed:', error);
      showNotification(`生成失敗：${error.message}`, 'error');
    } finally {
      setIsGenerating(false);
      setAnalyzingStep('');
    }
  };

  // --- 優化單題 / 全體題目 ---
  const handleRefineQuestion = async () => {
    if (!apiKey.trim()) { showNotification('請先輸入 Gemini API Key', 'error'); return; }
    if (!refineInstruction.trim()) { showNotification('請輸入優化需求', 'error'); return; }

    setIsRefining(true);

    try {
      const isAll = refineTarget === 'ALL';
      const standardResponsesJSON = JSON.stringify(['我非常喜歡', '我期望如此', '無所謂', '可以接受', '無法接受']);

      const commonGuidePrompt = `
2. 根據新題目組合，重新撰寫「Kano 模型判讀指南」(Guide)。
   **重要規範 (Strict Requirement)**：
   "guide" 物件必須包含 "positive_analysis" 和 "negative_analysis" 兩個陣列。
   **每個陣列必須嚴格包含以下 5 個標準回答**，不得遺漏：
   ${standardResponsesJSON}
   每個回答物件需包含 "response" (回答), "category" (AMIOR分類), "reason" (判讀理由)。
   **屬性規範**："category" 欄位必須明確且單一 (例如 "A 魅力品質")，**絕對禁止**出現 "A/O", "M/I" 等模糊寫法。
`;

      let refinePrompt = '';

      if (isAll) {
        refinePrompt = `
# Role
你是資深產品經理 (PM)。

# Task
請根據使用者的需求，**一次修改所有** Kano 問卷題目。
${commonGuidePrompt}

# Current Questions (目前所有題目)
${JSON.stringify(generatedQuestions, null, 2)}

# Output Format (Strict JSON)
請回傳包含以下兩個欄位的 JSON 物件：
1. "questions": 修改後的所有題目陣列 (Array of objects)。
2. "guide": 符合上述規範的指南物件。
`;
      } else {
        const targetIndex = generatedQuestions.findIndex((q) => String(q.id) === String(refineTarget));
        if (targetIndex === -1) throw new Error('找不到該題目 ID，請確認題號');
        const targetQ = generatedQuestions[targetIndex];

        refinePrompt = `
# Role
你是資深產品經理 (PM)。

# Task
1. 根據使用者的需求，修改指定的 Kano 問卷題目 (Target Question)。
${commonGuidePrompt}

# Target Question (需修改的題目)
${JSON.stringify(targetQ, null, 2)}

# Full Question Context (目前所有題目列表，供生成指南參考)
${JSON.stringify(generatedQuestions, null, 2)}

# Output Format (Strict JSON)
請回傳包含以下兩個欄位的 JSON 物件：
1. "refinedQuestion": 修改後的該題目物件 (結構需與原題目一致)。
2. "guide": 符合上述規範的指南物件。
`;
      }

      const payload = {
        contents: [{ parts: [{ text: `修改需求：${refineInstruction}` }] }],
        systemInstruction: { parts: [{ text: refinePrompt }] },
      };

      const resultData = await callGeminiAPI(payload, apiKey);
      const generatedText = resultData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) throw new Error('No text generated in response');

      let result = {};
      let cleanText = generatedText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

      try {
        result = JSON.parse(cleanText);
      } catch {
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) {
          try { result = JSON.parse(match[0]); } catch { throw new Error('Invalid JSON format from AI'); }
        } else {
          throw new Error('Invalid JSON format from AI');
        }
      }

      const isValidGuide = (g) =>
        g &&
        Array.isArray(g.positive_analysis) && g.positive_analysis.length === 5 &&
        Array.isArray(g.negative_analysis) && g.negative_analysis.length === 5;

      const finalGuide = isValidGuide(result.guide) ? result.guide : (generatedGuide || DEFAULT_GUIDE);

      if (isAll) {
        if (!result.questions || !Array.isArray(result.questions))
          throw new Error("AI response missing valid 'questions' array");
        setGeneratorState((prev) => ({
          ...prev, generatedQuestions: result.questions, generatedGuide: finalGuide,
        }));
        showNotification('全體題目優化完成！', 'success');
      } else {
        if (!result.refinedQuestion) throw new Error("AI response missing 'refinedQuestion'");
        const targetIndex = generatedQuestions.findIndex((q) => String(q.id) === String(refineTarget));
        if (targetIndex !== -1) {
          const newQuestions = [...generatedQuestions];
          result.refinedQuestion.id = generatedQuestions[targetIndex].id;
          newQuestions[targetIndex] = result.refinedQuestion;
          setGeneratorState((prev) => ({
            ...prev, generatedQuestions: newQuestions, generatedGuide: finalGuide,
          }));
          showNotification(`題目 ${refineTarget} 優化完成！`, 'success');
        }
      }

      setRefineInstruction('');
    } catch (error) {
      console.error('Refine Failed:', error);
      showNotification(`優化失敗：${error.message}`, 'error');
    } finally {
      setIsRefining(false);
    }
  };

  // --- 儲存 / 讀取專案 ---
  const saveProject = () => {
    const projectData = { description, prompt, generatedQuestions, generatedGuide, timestamp: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kano_Generator_Project_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showNotification('專案儲存成功', 'success');
  };

  const loadProject = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        setGeneratorState((prev) => ({
          ...prev,
          description: data.description || '',
          prompt: data.prompt || SYSTEM_PROMPT_V12,
          generatedQuestions: data.generatedQuestions || [],
          generatedGuide: data.generatedGuide || null,
        }));
        showNotification('專案讀取成功！', 'success');
      } catch { showNotification('讀取失敗：格式錯誤', 'error'); }
    };
    reader.readAsText(file);
  };

  // --- 匯出 Excel ---
  const exportToExcel = () => {
    if (generatedQuestions.length === 0) { showNotification('無題目可匯出', 'error'); return; }
    try {
      const wsDataView = [
        ['題組', '功能情境', 'AMIOR 分類', '心理理由', '正向問句', '反向問句'],
        ...generatedQuestions.map((q) => [q.id, q.feature, `${q.amior} (${q.categoryName})`, q.reason, q.positive, q.negative]),
      ];
      const typeSheetData = [
        ['題號', '功能特徵', '正向題目', '反向題目'],
        ...generatedQuestions.map((q, idx) => [`Q${idx + 1}`, q.feature, q.positive, q.negative]),
      ];
      if (window.XLSX) {
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(wsDataView), '題目設計總覽');
        window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(typeSheetData), '題型');
        window.XLSX.writeFile(wb, `Kano_Questions_Design_${new Date().toISOString().split('T')[0]}.xlsx`);
        showNotification('Excel 匯出成功！', 'success');
      } else {
        showNotification('Excel 元件尚未載入完成，請稍後再試', 'error');
      }
    } catch (error) { console.error(error); showNotification('Excel 匯出失敗', 'error'); }
  };

  // --- 匯出 Word（供 Forms 匯入）---
  const exportToWord = async () => {
    if (generatedQuestions.length === 0) { showNotification('無題目可匯出', 'error'); return; }
    if (!window.docx) { showNotification('Word 產生套件尚未載入，請稍後再試', 'error'); return; }

    try {
      const { Document, Packer, Paragraph } = window.docx;
      const children = [];
      let questionNumber = 1;

      generatedQuestions.forEach((q) => {
        children.push(new Paragraph({ text: `${questionNumber}. ${q.positive} *` }));
        ['A. 我非常喜歡', 'B. 我期望如此', 'C. 無所謂', 'D. 可以接受', 'E. 無法接受'].forEach((opt) =>
          children.push(new Paragraph({ text: opt }))
        );
        children.push(new Paragraph({ text: '' }));
        questionNumber++;

        children.push(new Paragraph({ text: `${questionNumber}. ${q.negative} *` }));
        ['A. 我非常喜歡', 'B. 我期望如此', 'C. 無所謂', 'D. 可以接受', 'E. 無法接受'].forEach((opt) =>
          children.push(new Paragraph({ text: opt }))
        );
        children.push(new Paragraph({ text: '' }));
        questionNumber++;
      });

      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kano_Survey_For_Forms_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('Word 匯出成功！請直接上傳至 Forms', 'success');
    } catch (error) { console.error(error); showNotification('Word 匯出失敗', 'error'); }
  };

  // --- 統計 AMIOR 分佈 ---
  const amiorStats = useMemo(() => {
    if (!generatedQuestions || generatedQuestions.length === 0) return null;
    const counts = { A: 0, O: 0, M: 0, I: 0, R: 0 };
    generatedQuestions.forEach((q) => { if (counts[q.amior] !== undefined) counts[q.amior]++; });
    return counts;
  }, [generatedQuestions]);

  const guide = generatedGuide || DEFAULT_GUIDE;

  return (
    <div className="flex flex-col gap-6">
      {/* ── 上方：素材上傳 + AI 設定 ── */}
      <div className="flex flex-col lg:flex-row gap-6 shrink-0">
        {/* 左：素材上傳 */}
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-800 text-sm">
            <ImageIcon className="w-4 h-4 text-blue-500" /> 1. 上傳素材 (圖片/影片)
          </h3>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition relative mb-4 shrink-0">
            <input
              type="file" multiple accept="image/*,video/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-1">
              <div className="p-2 bg-blue-50 rounded-full text-blue-500"><Upload className="w-5 h-5" /></div>
              <p className="text-xs font-medium text-slate-600">點擊或拖曳上傳多個檔案</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 shrink-0 h-24 custom-scrollbar">
              {files.map((file) => (
                <div key={file.id} className="relative group w-24 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                  {file.type === 'video'
                    ? <video src={file.url} className="w-full h-full object-cover" />
                    : <img src={file.url} alt="preview" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <button onClick={() => removeFile(file.id)} className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 className="font-bold mb-2 flex items-center gap-2 text-slate-800 text-sm mt-auto">
            <Info className="w-4 h-4 text-blue-500" /> 2. 內容描述 (關鍵)
          </h3>
          <textarea
            className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none h-32 resize-none"
            placeholder="請描述玩法、介面大綱"
            value={description}
            onChange={handleDescriptionChange}
          ></textarea>
        </div>

        {/* 右：AI 設定 */}
        <div className="lg:w-[480px] bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
          <h3 className="font-bold mb-3 flex items-center gap-2 text-slate-800 text-sm">
            <Wand className="w-4 h-4 text-purple-500" /> 3. AI 題目生成設定
          </h3>

          {/* 儲存 / 讀取專案 */}
          <div className="flex gap-2 mb-4 shrink-0">
            <button
              onClick={saveProject}
              className="flex-1 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-2 border border-slate-200"
            >
              <Save className="w-3 h-3" /> 儲存專案
            </button>
            <div className="flex-1 relative">
              <input type="file" ref={projectInputRef} onChange={loadProject} accept=".json"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <button className="w-full h-full bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-2 border border-slate-200">
                <FolderOpen className="w-3 h-3" /> 讀取專案
              </button>
            </div>
          </div>

          {/* API Key 欄位 */}
          <div className="mb-4 flex flex-col shrink-0">
            <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1">
              <Key className="w-3 h-3" /> Gemini API Key
              <span className="text-red-500 ml-auto">*必填</span>
            </label>
            <input
              type="password"
              className="w-full border border-slate-300 bg-slate-50 text-slate-700 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              placeholder="請輸入 Google Gemini API Key"
              value={apiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setGeneratorState((prev) => ({ ...prev, apiKey: newKey }));
                try { localStorage.setItem('gemini_api_key', newKey); } catch {}
              }}
            />
          </div>

          {/* 定義提詞 */}
          <div className="mb-4 flex-1 flex flex-col min-h-0">
            <label className="text-xs font-bold text-slate-700 block mb-2 flex justify-between shrink-0">
              定義提詞 (Prompt)
            </label>
            <textarea
              className="w-full border border-slate-300 bg-slate-50 text-slate-500 rounded-lg p-3 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none flex-1 resize-none"
              value={prompt}
              onChange={handlePromptChange}
            ></textarea>
          </div>

          {/* 生成按鈕 */}
          <button
            onClick={generateQuestions}
            disabled={isGenerating}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-sm flex items-center justify-center gap-2 transition shrink-0 ${
              isGenerating ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90'
            }`}
          >
            {isGenerating
              ? <>{analyzingStep || '分析圖片與描述中...'}</>
              : <><Zap className="w-4 h-4" /> 根據內容生成題目</>}
          </button>
        </div>
      </div>

      {/* ── 生成結果預覽區 ── */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
        <div className="flex justify-between items-center mb-4 shrink-0 border-b pb-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-indigo-600" /> 生成結果預覽
          </h3>
          {generatedQuestions.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" /> 匯出 Excel
              </button>
              <button
                onClick={exportToWord}
                className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 font-bold flex items-center gap-2 transition"
              >
                <FileText className="w-4 h-4" /> 匯出 Word (Forms)
              </button>
              <button
                onClick={() => setShowScreenshotModal(true)}
                className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold flex items-center gap-2 transition"
              >
                <Eye className="w-4 h-4" /> 題目總覽 (截圖用)
              </button>
            </div>
          )}
        </div>

        {generatedQuestions.length > 0 ? (
          <div className="flex flex-col gap-6">
            <AmiorStatsSummary amiorStats={amiorStats} />

            {/* 題目卡片列表 */}
            <div className="grid grid-cols-1 gap-4">
              {generatedQuestions.flatMap((q, idx) => [
                { ...q, type: 'positive', label: '正向題', text: q.positive, seqId: idx * 2 + 1, badgeColor: 'bg-green-600', groupID: q.id },
                { ...q, type: 'negative', label: '反向題', text: q.negative, seqId: idx * 2 + 2, badgeColor: 'bg-red-600',   groupID: q.id },
              ]).map((item) => (
                <div
                  key={`${item.groupID}-${item.type}`}
                  onClick={() => setRefineTarget(item.groupID)}
                  className={`p-5 rounded-xl border transition-all cursor-pointer relative group ${
                    String(refineTarget) === String(item.groupID)
                      ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="font-bold text-slate-800 mb-2 flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${item.badgeColor}`}>
                      Q{item.seqId} {item.label}
                    </span>
                  </div>
                  <div className="pl-1">
                    <p className="text-slate-900 text-base font-bold mb-2">{item.text}</p>
                    <div className="text-sm text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200 mt-2">
                      <span className="font-extrabold text-blue-700">{String(item.amior)}</span>
                      <span className="font-bold text-slate-700">（{String(item.categoryName)}）</span>：
                      {String(item.reason)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI 題目優化列 */}
            <div className="shrink-0 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
              <div className="flex items-center gap-2 shrink-0">
                <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div><h4 className="font-bold text-indigo-900 text-sm">AI 題目優化</h4></div>
              </div>
              <div className="flex-1 flex gap-2 w-full items-center">
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${
                    refineTarget === 'ALL' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {refineTarget === 'ALL' ? '針對：全體題目' : `針對：題組 ${refineTarget}`}
                  </div>
                  <button
                    onClick={() => setRefineTarget((prev) => (prev === 'ALL' ? '1' : 'ALL'))}
                    className="text-xs text-slate-500 underline hover:text-slate-700 whitespace-nowrap"
                  >
                    {refineTarget === 'ALL' ? '改為單題' : '切換全體'}
                  </button>
                </div>
                <input
                  type="text"
                  className="bg-white border border-indigo-200 text-gray-900 text-sm rounded-lg block w-full p-2.5"
                  placeholder="請輸入修改需求"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                />
              </div>
              <button
                onClick={handleRefineQuestion}
                disabled={isRefining}
                className={`text-white bg-indigo-600 hover:bg-indigo-700 font-medium rounded-lg text-sm px-5 py-2.5 ${
                  isRefining ? 'opacity-70 cursor-wait' : ''
                } whitespace-nowrap`}
              >
                {isRefining ? '優化中...' : '重新生成'}
              </button>
            </div>

            <AmiorGuideSection guide={guide} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
            <Search className="w-16 h-16 opacity-20" />
            <p>請先在上方輸入描述並點擊生成</p>
          </div>
        )}
      </div>

      {/* ── 截圖用 Modal ── */}
      {showScreenshotModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowScreenshotModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg">題目設計總覽 (截圖模式)</h3>
              <button onClick={() => setShowScreenshotModal(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 overflow-auto bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="p-3 font-bold text-slate-900 w-16">編號</th>
                    <th className="p-3 font-bold text-slate-900 w-1/4">功能情境</th>
                    <th className="p-3 font-bold text-slate-900">正向問句</th>
                    <th className="p-3 font-bold text-slate-900">反向問句</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedQuestions.map((q, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="p-3 font-bold text-slate-700">{q.id}</td>
                      <td className="p-3 text-slate-800 font-medium">{q.feature}</td>
                      <td className="p-3 text-slate-600">{q.positive}</td>
                      <td className="p-3 text-slate-600">{q.negative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanoQuestionGenerator;
