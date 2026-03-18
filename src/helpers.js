// ============================================================
// helpers.js — 工具函式、API 呼叫、資料處理
// ============================================================

// --- Gemini API 呼叫（含重試機制與錯誤捕捉）---
export const callGeminiAPI = async (payload, apiKey) => {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('請先輸入有效的 Gemini API Key。');
  }

  let delay = 1000;

  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || `狀態碼 ${response.status}`;

        // 4xx 客戶端錯誤：不重試，直接拋出
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`API 請求錯誤: ${errorMessage}`);
        }
        // 5xx 伺服器錯誤：進入重試流程
        throw new Error(`伺服器暫時無回應: ${errorMessage}`);
      }
    } catch (e) {
      if (e.message.includes('API 請求錯誤')) throw e;
      if (i === 4) throw e;
    }

    await new Promise((res) => setTimeout(res, delay));
    delay *= 2;
  }

  throw new Error('無法連線至 AI 伺服器，請確認網路狀態或稍後再試。');
};

// --- 標準化答案文字（相容多種填答語法）---
export const normalizeAnswer = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.includes('無法') || s.includes('不喜歡') || s.includes('討厭')) return '無法接受';
  if (s.includes('喜歡')) return '我非常喜歡';
  if (
    s.includes('期望') ||
    s.includes('理所當然') ||
    s.includes('應該') ||
    s.includes('當然')
  )
    return '我期望如此';
  if (s.includes('無所謂') || s.includes('沒差') || s.includes('無感')) return '無所謂';
  if (s.includes('接受') || s.includes('可以') || s.includes('忍受')) return '可以接受';
  return s;
};

// --- 從題目文字萃取簡潔功能名稱（功能名詞）---
export const extractFeatureName = (rawText) => {
  if (!rawText) return '未命名功能';
  let text = String(rawText).trim();

  // 1. 移除題號前綴，例如「Q1: 」、「1.」、「Q16_」
  text = text.replace(/^[Qq]?\d+[\.:_：]?\s*/, '');

  // 2. 逐步去除常見條件／問句前綴
  const stripPrefixes = [
    '如果', '若能', '假如', '當您', '當', '關於', '針對', '對於',
    '請問您對', '您覺得', '是否', '具備', '提供', '擁有', '包含',
    '設計', '系統能', '遊戲能', '希望能', '想要',
  ];
  let clean = text;
  let hasPrefix = true;
  while (hasPrefix) {
    hasPrefix = false;
    for (const p of stripPrefixes) {
      if (clean.startsWith(p)) {
        clean = clean.substring(p.length).trim();
        hasPrefix = true;
      }
    }
  }

  // 3. 移除常見問句結尾
  const stripSuffixes = [
    '，您的感受是？', '，您覺得如何？', '，您的看法是？', '的感受是？',
    '您覺得如何？', '您的感受？', '？', '?', '...', '。', '呢？', '好嗎？', '可以嗎？',
  ];
  for (const s of stripSuffixes) {
    if (clean.endsWith(s)) {
      clean = clean.substring(0, clean.length - s.length).trim();
    }
  }

  // 4. 以常見分隔符號截斷，只取前段名詞
  const separators = ['，', ',', '：', ':', '影響', '導致', '造成'];
  for (const sep of separators) {
    if (clean.includes(sep)) {
      clean = clean.split(sep)[0].trim();
    }
  }

  // 5. 最終清理括號
  clean = clean.replace(/[\(\)（）]/g, '');

  return clean;
};

// --- 將 File 轉為 Base64 字串（供 Gemini 多模態 API 使用）---
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// --- 依象限位置判斷 KANO 屬性分類 ---
export const getQuadrantCategory = (si, dsi, center = { x: -0.5, y: 0.5 }) => {
  if (si >= center.y && dsi >= center.x) return 'A';
  if (si >= center.y && dsi < center.x)  return 'O';
  if (si < center.y  && dsi >= center.x) return 'I';
  if (si < center.y  && dsi < center.x)  return 'M';
  return 'I';
};

