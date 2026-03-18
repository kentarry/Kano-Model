// ============================================================
// constants.js — 所有常數、設定資料、預設值
// ============================================================

export const SYSTEM_PROMPT_V12 = `# Role Definition
你是一位講話直白、重視落地執行的資深產品經理 (PM)。你討厭空泛的理論，擅長給出「明天就能執行」的具體建議。

# 核心任務
使用者將提供產品描述。請完成：
1. **題目設計**：產出 10 組 Kano 問卷題目。
2. **策略顧問**：針對每一題，根據其功能特性，預先撰寫「執行建議」與「修改方式」。
3. **判讀指南**：根據生成的 10 組題目，撰寫「專屬情境 AMIOR 判讀指南」。⚠️ 禁止使用通用定義，必須結合題目情境。
   **重要規則**：AMIOR 屬性判斷必須**單一且明確** (例如 "A 魅力品質")，**絕對禁止**出現 "A/O" 或 "M/R" 這類模糊寫法。

# 寫作風格 (Style Guide)
1. **白話文**：像同事在討論一樣，不要用教科書語氣。
2. **拒絕廢話**：不要說「這很重要所以要優化」，要說「把讀取時間壓在 2 秒內，不然玩家會直接關掉」。
3. **情境化**：
   - ❌ 錯誤：建議提升使用者體驗，增加滿意度。
   - ✅ 正確：針對「登入驗證碼」，建議增加「一鍵貼上」功能，減少輸入錯誤帶來的暴躁感。
4. **具體行動**：
   - ❌ 錯誤：優化介面設計。
   - ✅ 正確：將確認按鈕加大 20% 並改為顯眼的橘色 (#FF5722)，以防手指粗的使用者誤觸取消。

# Output JSON Structure (Strict)
請務必只回傳以下 JSON 格式，不要包含 Markdown 語法或任何其他文字：
{
  "questions": [
    {
      "id": 1,
      "feature": "功能簡述",
      "amior": "預測屬性 (A/O/M/I/R)",
      "categoryName": "屬性名稱",
      "reason": "屬性判斷理由...",
      "positive": "正向問句...",
      "negative": "反向問句...",
      "execution_advice": "【針對該功能的白話建議】(必須完全依照該題目的功能情境，提出具體的優化策略，禁止給出通用建議。例如：這功能是標配，沒做好會被罵翻，請列為 P0 修復)",
      "modification_method": "【具體執行步驟】\\n1. 第一步做什麼\\n2. 第二步做什麼 (請具體提到技術或設計細節)"
    }
  ],
  "guide": {
    "positive_analysis": [
       { "response": "我非常喜歡", "category": "A 魅力品質", "reason": "..." },
       { "response": "我期望如此", "category": "O 期望品質", "reason": "..." },
       { "response": "無所謂", "category": "I 無感品質", "reason": "..." },
       { "response": "可以接受", "category": "M 基本品質", "reason": "..." },
       { "response": "無法接受", "category": "R 反向品質", "reason": "..." }
    ],
    "negative_analysis": [
       { "response": "我非常喜歡", "category": "R 反向品質", "reason": "..." },
       { "response": "我期望如此", "category": "R 反向品質", "reason": "..." },
       { "response": "無所謂", "category": "A 魅力品質", "reason": "..." },
       { "response": "可以接受", "category": "O 期望品質", "reason": "..." },
       { "response": "無法接受", "category": "M 基本品質", "reason": "..." }
    ]
  }
}`;

export const KANO_MATRIX = {
  '我非常喜歡': { '我非常喜歡': 'Q', '我期望如此': 'A', '無所謂': 'A', '可以接受': 'A', '無法接受': 'O' },
  '我期望如此': { '我非常喜歡': 'R', '我期望如此': 'I', '無所謂': 'I', '可以接受': 'I', '無法接受': 'M' },
  '無所謂':     { '我非常喜歡': 'R', '我期望如此': 'I', '無所謂': 'I', '可以接受': 'I', '無法接受': 'M' },
  '可以接受':   { '我非常喜歡': 'R', '我期望如此': 'I', '無所謂': 'I', '可以接受': 'I', '無法接受': 'M' },
  '無法接受':   { '我非常喜歡': 'R', '我期望如此': 'R', '無所謂': 'R', '可以接受': 'R', '無法接受': 'Q' },
};

export const CATEGORY_COLORS = {
  A: '#3B82F6',
  O: '#F97316',
  M: '#EF4444',
  I: '#64748B',
  R: '#10B981',
  Q: '#8B5CF6',
};

export const LINE_COLORS = {
  A: '#93C5FD',
  O: '#FDBA74',
  M: '#FCA5A5',
  I: '#94A3B8',
  R: '#86EFAC',
};

export const CATEGORY_NAMES = {
  A: '魅力屬性 (Attractive)',
  O: '期望屬性 (One-dimensional)',
  M: '基本屬性 (Must-be)',
  I: '無差異屬性 (Indifferent)',
  R: '反向屬性 (Reverse)',
  Q: '疑問結果 (Questionable)',
};

export const SHORT_NAMES = {
  A: '魅力 (A)',
  O: '期望 (O)',
  M: '基本 (M)',
  I: '無差異 (I)',
  R: '反向 (R)',
  Q: '疑問 (Q)',
};

