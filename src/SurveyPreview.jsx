// ============================================================
// SurveyPreview.jsx — 問卷填寫預覽元件
// ============================================================

import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { CATEGORY_COLORS, SHORT_NAMES, DEFAULT_GUIDE } from './constants';
import { AmiorStatsSummary, AmiorGuideSection } from './components';

const SurveyPreview = ({ data, guide }) => {
  // 將 data.items 依照題號排序並加上顯示用欄位
  const flattenedSurveyItems = useMemo(() => {
    if (!data || !data.items) return [];
    const sorted = [...data.items].sort((a, b) => {
      const idA = parseInt(String(a.id).replace(/\D/g, '')) || 0;
      const idB = parseInt(String(b.id).replace(/\D/g, '')) || 0;
      return idA - idB;
    });
    return sorted.map((item) => ({
      ...item,
      displayId: item.id,
      uniqueKey: item.id,
      typeLabel: item.isPos ? '正向題' : '反向題',
      badgeColor: item.isPos
        ? 'bg-green-100 text-green-700 border-green-200'
        : 'bg-red-100 text-red-700 border-red-200',
      questionText: item.text,
      rawCounts: item.answerCounts,
    }));
  }, [data]);

  // 統計 AMIOR 各類題數
  const amiorStats = useMemo(() => {
    if (!data || !data.items) return null;
    const counts = { A: 0, O: 0, M: 0, I: 0, R: 0 };
    data.items.forEach((q) => {
      if (counts[q.category] !== undefined) counts[q.category]++;
    });
    return counts;
  }, [data]);

  // 有數據時顯示完整預覽
  if (data && data.items && data.items.length > 0) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        {/* 標題卡 */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-8">
          <div className="bg-indigo-600 h-3 w-full"></div>
          <div className="p-8 border-b border-slate-100">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">問卷填寫結果分析</h1>
            <p className="text-slate-600">
              以下顯示從 Excel 解析出的所有題目（獨立計算 AMIOR）及其統計結果。
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
              {[
                { key: 'M', label: '基本 (M)' },
                { key: 'O', label: '期望 (O)' },
                { key: 'A', label: '魅力 (A)' },
                { key: 'I', label: '無差異 (I)' },
                { key: 'R', label: '反向 (R)' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[key] }}></span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 題目卡片列表 */}
        <div className="space-y-6">
          <AmiorStatsSummary amiorStats={amiorStats} />

          {flattenedSurveyItems.map((item) => (
            <div
              key={item.uniqueKey}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden"
            >
              {/* 左側顏色條：正向=綠、反向=紅 */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  item.isPos ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></div>

              <div className="flex flex-col mb-4 pl-2">
                {/* 題號 + 題型 + SI/DSI */}
                <div className="flex items-center gap-3 mb-3 justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-800 text-white px-3 py-1 rounded-lg text-sm font-bold min-w-[40px] text-center">
                      {item.displayId}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold border ${item.badgeColor}`}>
                      {item.typeLabel}
                    </span>
                    {item.designCategory && item.designCategory !== item.actualCategory && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        AI 預測: <strong>{item.designCategory}</strong> vs 實測: {item.actualCategory}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    <span className="text-blue-600">SI: {item.si?.toFixed(3) || 'N/A'}</span>
                    <span className="text-orange-600">DSI: {item.dsi?.toFixed(3) || 'N/A'}</span>
                  </div>
                </div>

                {/* 題目文字 */}
                <h3 className="font-bold text-slate-800 text-lg leading-relaxed mb-2">
                  {item.questionText}
                </h3>

                {/* AMIOR 統計分佈 */}
                {item.stats && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex flex-wrap gap-4 items-center">
                      {['M', 'O', 'A', 'I', 'R'].map((key) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full shadow-sm"
                            style={{ backgroundColor: CATEGORY_COLORS[key] }}
                          ></div>
                          <span className="text-sm font-bold text-slate-700 font-mono tracking-wide">
                            {key}: {item.stats[key] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <AmiorGuideSection guide={guide || DEFAULT_GUIDE} />
        </div>
      </div>
    );
  }

  // 無數據時顯示提示
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
      <Info className="w-16 h-16 opacity-20" />
      <p>目前無數據，請先在「圖表看板」上傳 Excel 數據或使用範例數據。</p>
    </div>
  );
};

export default SurveyPreview;