// --- 依題目語境分析問題焦點，並給出具體情境化建議 ---
export const analyzeTextContext = (text) => {
  const t = (text || '').toLowerCase();
  const featureName = text
    ? text.replace(/^[Q\d\.:\s]+/, '').split(/[，,：:]/)[0].trim().substring(0, 15)
    : '此功能';

  const pick = (templates) => {
    let hash = 0;
    for (let i = 0; i < t.length; i++) hash = t.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % templates.length;
    return templates[index].replace(/\$\{name\}/g, featureName);
  };

  if (['字', '文字', '說明', '閱讀', '看不清', '太小', '模糊', '字體', '排版'].some((k) => t.includes(k))) {
    return {
      focus: '易讀性優化',
      solutions: pick([
        '目前「${name}」的字級設定可能低於 24pt，導致手機版閱讀困難。請直接調大字體並檢查對比度。',
        '背景與「${name}」的顏色過於接近。請在文字下方增加半透明黑色遮罩 (Alpha 0.6) 以提升辨識度。',
        '排版過於擁擠。請針對「${name}」增加行距 (Line Height) 至 1.25 倍，避免資訊糊在一起。',
      ]),
    };
  }

  if (['讀取', 'loading', '慢', '很久', '卡住', '轉圈', '下載', '熱更', '順暢', 'fps'].some((k) => t.includes(k))) {
    return {
      focus: '效能與讀取',
      solutions: pick([
        '請在執行「${name}」時加入動態進度條或趣味小語，降低玩家等待時的焦慮感。',
        '建議將「${name}」改為背景預載 (Preload)，避免玩家點擊當下才開始下載資源。',
        '檢查「${name}」是否在主線程執行了繁重運算。請改用 Coroutine 分幀處理，確保畫面不凍結。',
      ]),
    };
  }

  if (['抽', '機率', '運氣', '非酋', '保底', '卡池', 'ssr', 'ur', '掉落'].some((k) => t.includes(k))) {
    return {
      focus: '機率體驗',
      solutions: pick([
        '針對「${name}」加入「動態保底」機制：若前 N 次失敗，則第 N+1 次成功率大幅提升。',
        '請強化「${name}」成功時的視覺特效（如全螢幕閃光、震動），放大獲得稀有物品的爽感。',
        '建議直接在介面上顯示「${name}」的期望次數或機率，透明化資訊以管理玩家預期。',
      ]),
    };
  }

  if (['連線', '斷線', '伺服器', 'wifi', '4g', '網路', '延遲', 'ping'].some((k) => t.includes(k))) {
    return {
      focus: '連線穩定性',
      solutions: pick([
        '當「${name}」連線中斷時，請實作「靜默重連」機制，而非直接彈出錯誤視窗打斷體驗。',
        '針對弱網環境，請將「${name}」的封包資料進行壓縮，或優先傳送關鍵指令。',
        '請在「${name}」請求發出時立即鎖定按鈕狀態，防止玩家因延遲而重複點擊。',
      ]),
    };
  }

  if (['聲音', '音效', '音樂', 'bgm', '語音', '配音', '吵', '沒聲音'].some((k) => t.includes(k))) {
    return {
      focus: '聽覺回饋',
      solutions: pick([
        '「${name}」的音效可能與背景音樂頻率衝突。請使用 Side-chain 壓縮技術，在音效播放時自動壓低 BGM。',
        '操作成功時缺乏聽覺確認。請為「${name}」補上清脆、短促的正向回饋音效。',
        '請檢查 Audio Source 設定，確保「${name}」的優先級 (Priority) 設定正確，不會被環境音切斷。',
      ]),
    };
  }

  if (['金幣', '獎勵', '數量', '價格', '太貴', '不夠', '平衡', '數值', '太強', '太弱', '體力'].some((k) => t.includes(k))) {
    return {
      focus: '數值平衡',
      solutions: pick([
        '玩家反饋「${name}」門檻過高。請在前 20% 的遊戲進度中，下修消耗量或增加投放量。',
        '感受不到「${name}」的價值。建議增加首次獲得的額外加成，建立「買到賺到」的心理錨點。',
        '「${name}」的產出與消耗失衡。請檢查後期的回收機制 (Sink)，避免通貨膨脹。',
      ]),
    };
  }

  if (['按鈕', '找不到', '誤觸', '介面', 'UI', '顯示', '圖示', '位置', '顏色', '樣式', '版面'].some((k) => t.includes(k))) {
    return {
      focus: '介面設計',
      solutions: pick([
        "根據 Fitts's Law，請擴大「${name}」的點擊熱區 (Hitbox) 至少 1.5 倍，防止誤觸。",
        '「${name}」的層級過深不易被發現。建議將其拉至主介面，或增加紅點提示 (Red Dot)。',
        '請統一「${name}」的視覺語言（如顏色代表的意義），避免玩家產生認知混淆。',
      ]),
    };
  }

  if (['步驟', '麻煩', '繁瑣', '流程', '教學', '引導', '註冊', '登入', '操作'].some((k) => t.includes(k))) {
    return {
      focus: '操作流程',
      solutions: pick([
        '請針對「${name}」提供「一鍵完成」或「跳過動畫」的功能，目前步驟太繁瑣。',
        '請改用手指引導 (Hand Cursor) 直接帶領玩家執行一次「${name}」，避免文字引導。',
        '請檢視「${name}」的漏斗數據，在流失率最高的步驟加入激勵提示。',
      ]),
    };
  }

  return {
    focus: '功能體驗',
    solutions: `請重新檢視「${featureName}」的設計目標，嘗試 A/B Test 或增加更明確的說明文字。`,
  };
};