export const INITIAL_GENERATOR_QUESTIONS = [];

export const DEFAULT_GUIDE = {
  positive_analysis: [
    { response: '我非常喜歡', category: 'A 魅力品質', reason: '理由：超越預期，創造愉悅與驚喜。' },
    { response: '我期望如此', category: 'O 期望品質', reason: '理由：好的產品理應具備，多多益善。' },
    { response: '無所謂',     category: 'I 無感品質', reason: '理由：非核心體驗，不在意是否存在。' },
    { response: '可以接受',   category: 'M 基本品質', reason: '理由：基礎功能，有是應該的。' },
    { response: '無法接受',   category: 'R 反向品質', reason: '理由：設計本身具有干擾性。' },
  ],
  negative_analysis: [
    { response: '我非常喜歡', category: 'R 反向品質', reason: '理由：若喜歡「沒有」，代表原設計干擾體驗。' },
    { response: '我期望如此', category: 'R 反向品質', reason: '理由：期望「沒有」，顯示功能可能是累贅。' },
    { response: '無所謂',     category: 'A 魅力品質', reason: '理由：沒有也無所謂，代表僅是加分項。' },
    { response: '可以接受',   category: 'O 期望品質', reason: '理由：勉強接受沒有，代表屬於期望範疇。' },
    { response: '無法接受',   category: 'M 基本品質', reason: '理由：絕對不能接受沒有，這是基礎門檻。' },
  ],
};

export const DEMO_DATA = {
  meta: {
    totalRespondents: 150,
    expectedQuestions: 5,
    analysisDate: new Date().toISOString().split('T')[0],
  },
  items: [
    {
      id: 'Q1', text: '角色施法時的華麗粒子特效', isPos: true, displayId: 'Q1',
      si: 0.72, dsi: -0.15, category: 'A',
      stats: { A: 90, O: 10, M: 5, I: 45, R: 0, Q: 0 },
      answerCounts: { '我非常喜歡': 90, '我期望如此': 10, '無所謂': 45, '可以接受': 5, '無法接受': 0 },
    },
    {
      id: 'Q2', text: '遊戲讀取時間小於 3 秒', isPos: true, displayId: 'Q2',
      si: 0.80, dsi: -0.75, category: 'O',
      stats: { A: 20, O: 100, M: 20, I: 10, R: 0, Q: 0 },
      answerCounts: { '我非常喜歡': 20, '我期望如此': 100, '無所謂': 10, '可以接受': 20, '無法接受': 0 },
    },
    {
      id: 'Q3', text: '斷線後自動重連功能', isPos: true, displayId: 'Q3',
      si: 0.25, dsi: -0.85, category: 'M',
      stats: { A: 5, O: 20, M: 100, I: 25, R: 0, Q: 0 },
      answerCounts: { '我非常喜歡': 5, '我期望如此': 20, '無所謂': 25, '可以接受': 0, '無法接受': 100 },
    },
    {
      id: 'Q4', text: '每日登入領取少量金幣', isPos: true, displayId: 'Q4',
      si: 0.13, dsi: -0.13, category: 'I',
      stats: { A: 10, O: 10, M: 10, I: 100, R: 20, Q: 0 },
      answerCounts: { '我非常喜歡': 10, '我期望如此': 10, '無所謂': 100, '可以接受': 10, '無法接受': 20 },
    },
    {
      id: 'Q5', text: '深色模式 (Dark Mode)', isPos: true, displayId: 'Q5',
      si: 0.65, dsi: -0.35, category: 'A',
      stats: { A: 60, O: 30, M: 10, I: 50, R: 0, Q: 0 },
      answerCounts: { '我非常喜歡': 60, '我期望如此': 30, '無所謂': 50, '可以接受': 10, '無法接受': 0 },
    },
  ],
};

// Kano 曲線原始座標資料（用於圖表背景曲線）
export const RAW_CURVE_DATA = [
  { x: 0,    m: 0,     o: 0,   a: 0.5,   i: 0.5, r: 1   },
  { x: -0.1, m: 0.095, o: 0.1, a: 0.505, i: 0.5, r: 0.9 },
  { x: -0.2, m: 0.18,  o: 0.2, a: 0.52,  i: 0.5, r: 0.8 },
  { x: -0.3, m: 0.255, o: 0.3, a: 0.545, i: 0.5, r: 0.7 },
  { x: -0.4, m: 0.32,  o: 0.4, a: 0.58,  i: 0.5, r: 0.6 },
  { x: -0.5, m: 0.375, o: 0.5, a: 0.625, i: 0.5, r: 0.5 },
  { x: -0.6, m: 0.42,  o: 0.6, a: 0.68,  i: 0.5, r: 0.4 },
  { x: -0.7, m: 0.455, o: 0.7, a: 0.745, i: 0.5, r: 0.3 },
  { x: -0.8, m: 0.48,  o: 0.8, a: 0.82,  i: 0.5, r: 0.2 },
  { x: -0.9, m: 0.495, o: 0.9, a: 0.905, i: 0.5, r: 0.1 },
  { x: -1,   m: 0.5,   o: 1,   a: 1,     i: 0.5, r: 0   },
];
