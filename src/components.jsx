// ============================================================
// components.jsx — 共用 UI 元件
// ============================================================

import React, { useEffect } from 'react';
import {
  ComposedChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
} from 'recharts';
import {
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Shield,
  Zap,
  Scissors,
  Lightbulb,
} from 'lucide-react';
import {
  CATEGORY_COLORS,
  LINE_COLORS,
  CATEGORY_NAMES,
  SHORT_NAMES,
  RAW_CURVE_DATA,
} from './constants';
import { getQuadrantCategory } from './helpers';

// ─── 通知 Toast ─────────────────────────────────────────────
export const NotificationToast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass =
    type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500';
  const Icon =
    type === 'error' ? AlertCircle : type === 'success' ? CheckCircle : Info;

  return (
    <div
      className={`fixed top-4 right-4 z-[10000] ${bgClass} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-down max-w-sm`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <p className="text-sm font-medium">{message}</p>
      <button onClick={onClose} className="ml-auto hover:bg-white/20 rounded-full p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── 自訂散佈圖標記點（含線段引出標籤）─────────────────────
export const CustomScatterPoint = (props) => {
  const { cx, cy, payload } = props;
  if (!payload) return null;

  const category = getQuadrantCategory(payload.si, payload.dsi);
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS['I'];

  const { lx, ax, ly, ay } = payload;
  const SCALE = 400;
  const xOffset = (lx - ax) * SCALE * -1;
  const yOffset = (ly - ay) * SCALE * -1;
  const finalX = cx + xOffset;
  const finalY = cy + yOffset;
  const dist = Math.sqrt(xOffset * xOffset + yOffset * yOffset);
  const showLine = dist > 10;

  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={1} />
      {showLine && (
        <line
          x1={cx} y1={cy} x2={finalX} y2={finalY}
          stroke="#94a3b8" strokeWidth={1} opacity={0.6}
        />
      )}
      <text
        x={finalX} y={finalY} dy={4}
        fill="#0f172a" fontSize={11} fontWeight="bold" textAnchor="middle"
        style={{ textShadow: '0 0 3px white, 0 0 3px white' }}
      >
        {payload.id}
      </text>
    </g>
  );
};

// ─── 自訂圖表 Tooltip ────────────────────────────────────────
export const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const items = payload[0].payload.originalItems || [payload[0].payload];
    return (
      <div className="bg-white p-2 border border-slate-300 shadow-xl rounded text-xs z-[9999]">
        {items.map((item, idx) => (
          <div key={idx} className={idx > 0 ? 'mt-2 pt-2 border-t' : ''}>
            <span className="font-bold">{item.id}</span>
            <span
              className="ml-2 px-1 rounded text-white"
              style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
            >
              {item.category}
            </span>
            <p>{item.text}</p>
            {item.designCategory && item.designCategory !== item.actualCategory && (
              <div className="mt-1 text-[10px] text-slate-500">
                設計: {item.designCategory} vs 實測: {item.actualCategory}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ─── AMIOR 統計摘要列 ────────────────────────────────────────
export const AmiorStatsSummary = ({ amiorStats }) => {
  if (!amiorStats) return null;
  return (
    <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-wrap gap-4 items-center mb-6">
      <span className="font-bold text-sm text-slate-700">整體分佈：</span>
      {Object.entries(amiorStats).map(([key, count]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[key] }}
          ></div>
          <span className="text-sm font-bold text-slate-700">
            {SHORT_NAMES[key]}: {count}題
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── AMIOR 判讀指南區塊 ──────────────────────────────────────
export const AmiorGuideSection = ({ guide }) => (
  <div className="mt-8 border-t border-slate-200 pt-6">
    <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
      <Lightbulb className="w-5 h-5 text-amber-500" /> Kano 模型判讀指南
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 text-sm text-slate-700">
      <div className="space-y-3">
        <div className="font-bold text-slate-900 border-b pb-2 mb-2">
          正向題反應分析 (四屬性介紹)
        </div>
        {guide.positive_analysis.map((row, idx) => (
          <p key={idx}>
            {row.response} →{' '}
            <strong>（{row.category.split(' ')[0]}）</strong>
            <span className="text-slate-500 block text-xs mt-1">{String(row.reason)}</span>
          </p>
        ))}
      </div>
      <div className="space-y-3">
        <div className="font-bold text-slate-900 border-b pb-2 mb-2">反向題反應分析</div>
        {guide.negative_analysis.map((row, idx) => (
          <p key={idx}>
            {row.response} →{' '}
            <strong>（{row.category.split(' ')[0]}）</strong>
            <span className="text-slate-500 block text-xs mt-1">{String(row.reason)}</span>
          </p>
        ))}
      </div>
    </div>
  </div>
);

// ─── Kano 模型主圖（散佈圖 + 曲線）────────────────────────────
export const SharedKanoChart = ({ height = 500, chartData }) => (
  <div
    className="kano-chart-visual"
    style={{ width: '100%', height, position: 'relative', backgroundColor: '#fff' }}
  >
    {/* 圖例列 */}
    <div className="flex flex-wrap gap-4 justify-center mb-2 text-xs font-bold text-slate-600">
      {[
        { label: '基本 (M)', color: LINE_COLORS.M, dashed: false },
        { label: '期望 (O)', color: LINE_COLORS.O, dashed: false },
        { label: '魅力 (A)', color: LINE_COLORS.A, dashed: false },
        { label: '無差異 (I)', color: LINE_COLORS.I, dashed: false },
        { label: '反向 (R)', color: LINE_COLORS.R, dashed: true },
      ].map(({ label, color, dashed }) => (
        <div key={label} className="flex items-center gap-1">
          <span
            className="w-8 h-1 rounded"
            style={{
              background: color,
              borderBottom: dashed ? `2px dashed ${color}` : undefined,
              display: 'inline-block',
            }}
          ></span>
          {label}
        </div>
      ))}
    </div>

    {/* 象限背景文字 */}
    <div
      className="absolute inset-0 pointer-events-none flex flex-col pl-[50px] pr-[30px] pt-[20px] pb-[40px] z-0"
      style={{ top: 30 }}
    >
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center text-blue-500/20 font-bold text-2xl select-none">
          魅力屬性 (Attractive)
        </div>
        <div className="flex-1 flex items-center justify-center text-orange-500/20 font-bold text-2xl select-none">
          期望屬性 (One-dimensional)
        </div>
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 flex items-center justify-center text-slate-700/20 font-bold text-2xl select-none">
          無差異屬性 (Indifferent)
        </div>
        <div className="flex-1 flex items-center justify-center text-red-500/20 font-bold text-2xl select-none">
          基本屬性 (Must-be)
        </div>
      </div>
    </div>

    <ResponsiveContainer width="100%" height="90%">
      <ComposedChart margin={{ top: 20, right: 30, bottom: 20, left: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number" dataKey="x" domain={[-1, 0]} reversed
          label={{ value: '不滿意係數 (DSI)', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 12 }}
          stroke="#94a3b8" fontSize={11}
        />
        <YAxis
          type="number" dataKey="y" domain={[0, 1]}
          label={{ value: '滿意係數 (SI)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
          stroke="#94a3b8" fontSize={11}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 9999 }} />
        <Line data={RAW_CURVE_DATA} dataKey="m" type="monotone" stroke={LINE_COLORS.M} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line data={RAW_CURVE_DATA} dataKey="o" type="monotone" stroke={LINE_COLORS.O} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line data={RAW_CURVE_DATA} dataKey="a" type="monotone" stroke={LINE_COLORS.A} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line data={RAW_CURVE_DATA} dataKey="i" type="monotone" stroke={LINE_COLORS.I} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line data={RAW_CURVE_DATA} dataKey="r" type="monotone" stroke={LINE_COLORS.R} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <ReferenceLine x={-0.5} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1} />
        <ReferenceLine y={0.5} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={1} />
        <Scatter data={chartData} isAnimationActive={false} shape={<CustomScatterPoint />} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

// ─── 報告優化建議卡片：階段容器 ────────────────────────────────
export const StageSection = ({ stage, children }) => {
  const configs = {
    1: {
      borderColor: 'border-red-200', headerBg: 'bg-red-50', iconColor: 'text-red-400',
      title: '搞定基礎體驗', sub: '針對基本品質 (M)',
      icon: <Shield className="w-8 h-8 text-red-400 opacity-80" />,
      badgeBg: 'bg-red-200', badgeText: 'text-red-800', badgeLabel: '第一階段：優先止血',
    },
    2: {
      borderColor: 'border-amber-200', headerBg: 'bg-amber-50', iconColor: 'text-amber-400',
      title: '創造亮點與爽感', sub: '針對期望/魅力 (O & A)',
      icon: <Zap className="w-8 h-8 text-amber-400 opacity-80" />,
      badgeBg: 'bg-amber-200', badgeText: 'text-amber-800', badgeLabel: '第二階段：體驗升級',
    },
    3: {
      borderColor: 'border-emerald-200', headerBg: 'bg-emerald-50', iconColor: 'text-emerald-400',
      title: '避免無效開發', sub: '針對無差異 (I)',
      icon: <Scissors className="w-8 h-8 text-emerald-400 opacity-80" />,
      badgeBg: 'bg-emerald-200', badgeText: 'text-emerald-800', badgeLabel: '第三階段：資源節流',
    },
  };
  const c = configs[stage] || configs[3];

  return (
    <div className={`mb-10 w-full rounded-xl border-2 ${c.borderColor} overflow-hidden bg-white shadow-sm`}>
      <div className={`p-6 border-b ${c.borderColor} ${c.headerBg} relative`}>
        <div className="absolute right-6 top-6 p-2 rounded-full bg-white/50">{c.icon}</div>
        <div className={`inline-block px-3 py-1 ${c.badgeBg} ${c.badgeText} text-xs font-bold rounded-full mb-2`}>
          {c.badgeLabel}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{c.title}</h2>
        <p className="text-slate-600 text-sm">{c.sub}</p>
      </div>
      <div className="p-6 bg-slate-50/30 space-y-6">{children}</div>
    </div>
  );
};

// ─── 優化建議卡（精簡版：僅顯示題號 + 題目）─────────────────
export const SuggestionCard = ({ group }) => {
  const item = group.items[0];
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow p-4">
      <div className="flex items-center gap-3">
        <span className="bg-slate-800 text-white px-2 py-0.5 rounded text-xs font-bold shrink-0">
          {item.id}
        </span>
        <span
          className="text-white px-2 py-0.5 rounded text-xs shrink-0"
          style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
        >
          {SHORT_NAMES[item.category]}
        </span>
        <h3 className="text-base font-bold text-slate-800 leading-snug">{item.text}</h3>
      </div>
    </div>
  );
};

// ─── 題目統計資料表（左右分欄布局）─────────────────────────────
export const QuestionStatsTable = ({ items }) => {
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);

  const renderItem = (item) => (
    <div
      key={item.uniqueKey}
      className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
    >
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-bold min-w-[36px] text-center">
          {item.displayId}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-white px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
          >
            {SHORT_NAMES[item.category]}
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed font-medium break-words">
          {item.text}
        </p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
        <div className="space-y-2">{leftItems.map(renderItem)}</div>
        <div className="space-y-2">{rightItems.map(renderItem)}</div>
      </div>
    </div>
  );
};
