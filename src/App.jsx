// ============================================================
// App.jsx — 主應用程式元件
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings, Upload, Database, FileText, Info, Edit, Wand,
} from 'lucide-react';
import {
  SYSTEM_PROMPT_V12, CATEGORY_COLORS, SHORT_NAMES,
  CATEGORY_NAMES, DEFAULT_GUIDE, DEMO_DATA, INITIAL_GENERATOR_QUESTIONS,
} from './constants';
import {
  normalizeAnswer, getQuadrantCategory, getSuggestion,
  analyzeTextContext, extractFeatureName,
} from './helpers';
import {
  NotificationToast, SharedKanoChart, StageSection,
  SuggestionCard, QuestionStatsTable, AmiorGuideSection,
} from './components';
import KanoQuestionGenerator from './KanoQuestionGenerator';
import SurveyPreview from './SurveyPreview';

// ─── 外部套件動態載入 ────────────────────────────────────────
const useExternalScripts = () => {
  const [loaded, setLoaded] = useState({ xlsx: false, html2canvas: false, docx: false });

  useEffect(() => {
    const loadScript = (src, globalKey, stateKey) => {
      if (!window[globalKey]) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => setLoaded((prev) => ({ ...prev, [stateKey]: true }));
        document.body.appendChild(script);
      } else {
        setLoaded((prev) => ({ ...prev, [stateKey]: true }));
      }
    };
    loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js', 'XLSX', 'xlsx');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas', 'html2canvas');
    loadScript('https://unpkg.com/docx@7.8.2/build/index.js', 'docx', 'docx');
  }, []);

  return loaded;
};