// --- 根據 KANO 屬性與情境文字，產出對應的策略建議 ---
export const getSuggestion = (item, CATEGORY_COLORS, SHORT_NAMES) => {
  if (item.execution_advice && item.modification_method) {
    return {
      stage: item.category === 'M' ? 1 : item.category === 'O' || item.category === 'A' ? 2 : 3,
      title: `針對「${item.feature || item.text}」的策略`,
      strategy: 'AI 專屬分析',
      desc: item.execution_advice,
      example: item.modification_method,
      displayTitle: item.text,
    };
  }

  const { category, dsi, si, text } = item;
  const cleanText = extractFeatureName(text);
  const context = analyzeTextContext(cleanText);

  let strategyTitle = '', strategy = '', advice = '';

  const makeAdvice = (urgencyText) => `${urgencyText}，${context.solutions}`;

  if (category === 'M') {
    strategyTitle = `⛔ 核心阻礙 (${context.focus})`;
    strategy = '最高優先級修復';
    advice = makeAdvice(`這是基本門檻 (DSI: ${dsi.toFixed(2)})，做不好玩家會直接流失`);
  } else if (category === 'O') {
    strategyTitle = `⚔️ 主要戰場 (${context.focus})`;
    strategy = '規格對標競品';
    advice = makeAdvice(`這是提升滿意度的關鍵 (SI: ${si.toFixed(2)})，必須做得比競品更好`);
  } else if (category === 'A') {
    strategyTitle = `✨ 產品賣點 (${context.focus})`;
    strategy = '行銷資源放大';
    advice = makeAdvice(`這是意料之外的驚喜 (SI: ${si.toFixed(2)})，值得投入行銷資源包裝`);
  } else if (category === 'I') {
    strategyTitle = `📉 資源黑洞 (${context.focus})`;
    strategy = '暫停開發投入';
    advice = makeAdvice(`玩家對此無感，建議暫停開發投入，僅維持最低運作標準`);
  } else if (category === 'R') {
    strategyTitle = `⚠️ 反向干擾 (${context.focus})`;
    strategy = '移除或提供開關';
    advice = makeAdvice(`此設計造成負面體驗 (DSI: ${dsi.toFixed(2)})，請考慮移除或提供關閉選項`);
  } else {
    strategyTitle = `❓ 需進一步釐清`;
    strategy = '質化訪談';
    advice = makeAdvice(`數據分佈不明確，建議直接訪談用戶了解真實想法`);
  }

  return {
    stage: category === 'M' ? 1 : category === 'O' || category === 'A' ? 2 : 3,
    title: strategyTitle,
    strategy,
    desc: advice,
    example: context.solutions,
    displayTitle: item.text,
  };
};

// --- 載入外部 JS 套件（XLSX、html2canvas、docx）---
export const useExternalScripts = (useState, useEffect) => {
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

    loadScript(
      'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
      'XLSX',
      'xlsx'
    );
    loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'html2canvas',
      'html2canvas'
    );
    loadScript('https://unpkg.com/docx@7.8.2/build/index.js', 'docx', 'docx');
  }, []);

  return loaded;
};