const App = ({ data: initialData, setData: initialSetData, initialViewMode = 'generator' }) => {
  const loaded = useExternalScripts();

  // ── 資料狀態 ──────────────────────────────────────────────
  const [data, setData] = useState(() => {
    const defaultData = {
      meta: { totalRespondents: 0, expectedQuestions: 0, analysisDate: new Date().toISOString().split('T')[0] },
      items: [],
    };
    if (initialData && initialData.items) {
      return { ...defaultData, ...initialData, meta: { ...defaultData.meta, ...(initialData.meta || {}) } };
    }
    return defaultData;
  });

  const [viewMode, setViewMode] = useState(initialViewMode);
  const [sortMode, setSortMode] = useState('id');
  const [notification, setNotification] = useState(null);

  // 從 localStorage 讀取 API Key
  const [generatorState, setGeneratorState] = useState(() => {
    let storedKey = '';
    try { storedKey = localStorage.getItem('gemini_api_key') || ''; } catch {}
    return {
      apiKey: storedKey,
      files: [],
      description: '',
      prompt: SYSTEM_PROMPT_V12,
      generatedQuestions: INITIAL_GENERATOR_QUESTIONS,
      generatedGuide: null,
    };
  });

  // 報告相關狀態
  const [reportTitle, setReportTitle]         = useState('');
  const [projectName, setProjectName]         = useState('');
  const [author, setAuthor]                   = useState('');
  const [reportDate, setReportDate]           = useState(new Date().toISOString().split('T')[0]);
  const [summaryHighlights, setSummaryHighlights] = useState('');
  const [analysisReason, setAnalysisReason]   = useState('');
  const [improvementItems, setImprovementItems] = useState([]);

  const fileInputRef     = useRef(null);
  const reportRef        = useRef(null);
  const dashboardChartRef = useRef(null);

  const chartCenter = { x: -0.5, y: 0.5 };
  const guide = generatorState.generatedGuide || DEFAULT_GUIDE;

  const showNotification = (msg, type = 'info') => setNotification({ message: msg, type });

  useEffect(() => { setViewMode(initialViewMode); }, [initialViewMode]);
  useEffect(() => { if (data && data.items && data.items.length > 0) generateAutoContent(data); }, [data]);

  // ── 載入範例數據 ────────────────────────────────────────
  const loadDemoData = () => { setData(DEMO_DATA); showNotification('範例數據載入成功！', 'success'); };

  // ── 自動生成報告摘要文字 ─────────────────────────────────
  const generateAutoContent = (currentData) => {
    if (!currentData.items || currentData.items.length === 0) return;
    const items = currentData.items;
    const totalQ = items.length;
    const count = { A: 0, O: 0, M: 0, I: 0, R: 0, Q: 0 };
    items.forEach((i) => { if (count[i.category] !== undefined) count[i.category]++; });
    const pct = (n) => (totalQ === 0 ? '0%' : `${Math.round((n / totalQ) * 100)}%`);

    const allSortedItems = [...items].sort((a, b) => {
      const priority = { M: 1, O: 2, A: 2, I: 3, R: 3, Q: 4 };
      const diff = (priority[a.category] || 9) - (priority[b.category] || 9);
      if (diff !== 0) return diff;
      return Math.abs(b.dsi) - Math.abs(a.dsi);
    });

    const maxCat = Object.keys(count).reduce((a, b) => (count[a] > count[b] ? a : b));
    const summaryLines = [];
    summaryLines.push(
      `1）分佈總覽：\n  本次分析共 ${totalQ} 題，以「${CATEGORY_NAMES[maxCat].split(' ')[0]}」佔比最高 (${count[maxCat]}題, ${pct(count[maxCat])})。`
    );
    const mList = items.filter((i) => i.category === 'M').map((i) => i.id).join('、');
    const oList = items.filter((i) => i.category === 'O').map((i) => i.id).join('、');
    const aList = items.filter((i) => i.category === 'A').map((i) => i.id).join('、');
    summaryLines.push(
      `2）關鍵屬性：\n  ・基本(M)：${mList || '無'} (避免不滿的底線)\n  ・期望(O)：${oList || '無'} (提升滿意度的主力)\n  ・魅力(A)：${aList || '無'} (差異化亮點)`
    );
    if (count.M > 0)
      summaryLines.push(`3）優先行動：\n  基本需求(M)存在缺口，需最優先修復以止血，接著再優化期望需求(O)。`);
    else if (count.O > 0)
      summaryLines.push(`3）優先行動：\n  基礎功能穩固，建議集中資源在期望需求(O)的體驗優化。`);
    else
      summaryLines.push(`3）優先行動：\n  目前分佈較為平均，建議依照產品策略決定發展方向。`);

    setSummaryHighlights(summaryLines.join('\n\n'));

    let reason = '';
    if (count.M > totalQ * 0.3)
      reason += `1. 基礎建設期：\n超過 30% 為基本需求(M)，產品仍處於「補足基礎」階段，玩家對於基礎功能的完整性非常在意。\n\n`;
    else if (count.A > totalQ * 0.3)
      reason += `1. 創新紅利期：\n大量魅力需求(A)，顯示本次測試的功能帶給玩家許多驚喜，具有很好的行銷潛力。\n\n`;
    else
      reason += `1. 體驗優化期：\n分佈均衡或以期望需求(O)為主，戰場在於「做得比競品更好」，細節打磨是關鍵。\n\n`;

    setAnalysisReason(reason);
    setImprovementItems(allSortedItems);
  };

  // ── 優化建議分組（依階段 + 題目）───────────────────────────
  const groupedImprovementItems = useMemo(() =>
    improvementItems
      .map((item) => {
        const suggestion = getSuggestion(item, CATEGORY_COLORS, SHORT_NAMES);
        return {
          stage: suggestion.stage,
          title: suggestion.title,
          strategy: suggestion.strategy,
          desc: suggestion.desc,
          example: suggestion.example,
          displayTitle: suggestion.displayTitle,
          idList: [item.id],
          items: [item],
          category: item.category,
        };
      })
      .sort((a, b) => (a.stage !== b.stage ? a.stage - b.stage : 0)),
  [improvementItems]);

  const activeStages = useMemo(
    () => [1, 2, 3].filter((stage) => groupedImprovementItems.some((g) => g.stage === stage)),
    [groupedImprovementItems]
  );

  // ── Excel 上傳解析 ─────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!loaded.xlsx) { showNotification('系統元件 (XLSX) 正在載入中，請稍後再試...', 'error'); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt?.target?.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const wsDataArray = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!wsDataArray || wsDataArray.length < 2) { showNotification('Excel 無有效數據 (Rows < 2)', 'error'); return; }

        const headers  = wsDataArray[0];
        const dataRows = wsDataArray.slice(1);
        const START_COL_INDEX = 6;
        const processedItems = [];
        let validQuestionCount = 0;

        const generatedList = generatorState.generatedQuestions || [];
        const currentGuide  = generatorState.generatedGuide || DEFAULT_GUIDE;
        const guideLookup   = { positive: {}, negative: {} };
        const getCatCode    = (str) => (str || '').split(' ')[0].trim().toUpperCase();

        currentGuide.positive_analysis?.forEach((item) => {
          guideLookup.positive[normalizeAnswer(item.response)] = getCatCode(item.category);
        });
        currentGuide.negative_analysis?.forEach((item) => {
          guideLookup.negative[normalizeAnswer(item.response)] = getCatCode(item.category);
        });

        for (let i = START_COL_INDEX; i < headers.length; i++) {
          const header = headers[i]; if (!header) continue;
          const isNeg = validQuestionCount % 2 !== 0;
          let counts = { A: 0, M: 0, O: 0, I: 0, R: 0, Q: 0 };
          let rawCounts = {};

          dataRows.forEach((row) => {
            const ans = normalizeAnswer((row[i] || '').toString());
            rawCounts[ans] = (rawCounts[ans] || 0) + 1;
            const targetLookup = !isNeg ? guideLookup.positive : guideLookup.negative;
            const mappedCategory = targetLookup[ans];
            if (mappedCategory && counts[mappedCategory] !== undefined) counts[mappedCategory]++;
          });

          const validTotal = counts.A + counts.O + counts.M + counts.I + counts.R;
          const safeTotal  = validTotal === 0 ? 1 : validTotal;
          const si  = parseFloat(((counts.A + counts.O) / safeTotal).toFixed(3));
          const dsi = parseFloat(((counts.O + counts.M) / safeTotal * -1).toFixed(3));

          const calculatedCategory = getQuadrantCategory(si, dsi, chartCenter);

          // 嘗試對應到 AI 生成的題目
          const featureMatch = generatedList.find((q) => header.includes(q.feature));
          const linkedQuestion = featureMatch || generatedList[validQuestionCount] || null;
          const designCategory = linkedQuestion?.amior || null;

          processedItems.push({
            id: `Q${validQuestionCount + 1}`,
            text: header,
            isPos: !isNeg,
            displayId: `Q${validQuestionCount + 1}`,
            si, dsi,
            category: calculatedCategory,
            designCategory,
            actualCategory: calculatedCategory,
            stats: counts,
            answerCounts: rawCounts,
            execution_advice:    linkedQuestion ? linkedQuestion.execution_advice    : null,
            modification_method: linkedQuestion ? linkedQuestion.modification_method : null,
            feature:             linkedQuestion ? linkedQuestion.feature              : null,
          });
          validQuestionCount++;
        }

        setData({
          meta: { totalRespondents: dataRows.length, expectedQuestions: processedItems.length, analysisDate: new Date().toISOString().split('T')[0] },
          items: processedItems,
        });
        showNotification(`解析完成！(獨立題目模式) 共處理 ${processedItems.length} 個題目`, 'success');
      } catch (err) {
        console.error(err);
        showNotification('解析失敗：' + err.message, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // ── 散佈圖資料（含 Force Simulation 避免標籤重疊）──────────
  const chartData = useMemo(() => {
    if (data.items.length === 0) return [];

    const groupedMap = new Map();
    data.items.forEach((item) => {
      const key = `${item.dsi.toFixed(4)}_${item.si.toFixed(4)}`;
      if (!groupedMap.has(key)) groupedMap.set(key, []);
      groupedMap.get(key).push(item);
    });

    const simulationNodes = Array.from(groupedMap.values()).map((items) => {
      const firstItem = items[0];
      const sortedItems = [...items].sort((a, b) => {
        const idA = parseInt(String(a.displayId).replace(/\D/g, '')) || 0;
        const idB = parseInt(String(b.displayId).replace(/\D/g, '')) || 0;
        return idA - idB;
      });
      const label = sortedItems.map((i) => i.displayId).join('、');
      return {
        ...firstItem, id: label, originalItems: sortedItems,
        x: firstItem.dsi, y: firstItem.si,
        ax: firstItem.dsi, ay: firstItem.si,
        lx: firstItem.dsi, ly: firstItem.si,
        vx: 0, vy: 0,
      };
    });

    // 簡易 Force Simulation（避免標籤重疊）
    const ITERATIONS = simulationNodes.length > 50 ? 40 : 120;
    const REPULSION = 0.005, ANCHOR_STRENGTH = 0.05;
    const DOT_REPULSION = 0.02, COLLISION_RADIUS = 0.08, DOT_SAFE_RADIUS = 0.05;
    const anchors = simulationNodes.map((n) => ({ x: n.ax, y: n.ay }));

    for (let i = 0; i < ITERATIONS; i++) {
      simulationNodes.forEach((node) => {
        let fx = (node.ax - node.lx) * ANCHOR_STRENGTH;
        let fy = (node.ay - node.ly) * ANCHOR_STRENGTH;

        simulationNodes.forEach((other) => {
          if (node === other) return;
          const dx = node.lx - other.lx, dy = node.ly - other.ly;
          const distSq = dx * dx + dy * dy;
          if (distSq < COLLISION_RADIUS * COLLISION_RADIUS && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (COLLISION_RADIUS - dist) / dist * REPULSION;
            fx += dx * force; fy += dy * force;
          }
        });

        anchors.forEach((anchor) => {
          const dx = node.lx - anchor.x, dy = node.ly - anchor.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < DOT_SAFE_RADIUS * DOT_SAFE_RADIUS && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (DOT_SAFE_RADIUS - dist) / dist * DOT_REPULSION;
            fx += dx * force; fy += dy * force;
          }
        });

        const margin = 0.02;
        if (node.lx < -1 + margin) fx += 0.01;
        if (node.lx > 0 - margin)  fx -= 0.01;
        if (node.ly < 0 + margin)  fy += 0.01;
        if (node.ly > 1 - margin)  fy -= 0.01;

        node.vx = (node.vx + fx) * 0.9;
        node.vy = (node.vy + fy) * 0.9;
        node.lx += node.vx;
        node.ly += node.vy;
      });
    }

    return simulationNodes.map((node) => ({ ...node, labelX: node.lx, labelY: node.ly }));
  }, [data.items]);

  // ── 排序後的題目列表 ─────────────────────────────────────
  const sortedListItems = useMemo(() => {
    let sorted = [...data.items];
    if (sortMode === 'id') {
      sorted.sort((a, b) => (parseInt(a.id.replace(/\D/g, '')) || 0) - (parseInt(b.id.replace(/\D/g, '')) || 0));
    } else {
      const order = { A: 1, O: 2, M: 3, I: 4, R: 5, Q: 6 };
      sorted.sort((a, b) => (order[a.category] || 99) - (order[b.category] || 99));
    }
    return sorted;
  }, [data.items, sortMode]);

  const dashboardFlatItems = useMemo(() =>
    sortedListItems.map((item) => ({
      ...item,
      displayId: item.displayId,
      text: item.text,
      category: item.category,
      si: item.si,
      dsi: item.dsi,
      isPos: item.isPos,
      uniqueKey: item.id,
      stats: item.stats,
      answerCounts: item.answerCounts,
    })),
  [sortedListItems]);

  // ── 匯出 HTML 報告 ───────────────────────────────────────
  const handleExportHTML = async () => {
    if (!data.items.length) { showNotification('無數據可匯出', 'error'); return; }
    if (viewMode !== 'report') {
      showNotification('請先切換至「報告預覽」分頁後再執行匯出', 'warning');
      setViewMode('report');
      return;
    }
    if (!reportRef.current) { showNotification('找不到報告元件', 'error'); return; }

    showNotification('正在產生 HTML 報告...', 'info');

    try {
      const chartElement = reportRef.current.querySelector('.kano-chart-visual');
      let chartImageBase64 = '';
      if (chartElement) {
        const canvas = await window.html2canvas(chartElement, {
          scale: 4, useCORS: true, logging: false, backgroundColor: '#ffffff',
        });
        chartImageBase64 = canvas.toDataURL('image/png');
      }

      const catRank = { A: 3, O: 2, M: 1, I: 4, R: 5, Q: 6 };

      const itemsHTML = sortedListItems.map((item) => `
        <div class="question-card"
          data-id="${parseInt(item.displayId.replace(/\D/g, '')) || 0}"
          data-category-rank="${catRank[item.category] || 99}"
          style="display:flex;align-items:flex-start;gap:12px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #f1f5f9;margin-bottom:8px;page-break-inside:avoid;">
          <div style="flex-shrink:0;">
            <span style="background:#e2e8f0;color:#334155;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:bold;">
              ${item.displayId}
            </span>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="margin-bottom:4px;">
              <span style="background:${CATEGORY_COLORS[item.category]};color:white;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:bold;">
                ${SHORT_NAMES[item.category]}
              </span>
            </div>
            <p style="font-size:14px;color:#334155;font-weight:500;margin:0;word-break:break-word;">${item.text}</p>
          </div>
        </div>
      `).join('');

      const stagesHTML = [1, 2, 3]
        .filter((stage) => groupedImprovementItems.some((g) => g.stage === stage))
        .map((stage) => {
          const configs = {
            1: { title: '搞定基礎體驗', sub: '針對基本品質 (M)', icon: '🛡️', border: '#fecaca', bg: '#fef2f2', badgeBg: '#fecaca', badgeText: '#991b1b', label: '第一階段' },
            2: { title: '創造亮點與爽感', sub: '針對期望/魅力 (O & A)', icon: '🚀', border: '#fde68a', bg: '#fffbeb', badgeBg: '#fde68a', badgeText: '#92400e', label: '第二階段' },
            3: { title: '避免無效開發', sub: '針對無差異 (I)', icon: '✂️', border: '#a7f3d0', bg: '#ecfdf5', badgeBg: '#a7f3d0', badgeText: '#065f46', label: '第三階段' },
          };
          const c = configs[stage];
          const cardsHTML = groupedImprovementItems
            .filter((g) => g.stage === stage)
            .map((g) => {
              const item = g.items[0];
              return `<div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:24px;margin-bottom:16px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="background:#1e293b;color:white;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;">${item.id}</span>
                  <span style="background:${CATEGORY_COLORS[item.category]};color:white;padding:2px 6px;border-radius:4px;font-size:12px;">${SHORT_NAMES[item.category]}</span>
                </div>
                <h3 style="font-size:16px;font-weight:bold;color:#1e293b;margin:0;">${item.text}</h3>
              </div>`;
            }).join('');
          return `
            <div style="border:2px solid ${c.border};border-radius:12px;overflow:hidden;background:white;margin-bottom:40px;">
              <div style="background:${c.bg};padding:24px;position:relative;border-bottom:2px solid ${c.border};">
                <div style="position:absolute;right:24px;top:24px;font-size:24px;">${c.icon}</div>
                <div style="display:inline-block;padding:4px 12px;background:${c.badgeBg};color:${c.badgeText};border-radius:9999px;font-size:12px;font-weight:bold;margin-bottom:8px;">${c.label}</div>
                <h2 style="font-size:24px;font-weight:bold;color:#1e293b;margin:4px 0;">${c.title}</h2>
                <p style="font-size:14px;color:#64748b;margin:0;">${c.sub}</p>
              </div>
              <div style="padding:24px;">${cardsHTML}</div>
            </div>`;
        }).join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 40px; background: #f8fafc; }
    .container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
    h1 { color: #1e293b; font-size: 32px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 16px; }
    h2 { color: #1e293b; font-size: 24px; border-left: 4px solid #10b981; padding-left: 12px; margin-top: 40px; margin-bottom: 24px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px; color: #64748b; margin-bottom: 40px; }
    .chart-img { max-width: 100%; height: auto; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 40px; }
    .grid-col { padding: 24px; font-size: 14px; white-space: pre-wrap; }
    #question-list { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sort-btn { padding: 6px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; cursor: pointer; color: #475569; font-weight: bold; }
    @media (max-width: 768px) { .meta, .grid-2, #question-list { grid-template-columns: 1fr !important; } }
  </style>
  <script>
    function sortQuestions(mode) {
      const container = document.getElementById('question-list');
      const items = Array.from(container.children);
      items.sort((a, b) => {
        if (mode === 'id') return parseInt(a.dataset.id) - parseInt(b.dataset.id);
        const rankA = parseInt(a.dataset.categoryRank);
        const rankB = parseInt(b.dataset.categoryRank);
        return rankA !== rankB ? rankA - rankB : parseInt(a.dataset.id) - parseInt(b.dataset.id);
      });
      items.forEach(item => container.appendChild(item));
    }
  </script>
</head>
<body>
  <div class="container">
    <h1>${reportTitle}</h1>
    <div class="meta">
      <p><strong>專案：</strong> ${projectName}</p>
      <p><strong>製作人：</strong> ${author}</p>
      <p><strong>日期：</strong> ${reportDate}</p>
      <p><strong>樣本數：</strong> ${data.meta.totalRespondents}</p>
    </div>

    <h2>一、Kano 屬性分佈圖</h2>
    <div style="background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;margin-bottom:40px;">
      ${chartImageBase64 ? `<img src="${chartImageBase64}" class="chart-img" />` : '<p>(圖表匯出失敗)</p>'}
    </div>

    <div style="text-align:right;margin-bottom:12px;display:flex;gap:8px;justify-content:flex-end;">
      <button class="sort-btn" onclick="sortQuestions('id')">依照題號排序</button>
      <button class="sort-btn" onclick="sortQuestions('category')">依照屬性排序</button>
    </div>
    <div id="question-list">${itemsHTML}</div>

    <h2 style="margin-top:60px;">二、總結與分析</h2>
    <div class="grid-2">
      <div class="grid-col" style="background:#eef2ff;border-right:1px solid #e2e8f0;">
        <strong>📊 總結重點</strong><br/><br/>${summaryHighlights || '尚無數據可分析。'}
      </div>
      <div class="grid-col" style="background:white;">
        <strong>🧐 分析原因</strong><br/><br/>${analysisReason || '尚無數據可分析。'}
      </div>
    </div>

    <h2>三、優化教戰守則</h2>
    ${stagesHTML || '<p style="color:#94a3b8;font-style:italic;">目前數據不足以生成優化建議。</p>'}

    <div style="margin-top:60px;text-align:center;color:#cbd5e1;font-size:12px;border-top:1px solid #f1f5f9;padding-top:20px;">
      工具製作人：李敏瑞
    </div>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `Report_Kano_${reportDate}.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      showNotification('HTML 匯出成功！', 'success');
    } catch (e) {
      console.error('Export failed', e);
      showNotification('匯出失敗：' + e.message, 'error');
    }
  };

  // ════════════════════════════════════════════════════════
  // 渲染
  // ════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-900 relative">
      {notification && (
        <NotificationToast
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* 頂部導覽列 */}
      {initialViewMode !== 'report' && (
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <div className="flex gap-4">
            {[
              { key: 'generator', label: '題目產生器', icon: <Wand className="w-4 h-4" />, color: 'indigo' },
              { key: 'dashboard', label: '圖表看板',   icon: null,                          color: 'blue'   },
              { key: 'survey',   label: '問卷填寫預覽', icon: <Edit className="w-4 h-4" />,  color: 'indigo' },
              { key: 'report',   label: '報告預覽',    icon: null,                          color: 'blue'   },
              { key: 'data',     label: 'API 數據',    icon: null,                          color: 'blue'   },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${
                  viewMode === key ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          {viewMode === 'report' && (
            <button
              onClick={handleExportHTML}
              disabled={!loaded.html2canvas}
              className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition shadow-sm ml-auto ${
                !loaded.html2canvas ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FileText className="w-4 h-4" />
              {!loaded.html2canvas ? '載入元件中...' : '匯出 HTML'}
            </button>
          )}
        </div>
      )}

      {/* 主內容區 */}
      <div className="flex-1 overflow-auto p-6 scroll-smooth">

        {/* 題目產生器 */}
        {viewMode === 'generator' && (
          <KanoQuestionGenerator
            showNotification={showNotification}
            generatorState={generatorState}
            setGeneratorState={setGeneratorState}
          />
        )}

        {/* 問卷填寫預覽 */}
        {viewMode === 'survey' && <SurveyPreview data={data} guide={guide} />}

        {/* 圖表看板 */}
        {viewMode === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側：數據上傳 + 設定 */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-500" /> 數據來源
                </h3>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition relative">
                  <input
                    type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">更新數據 (上傳 Excel)</p>
                  <p className="text-xs text-slate-400 mt-2">支援直接上傳 Sheet1 原始問卷檔</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> 報告設定
                </h3>
                <div className="space-y-4">
                  {[
                    { label: '報告名稱', value: reportTitle, set: setReportTitle },
                    { label: '專案名稱', value: projectName, set: setProjectName },
                    { label: '製作人',   value: author,      set: setAuthor      },
                  ].map(({ label, value, set }) => (
                    <div key={label}>
                      <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
                      <input
                        type="text" value={value}
                        onChange={(e) => set(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">日期</label>
                    <input
                      type="date" value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="text-xs text-slate-500 font-bold">總樣本</div>
                    <div className="text-2xl font-bold">{data.meta.totalRespondents}</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="text-xs text-slate-500 font-bold">題數</div>
                    <div className="text-2xl font-bold">{data.items.length}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：圖表 + 題目列表 */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-4">Kano 模型分佈圖</h2>
                <div className="h-[500px] w-full" ref={dashboardChartRef}>
                  <SharedKanoChart height={500} chartData={chartData} />
                </div>
                <div className="mt-6 border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="font-bold text-sm flex gap-2">
                      <Info className="w-4 h-4" /> 題目詳細數據與對照
                    </h3>
                    <select
                      value={sortMode} onChange={(e) => setSortMode(e.target.value)}
                      className="text-xs border rounded p-1 bg-slate-50"
                    >
                      <option value="id">依照題號</option>
                      <option value="category">依照屬性</option>
                    </select>
                  </div>
                  <QuestionStatsTable items={dashboardFlatItems} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 報告預覽 */}
        {viewMode === 'report' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-12 shadow-lg min-h-screen" ref={reportRef}>
              {/* 報告標題區 */}
              <div className="border-b-2 border-indigo-600 pb-6 mb-12">
                <h1 className="text-4xl font-bold text-slate-900 mb-4">{reportTitle}</h1>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                  <p><strong>專案：</strong> {projectName}</p>
                  <p><strong>製作人：</strong> {author}</p>
                  <p><strong>日期：</strong> {reportDate}</p>
                  <p><strong>樣本數：</strong> {data.meta?.totalRespondents || 0}</p>
                </div>
              </div>

              {/* 一、Kano 分佈圖 */}
              <div className="mb-16">
                <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-emerald-500 pl-4 mb-8 mt-12">
                  一、Kano 屬性分佈圖
                </h2>
                <div className="h-[500px] w-full border border-slate-200 rounded-lg p-4">
                  <SharedKanoChart height={460} chartData={chartData} />
                </div>
              </div>

              {/* 二、總結與分析 */}
              <div className="mb-16">
                <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-emerald-500 pl-4 mb-8 mt-12">
                  二、總結與分析
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-6 bg-indigo-50 border-b md:border-b-0 md:border-r border-slate-200">
                    <h3 className="font-bold text-indigo-900 mb-3">📊 總結重點</h3>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                      {summaryHighlights || '尚無數據可分析。'}
                    </p>
                  </div>
                  <div className="p-6 bg-white">
                    <h3 className="font-bold text-indigo-900 mb-3">🧐 分析原因</h3>
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                      {analysisReason || '尚無數據可分析。'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 三、優化教戰守則 */}
              <div className="mb-16">
                <h2 className="text-2xl font-bold text-slate-800 border-l-4 border-emerald-500 pl-4 mb-8 mt-12">
                  三、優化教戰守則
                </h2>
                <div className="space-y-8">
                  {activeStages.length > 0 ? (
                    activeStages.map((stage) => (
                      <StageSection key={stage} stage={stage}>
                        {groupedImprovementItems
                          .filter((g) => g.stage === stage)
                          .map((g, idx) => (
                            <SuggestionCard key={`s${stage}-${idx}`} group={g} stage={stage} />
                          ))}
                      </StageSection>
                    ))
                  ) : (
                    <p className="text-slate-400 italic pl-4">
                      目前數據不足以生成優化建議，請檢查資料分類。
                    </p>
                  )}
                </div>
              </div>

              <div className="text-center text-slate-400 text-sm border-t border-slate-100 pt-8">
                工具製作人：李敏瑞
              </div>
            </div>
          </div>
        )}

        {/* API 數據 (JSON 檢視) */}
        {viewMode === 'data' && (
          <div className="h-full bg-white rounded-2xl shadow p-4 flex flex-col">
            <div className="flex justify-between mb-4">
              <span className="font-bold">API JSON 資料</span>
            </div>
            <textarea
              className="flex-1 bg-slate-900 text-green-400 font-mono p-4 rounded resize-none"
              value={JSON.stringify(data, null, 2)}
              readOnly
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
