'use client';
import React, { useState, useEffect, useCallback, useRef } from "react";
import MemoModal, { type MemoSaveData } from "./MemoModal";
import ExchangeSelector from "./ExchangeSelector";
import DiaryQuickInput from "./DiaryQuickInput";
import { useTheme, type Theme } from "@/lib/theme";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExportMode {
  section: 'positions' | 'orders';
  step: 0 | 1 | 2; // 0=시작선택 1=종료선택 2=형식선택
  startTs: number | null;
  endTs: number | null;
}

interface ParsedOrder {
  id: string; date: string; sym: string;
  dir: 'long' | 'short' | 'unknown';
  type: 'open' | 'close' | 'unknown';
  size: string; avg: string;
  posProfit: number; fee: number; net: number;
  isNew: boolean; rawTime: number;
}

interface ParsedPos {
  id: string; date: string; sym: string; rawSym: string;
  side: 'long' | 'short';
  oAvg: string; cAvg: string; size: string;
  pnl: number; funding: number; totalFee: number; net: number;
  isNew: boolean; rawTime: number; openTime: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface MemoMap { [positionId: string]: MemoSaveData; }

// ── Parsing ────────────────────────────────────────────────────────────────────

function symName(s: string) { return s.replace('USDT', '').replace('_UMCBL', ''); }
function fmtDate(ts: string | number) {
  if (!ts) return '';
  return new Date(Number(ts)).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseOrders(raw: AnyRecord[]): ParsedOrder[] {
  return raw.map((o, i) => {
    const ps = (o.posSide || '').toLowerCase(), ts = (o.tradeSide || '').toLowerCase(), s = (o.side || '').toLowerCase();
    let dir: ParsedOrder['dir'] = 'unknown';
    if (ps === 'long') dir = 'long'; else if (ps === 'short') dir = 'short';
    else if (s === 'buy') dir = 'long'; else if (s === 'sell') dir = 'short';
    let type: ParsedOrder['type'] = 'unknown';
    if (ts === 'open') type = 'open'; else if (ts === 'close') type = 'close';
    else if (o.reduceOnly === 'NO') type = 'open'; else if (o.reduceOnly === 'YES') type = 'close';

    // fills: price / order-history: priceAvg
    const avg = parseFloat(o.price || o.priceAvg || '0');

    // fills: feeDetail 객체 / order-history: fee 직접
    let fee = parseFloat(o.fee || '0');
    if (fee === 0 && o.feeDetail) {
      for (const v of Object.values(o.feeDetail as Record<string, { totalFee?: string }>)) {
        const f = parseFloat(v?.totalFee || '0');
        if (f !== 0) { fee = f; break; }
      }
    }

    // fills: profit / order-history: totalProfits
    const posProfit = parseFloat(o.totalProfits || o.profit || '0');
    const rawTime = parseInt(o.cTime || o.createTime || o.ctime || '0');

    // fills: tradeId가 unique / order-history: orderId
    const id = o.tradeId || o.orderId || `row-${i}`;

    return { id, date: fmtDate(rawTime), sym: symName(o.symbol || ''), dir, type, size: o.baseVolume || o.size || '', avg: avg > 0 ? avg.toFixed(2) : '-', posProfit, fee, net: posProfit + fee, isNew: false, rawTime };
  }).sort((a, b) => b.rawTime - a.rawTime);
}

function parsePosHist(raw: AnyRecord[]): ParsedPos[] {
  return raw.map(p => {
    const side = ((p.holdSide || p.posSide || '').toLowerCase()) as 'long' | 'short';
    const pnl = parseFloat(p.cumRealisedPnl || p.pnl || 0);
    const funding = parseFloat(p.totalFunding || 0);
    const openFee = parseFloat(p.openFeeTotal || p.openFee || 0);
    const closeFee = parseFloat(p.closeFeeTotal || p.closeFee || 0);
    const net = parseFloat(p.netProfit || 0);
    const rawTime = parseInt(p.utime || p.updatedTime || p.ctime || '0');
    const openTime = parseInt(p.openTime || p.ctime || p.createTime || '0');
    const oAvg = parseFloat(p.openAvgPrice || p.openPriceAvg || 0);
    const cAvg = parseFloat(p.closeAvgPrice || p.closePriceAvg || 0);
    const rawSym = p.symbol || '';
    return { id: p.positionId || String(Math.random()), date: fmtDate(rawTime), sym: symName(rawSym), rawSym, side, oAvg: oAvg > 0 ? oAvg.toFixed(2) : '-', cAvg: cAvg > 0 ? cAvg.toFixed(2) : '-', size: p.closeTotalPos || p.openTotalPos || '', pnl, funding, totalFee: openFee + closeFee, net, isNew: false, rawTime, openTime };
  }).sort((a, b) => b.rawTime - a.rawTime);
}

// ── Utils ──────────────────────────────────────────────────────────────────────

const PAGE = 20;
function pnlCls(n: number) { return n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-500'; }
function pnlSign(n: number) { return n > 0 ? '+' : ''; }
function f4(n: number) { return `${pnlSign(n)}${n.toFixed(4)}`; }
function fmtPrice(n: number) {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  if (abs >= 0.0001) return n.toFixed(6);
  return n.toFixed(8);
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ interval, setInterval, isAuto, autoRef, loadData }: {
  interval: string;
  setInterval: (v: string) => void;
  isAuto: boolean;
  autoRef: React.MutableRefObject<ReturnType<typeof globalThis.setInterval> | null>;
  loadData: () => void;
}) {
  const { theme, setTheme } = useTheme();

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'dark',   label: '다크 모드',       icon: '🌙' },
    { value: 'light',  label: '화이트 모드',      icon: '☀️' },
    { value: 'system', label: '시스템 설정과 동일', icon: '💻' },
  ];

  return (
    <div className="max-w-lg space-y-4">
      {/* 테마 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">테마</h3>
        <div className="flex flex-col gap-2">
          {themeOptions.map(opt => (
            <button key={opt.value} onClick={() => setTheme(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-left ${
                theme === opt.value
                  ? 'bg-green-500/10 border-green-500 text-green-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}>
              <span className="text-base">{opt.icon}</span>
              {opt.label}
              {theme === opt.value && <span className="ml-auto text-green-500 text-xs">✓ 적용됨</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 매매 환경 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">매매 환경</h3>
        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
          <label className="text-sm text-gray-400">자동갱신 주기</label>
          <select value={interval}
            onChange={e => {
              setInterval(e.target.value);
              localStorage.setItem('fj_interval', e.target.value);
              if (isAuto) {
                if (autoRef.current) clearInterval(autoRef.current);
                autoRef.current = globalThis.setInterval(loadData, parseInt(e.target.value) * 1000);
              }
            }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none cursor-pointer focus:border-green-500">
            <option value="30">30초</option>
            <option value="60">1분</option>
            <option value="120">2분</option>
            <option value="300">5분</option>
          </select>
        </div>
      </div>

      {/* 손익 계산 기준 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">손익 계산 기준</h3>
        <div className="text-xs text-gray-400 space-y-2 leading-relaxed">
          <p><strong className="text-white">주문 내역</strong> — 주문별 (포지션손익 + 수수료)</p>
          <p><strong className="text-white">포지션 내역</strong> — 포지션별 netProfit <span className="text-gray-600">(펀딩피·수수료 모두 포함 → 가장 정확)</span></p>
          <p className="text-gray-600">순손익 셀에 마우스를 올리면 상세 내역을 볼 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const pages: (number | '...')[] = [];
  if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); }
  else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
    if (page < total - 2) pages.push('...');
    pages.push(total);
  }
  const btn = "w-7 h-7 rounded border border-gray-700 text-xs flex items-center justify-center cursor-pointer hover:bg-gray-800 disabled:opacity-30 transition-colors";
  return (
    <div className="flex items-center gap-1">
      <button className={btn} disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>
      {pages.map((p, i) => p === '...'
        ? <span key={i} className="text-gray-600 text-xs px-1">···</span>
        : <button key={i} className={`${btn} ${p === page ? 'bg-green-500 text-black border-green-500' : 'text-gray-300'}`} onClick={() => onChange(Number(p))}>{p}</button>
      )}
      <button className={btn} disabled={page === total} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

function PnlTooltip({ net, detail }: { net: number; detail: React.ReactNode }) {
  return (
    <div className="relative group inline-block">
      <span className={`font-semibold cursor-help ${pnlCls(net)}`}>{f4(net)}</span>
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-200 whitespace-nowrap z-50 shadow-xl leading-relaxed">
        {detail}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-600" />
      </div>
    </div>
  );
}

function StatusBar({ s }: { s: { msg: string; type: string } | null }) {
  if (!s) return null;
  const cls = { info: 'bg-blue-900/30 border-blue-700 text-blue-300', success: 'bg-green-900/30 border-green-700 text-green-300', error: 'bg-red-900/30 border-red-700 text-red-300', warning: 'bg-yellow-900/30 border-yellow-700 text-yellow-300' }[s.type] ?? 'bg-gray-800 text-gray-300';
  return <div className={`border rounded-lg px-4 py-2 text-sm mb-4 ${cls}`}>{s.msg}</div>;
}

function StatsPanel({ balance, orders, positions, subTab }: { balance: AnyRecord | null; orders: ParsedOrder[]; positions: ParsedPos[]; subTab: string }) {
  let count = 0, pnl = 0, wr: number | null = null;
  if (subTab === 'orders') {
    const closes = orders.filter(o => o.type === 'close');
    count = orders.length; pnl = closes.reduce((s, o) => s + o.net, 0);
    wr = closes.length ? (closes.filter(o => o.net > 0).length / closes.length) * 100 : null;
  } else {
    count = positions.length; pnl = positions.reduce((s, p) => s + p.net, 0);
    wr = positions.length ? (positions.filter(p => p.net > 0).length / positions.length) * 100 : null;
  }
  const equity = balance ? parseFloat(balance.usdtEquity || balance.accountEquity || '0').toFixed(2) : '-';
  const cards = [
    { label: 'Balance', value: equity, sub: 'USDT' },
    { label: 'Count', value: String(count) },
    { label: 'Net PnL', value: count ? `${pnlSign(pnl)}${pnl.toFixed(2)}` : '-', cls: count ? pnlCls(pnl) : '', sub: 'USDT' },
    { label: 'Win Rate', value: wr !== null ? `${wr.toFixed(1)}%` : '-', cls: wr !== null ? pnlCls(wr - 50) : '' },
  ];
  return (
    <div className="grid grid-cols-5 gap-3 mb-4">
      {cards.map(({ label, value, sub, cls }) => (
        <div key={label} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1 leading-tight">{label}</div>
          <div className={`text-lg font-semibold ${cls || 'text-white'}`}>{value}</div>
          {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const [mainTab, setMainTab] = useState<'history' | 'openpos' | 'settings'>('history');
  const [subTab, setSubTab]   = useState<'orders' | 'positions'>('positions');
  const [mode, setMode]       = useState<'preset' | 'custom' | 'all'>('preset');
  const [days, setDays]       = useState(7);
  const [cStart, setCStart]   = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [cEnd, setCEnd]       = useState(new Date().toISOString().slice(0, 10));

  const [orders,    setOrders]    = useState<ParsedOrder[]>([]);
  const [positions, setPositions] = useState<ParsedPos[]>([]);
  const [openPos,   setOpenPos]   = useState<AnyRecord[]>([]);
  const [balance,   setBalance]   = useState<AnyRecord | null>(null);
  const [memos,     setMemos]     = useState<MemoMap>({});

  const [oSym, setOSym] = useState(''); const [oSide, setOSide] = useState(''); const [oType, setOType] = useState('');
  const [pSym, setPSym] = useState(''); const [pSide, setPSide] = useState('');
  const [oPage, setOPage] = useState(1); const [pPage, setPPage] = useState(1);

  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState<{ msg: string; type: string } | null>(null);
  const [progress, setProgress] = useState({ show: false, pct: 0, label: '' });
  const [isAuto,   setIsAuto]   = useState(false);
  const [lastUpd,  setLastUpd]  = useState('');
  const autoRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  const [interval, setAutoInterval] = useState('60');
  const [memoModal, setMemoModal] = useState<{ id: string; src: 'pos' | 'plan'; time?: number } | null>(null);
  const [exportMode, setExportMode] = useState<ExportMode | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  // 거래소 선택
  const [activeExchange, setActiveExchange] = useState('bitget');
  const [registeredExchanges, setRegisteredExchanges] = useState<string[]>([]);

  useEffect(() => {
    setAutoInterval(localStorage.getItem('fj_interval') || '60');
    setActiveExchange(localStorage.getItem('fj_exchange') || 'bitget');
    // 등록된 거래소 목록 로드
    fetch('/api/user/api-key').then(r => r.json()).then(json => {
      if (json.success) {
        const exchanges = (json.data.keys ?? []).map((k: { exchange: string }) => k.exchange);
        setRegisteredExchanges(exchanges);
        // 저장된 거래소가 없으면 첫 번째 거래소로 설정
        const saved = localStorage.getItem('fj_exchange');
        if (!saved && exchanges.length > 0) setActiveExchange(exchanges[0]);
      }
    }).catch(() => {});
  }, []);

  const handleExchangeChange = (exchange: string) => {
    setActiveExchange(exchange);
    localStorage.setItem('fj_exchange', exchange);
    // 거래소 변경 시 데이터 초기화 후 재로드
    setOrders([]); setPositions([]); setBalance(null);
  };

  // 활성 거래소 API URL prefix 생성
  const apiUrl = useCallback((path: string, params: URLSearchParams) => {
    params.set('exchange', activeExchange);
    return `/api/exchange/${path}?${params.toString()}`;
  }, [activeExchange]);

  // export 선택 모드 감지 (settings/export 에서 진입)
  useEffect(() => {
    const raw = sessionStorage.getItem('fjExportSelect');
    if (!raw) return;
    try {
      const { section } = JSON.parse(raw) as { section: 'positions' | 'orders' };
      setExportMode({ section, step: 0, startTs: null, endTs: null });
      setSubTab(section);
      setMainTab('history');
    } catch {}
  }, []);

  const loadMemos = useCallback(async () => {
    try {
      const res = await fetch('/api/memos'); const json = await res.json();
      if (json.success) {
        const map: MemoMap = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        json.data.forEach((m: any) => { map[m.positionId] = m; });
        setMemos(map);
      }
    } catch {}
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('balance', new URLSearchParams()));
      const json = await res.json();
      if (json.success && json.data?.data?.[0]) setBalance(json.data.data[0]);
    } catch {}
  }, [apiUrl]);

  const getRange = useCallback(() => {
    const now = Date.now();
    if (mode === 'preset') return { s: now - days * 86400000, e: now };
    if (mode === 'custom') return { s: new Date(cStart).getTime(), e: new Date(cEnd).getTime() + 86399999 };
    return null;
  }, [mode, days, cStart, cEnd]);

  const fetchOrders = useCallback(async (s: number, e: number) => {
    const all: AnyRecord[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const p = new URLSearchParams({ startTime: String(s), endTime: String(e), limit: '100', ...(cursor ? { idLessThan: cursor } : {}) });
      const res  = await fetch(apiUrl('orders', p));
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const list: AnyRecord[] = json.data?.data?.fillList || json.data?.data?.fills || [];
      all.push(...list);
      if (list.length < 100) break;
      cursor = list[list.length - 1]?.orderId || list[list.length - 1]?.tradeId;
      if (!cursor) break;
      await new Promise(r => setTimeout(r, 150));
    }
    return parseOrders(all);
  }, [apiUrl]);

  const fetchPositions = useCallback(async (s: number, e: number) => {
    const all: AnyRecord[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const p = new URLSearchParams({ startTime: String(s), endTime: String(e), limit: '100', ...(cursor ? { idLessThan: cursor } : {}) });
      const res  = await fetch(apiUrl('position-history', p));
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const list: AnyRecord[] = json.data?.data?.list || [];
      all.push(...list);
      if (list.length < 100) break;
      cursor = list[list.length - 1]?.positionId;
      if (!cursor) break;
      await new Promise(r => setTimeout(r, 150));
    }
    return parsePosHist(all);
  }, [apiUrl]);

  const showStatus = (msg: string, type: string, autoClear = false) => {
    setStatus({ msg, type });
    if (autoClear) setTimeout(() => setStatus(null), 1800);
  };

  const loadData = useCallback(async () => {
    const range = getRange(); if (!range) return;
    setLoading(true); showStatus('불러오는 중...', 'info');
    try {
      if (subTab === 'orders') { setOrders(await fetchOrders(range.s, range.e)); setOPage(1); }
      else { setPositions(await fetchPositions(range.s, range.e)); setPPage(1); }
      await fetchBalance();
      setLastUpd('업데이트: ' + new Date().toLocaleTimeString('ko-KR'));
      showStatus('완료', 'success', true);
    } catch (e) { showStatus('오류: ' + (e instanceof Error ? e.message : '알 수 없는 오류'), 'error'); }
    finally { setLoading(false); }
  }, [getRange, subTab, fetchOrders, fetchPositions, fetchBalance]);

  const loadAllHistory = useCallback(async () => {
    const CHUNK = 90 * 86400000, now = Date.now(), from = new Date('2019-01-01').getTime();
    const chunks: { s: number; e: number }[] = [];
    let t = now; while (t > from) { const s = Math.max(t - CHUNK, from); chunks.push({ s, e: t }); t = s; }
    setProgress({ show: true, pct: 0, label: '' }); setLoading(true);
    let all: (ParsedOrder | ParsedPos)[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const { s, e } = chunks[i];
      showStatus(`${i + 1}/${chunks.length} 구간 조회 중...`, 'info');
      setProgress({ show: true, pct: (i / chunks.length) * 100, label: `${new Date(s).toLocaleDateString('ko-KR')} ~ ${new Date(e).toLocaleDateString('ko-KR')}` });
      try { all = [...all, ...(subTab === 'orders' ? await fetchOrders(s, e) : await fetchPositions(s, e))]; await new Promise(r => setTimeout(r, 300)); } catch {}
    }
    setProgress({ show: true, pct: 100, label: '' });
    setTimeout(() => setProgress({ show: false, pct: 0, label: '' }), 1000);
    const seen = new Set<string>();
    const dedup = all.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
    if (subTab === 'orders') { setOrders(dedup as ParsedOrder[]); setOPage(1); }
    else { setPositions(dedup as ParsedPos[]); setPPage(1); }
    await fetchBalance();
    setLastUpd('업데이트: ' + new Date().toLocaleTimeString('ko-KR'));
    showStatus(`총 ${dedup.length}개 로드 완료`, 'success', true);
    setLoading(false);
  }, [subTab, fetchOrders, fetchPositions, fetchBalance]);

  const loadOpenPos = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('positions', new URLSearchParams()));
      const json = await res.json();
      if (json.success) setOpenPos((json.data?.data || []).filter((p: AnyRecord) => parseFloat(p.total || p.size || '0') > 0));
    } catch {}
  }, [apiUrl]);

  // Initial load — activeExchange 초기화 후 실행
  useEffect(() => {
    if (registeredExchanges.length === 0) return; // 거래소 목록 로드 전 대기
    const init = async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const s = now - 7 * 86400000;
        const [ord, pos, bal] = await Promise.all([
          fetchOrders(s, now),
          fetchPositions(s, now),
          fetch(apiUrl('balance', new URLSearchParams())).then(r => r.json()),
        ]);
        setOrders(ord);
        setPositions(pos);
        if (bal.success && bal.data?.data?.[0]) setBalance(bal.data.data[0]);
        setLastUpd('업데이트: ' + new Date().toLocaleTimeString('ko-KR'));
      } catch {} finally { setLoading(false); }
      loadMemos();
    };
    init();
  }, [registeredExchanges]); // eslint-disable-line react-hooks/exhaustive-deps

  // 거래소 변경 시 데이터 재로드
  const exchangeRef = useRef(activeExchange);
  useEffect(() => {
    if (exchangeRef.current === activeExchange) return;
    exchangeRef.current = activeExchange;
    if (registeredExchanges.length === 0) return;
    const range = getRange();
    if (!range) return;
    setLoading(true);
    Promise.all([
      fetchOrders(range.s, range.e),
      fetchPositions(range.s, range.e),
      fetch(apiUrl('balance', new URLSearchParams())).then(r => r.json()),
    ]).then(([ord, pos, bal]) => {
      setOrders(ord); setPositions(pos); setPPage(1); setOPage(1);
      if (bal.success && bal.data?.data?.[0]) setBalance(bal.data.data[0]);
      setLastUpd('업데이트: ' + new Date().toLocaleTimeString('ko-KR'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeExchange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load on days/mode change (preset only)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (mode === 'preset') loadData();
  }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup auto-timer
  useEffect(() => () => { if (autoRef.current) clearInterval(autoRef.current); }, []);

  const toggleAuto = () => {
    if (isAuto) { if (autoRef.current) clearInterval(autoRef.current); setIsAuto(false); }
    else { autoRef.current = globalThis.setInterval(loadData, parseInt(interval) * 1000); setIsAuto(true); }
  };

  const handleSubTabSwitch = (tab: 'orders' | 'positions') => {
    setSubTab(tab);
    if (tab === 'positions' && positions.length === 0) {
      const range = getRange();
      if (range) { setLoading(true); fetchPositions(range.s, range.e).then(p => { setPositions(p); setPPage(1); }).finally(() => setLoading(false)); }
    }
  };

  const handleMemoSave = async (data: MemoSaveData) => {
    if (!memoModal) return;
    await fetch('/api/memos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId: memoModal.id, ...data }) });
    await loadMemos(); setMemoModal(null);
  };

  const memoInfoLine = () => {
    if (!memoModal) return '';
    const pnlSpan = (n: number) => `<span class="${pnlCls(n)}">${n >= 0 ? '+' : ''}${n.toFixed(4)} USDT</span>`;
    if (memoModal.src === 'plan') {
      const p = openPos.find((_, i) => `open_${openPos[i].symbol}_${openPos[i].holdSide}` === memoModal.id);
      if (p) return `<strong style="color:#f0f0f0">${symName(p.symbol)}</strong> &nbsp; ${(p.holdSide || '').toUpperCase()} &nbsp;|&nbsp; ${p.leverage}x &nbsp;|&nbsp; 현재 포지션`;
      return memoModal.id;
    }
    const p = positions.find(x => x.id === memoModal.id);
    return p ? `<strong style="color:#f0f0f0">${p.sym}</strong> &nbsp; ${p.date} &nbsp;|&nbsp; ${p.side} &nbsp;|&nbsp; Net PnL: ${pnlSpan(p.net)}` : memoModal.id;
  };

  // ── Export 선택 모드 핸들러 ────────────────────────────────────────────────────
  const handleRowDoubleClick = (rawTime: number) => {
    if (!exportMode) return;
    if (exportMode.step === 0) {
      setExportMode({ ...exportMode, step: 1, startTs: rawTime });
    } else if (exportMode.step === 1) {
      setExportMode({ ...exportMode, step: 2, endTs: rawTime });
    }
  };

  const handleExportDownload = async (format: 'excel' | 'csv') => {
    if (!exportMode?.startTs || !exportMode?.endTs) return;
    setExportLoading(true);
    try {
      const from = new Date(Math.min(exportMode.startTs, exportMode.endTs)).toISOString();
      const to   = new Date(Math.max(exportMode.startTs, exportMode.endTs)).toISOString();
      const url  = format === 'excel'
        ? `/api/export/excel?type=${exportMode.section}&from=${from}&to=${to}`
        : `/api/export/csv?type=${exportMode.section}&from=${from}&to=${to}`;
      const res  = await fetch(url);
      if (!res.ok) { showStatus('다운로드 실패', 'error'); return; }
      const blob  = await res.blob();
      const cd    = res.headers.get('Content-Disposition') ?? '';
      const fname = cd.match(/filename="([^"]+)"/)?.[1] ?? `export.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; a.click(); URL.revokeObjectURL(a.href);
      sessionStorage.removeItem('fjExportSelect');
      setExportMode(null);
    } finally {
      setExportLoading(false);
    }
  };

  const exportRowCls = (rowTime: number) => {
    if (!exportMode) return '';
    if (rowTime === exportMode.startTs) return 'bg-blue-500/20 outline outline-1 outline-blue-400';
    if (rowTime === exportMode.endTs)   return 'bg-amber-500/20 outline outline-1 outline-amber-400';
    if (exportMode.startTs && exportMode.endTs) {
      const lo = Math.min(exportMode.startTs, exportMode.endTs);
      const hi = Math.max(exportMode.startTs, exportMode.endTs);
      if (rowTime > lo && rowTime < hi) return 'bg-green-500/5';
    }
    return '';
  };

  // Filtered & paginated data
  const filtO = orders.filter(o => (!oSym || o.sym === oSym) && (!oSide || o.dir === oSide) && (!oType || o.type === oType));
  const filtP = positions.filter(p => (!pSym || p.sym === pSym) && (!pSide || p.side === pSide));
  const oSyms = [...new Set(orders.map(o => o.sym).filter(Boolean))].sort();
  const pSyms = [...new Set(positions.map(p => p.sym).filter(Boolean))].sort();
  const oTotal = Math.max(1, Math.ceil(filtO.length / PAGE));
  const pTotal = Math.max(1, Math.ceil(filtP.length / PAGE));
  const oItems = filtO.slice((oPage - 1) * PAGE, oPage * PAGE);
  const pItems = filtP.slice((pPage - 1) * PAGE, pPage * PAGE);

  const tabBtn = (t: typeof mainTab, label: string) => (
    <button key={t} onClick={() => { setMainTab(t); if (t === 'openpos') loadOpenPos(); }}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mainTab === t ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'}`}>
      {label}
    </button>
  );

  const filterSelect = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <select value={value} onChange={e => { onChange(e.target.value); }}
      className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  const badge = (label: string, isLong: boolean | null, isOpen?: boolean) => {
    if (isOpen !== undefined) return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full text-force-white ${isOpen ? 'bg-blue-500' : 'bg-slate-500'}`}>{label}</span>;
    return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full text-force-white ${isLong ? 'bg-green-500' : 'bg-red-500'}`}>{label}</span>;
  };

  return (
    <div className={exportMode ? 'pt-16' : ''}>
      {/* Export 선택 모드 고정 배너 */}
      {exportMode && (
        <div className="fixed top-[52px] left-0 right-0 z-50 bg-blue-950 border-b-2 border-blue-400 px-6 py-3 flex items-center gap-4 shadow-xl">
          <span className="text-sm font-semibold text-blue-200 shrink-0">
            {exportMode.step === 0 && '시작 시점으로 선택할 항목을 더블클릭 하세요'}
            {exportMode.step === 1 && '종료 시점으로 선택할 항목을 더블클릭 하세요'}
            {exportMode.step === 2 && '형식을 고르세요'}
          </span>
          {exportMode.step === 1 && exportMode.startTs && (
            <span className="text-xs text-blue-300 shrink-0">
              시작: {new Date(exportMode.startTs).toLocaleString('ko-KR')}
            </span>
          )}
          {exportMode.step === 2 && exportMode.startTs && exportMode.endTs && (
            <span className="text-xs text-gray-300 shrink-0">
              {new Date(Math.min(exportMode.startTs, exportMode.endTs)).toLocaleDateString('ko-KR')}
              {' ~ '}
              {new Date(Math.max(exportMode.startTs, exportMode.endTs)).toLocaleDateString('ko-KR')}
            </span>
          )}
          {exportMode.step === 2 && (
            <>
              <button onClick={() => handleExportDownload('excel')} disabled={exportLoading}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {exportLoading ? '생성중...' : 'Excel'}
              </button>
              <button onClick={() => handleExportDownload('csv')} disabled={exportLoading}
                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {exportLoading ? '생성중...' : 'CSV'}
              </button>
            </>
          )}
          <button onClick={() => { sessionStorage.removeItem('fjExportSelect'); setExportMode(null); }}
            className="ml-auto text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded">
            ✕ 취소
          </button>
        </div>
      )}

      {/* Nav tabs + Exchange selector */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
          {tabBtn('history', '매매 내역')}
          {tabBtn('openpos', '현재 포지션')}
          {tabBtn('settings', '설정')}
        </div>
        <ExchangeSelector
          registeredExchanges={registeredExchanges}
          activeExchange={activeExchange}
          onChange={handleExchangeChange}
        />
      </div>

      {/* 빠른 일기 입력 */}
      {mainTab === 'history' && <DiaryQuickInput />}

      {/* ── 매매 내역 ─────────────────────────────────────── */}
      {mainTab === 'history' && (
        <div>
          <StatusBar s={status} />

          <StatsPanel balance={balance} orders={filtO} positions={filtP} subTab={subTab} />

          {/* Date filter bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex gap-0.5 bg-gray-800 rounded-lg p-0.5">
              {(['preset', 'custom', 'all'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === m ? 'bg-green-500 text-black' : 'text-gray-400 hover:text-white'}`}>
                  {m === 'preset' ? '빠른선택' : m === 'custom' ? '직접선택' : '전체기간'}
                </button>
              ))}
            </div>

            {mode === 'preset' && (
              <select value={days} onChange={e => setDays(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none cursor-pointer">
                {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d}일</option>)}
              </select>
            )}

            {mode === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">시작</span>
                <input type="date" value={cStart} onChange={e => setCStart(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-green-500" />
                <span className="text-xs text-gray-400">종료</span>
                <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-green-500" />
                <button onClick={loadData} className="bg-green-500 hover:bg-green-400 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">조회</button>
              </div>
            )}

            {mode === 'all' && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-yellow-400">90일씩 자동 분할 조회</span>
                <button onClick={loadAllHistory} disabled={loading}
                  className="bg-yellow-900/50 border border-yellow-700 text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-yellow-900 disabled:opacity-50 transition-colors">
                  ▶ 전체 불러오기
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button onClick={loadData} disabled={loading}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <span className={loading ? 'animate-spin inline-block' : ''}>⟳</span> {loading ? '로딩 중...' : '새로고침'}
              </button>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${isAuto ? 'bg-green-900/30 border-green-700 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                {isAuto && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                {isAuto ? '자동갱신 켜짐' : '자동갱신 꺼짐'}
              </div>
              <button onClick={toggleAuto} className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                {isAuto ? '끄기' : '켜기'}
              </button>
              {lastUpd && <span className="text-gray-600 text-xs">{lastUpd}</span>}
            </div>
          </div>

          {/* Progress bar */}
          {progress.show && (
            <div className="mb-4">
              <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${progress.pct}%` }} />
              </div>
              {progress.label && <p className="text-xs text-gray-500">{progress.label}</p>}
            </div>
          )}

          {/* Sub tabs */}
          <div className="flex border-b border-gray-800 mb-4">
            {(['positions', 'orders'] as const).map(t => (
              <button key={t} onClick={() => handleSubTabSwitch(t)}
                className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${subTab === t ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {t === 'orders' ? '주문 내역' : '포지션 내역'}
              </button>
            ))}
          </div>

          {/* ─ 주문 내역 ─ */}
          {subTab === 'orders' && (
            <div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {filterSelect(oSym, v => { setOSym(v); setOPage(1); }, [{ value: '', label: 'All Symbols' }, ...oSyms.map(s => ({ value: s, label: s }))])}
                {filterSelect(oSide, v => { setOSide(v); setOPage(1); }, [{ value: '', label: 'All Sides' }, { value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }])}
                {filterSelect(oType, v => { setOType(v); setOPage(1); }, [{ value: '', label: 'All Types' }, { value: 'open', label: 'Open' }, { value: 'close', label: 'Close' }])}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wide">
                        {['Date', 'Symbol', 'Side', 'Type', 'Size', 'Price', 'PnL', 'Fee', 'Net PnL'].map(h => (
                          <th key={h} className="py-3 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {oItems.length === 0 ? (
                        <tr><td colSpan={9} className="py-12 text-center text-gray-600">{loading ? '불러오는 중...' : '주문 내역이 없습니다'}</td></tr>
                      ) : oItems.map(o => {
                        const isClose = o.type === 'close';
                        return (
                          <tr key={o.id}
                            onDoubleClick={() => handleRowDoubleClick(o.rawTime)}
                            className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${exportMode ? 'cursor-pointer select-none' : ''} ${exportRowCls(o.rawTime)}`}>
                            <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{o.date}</td>
                            <td className="py-2.5 px-3 font-semibold text-white">{o.sym}</td>
                            <td className="py-2.5 px-3">{badge(o.dir === 'long' ? 'Long' : 'Short', o.dir === 'long')}</td>
                            <td className="py-2.5 px-3">{badge(o.type === 'open' ? 'Open' : 'Close', null, o.type === 'open')}</td>
                            <td className="py-2.5 px-3 text-gray-400">{o.size}</td>
                            <td className="py-2.5 px-3 text-gray-300">{o.avg}</td>
                            <td className="py-2.5 px-3">{isClose ? <span className={pnlCls(o.posProfit)}>{f4(o.posProfit)}</span> : <span className="text-gray-700">-</span>}</td>
                            <td className="py-2.5 px-3">{isClose ? <span className="text-red-400">{o.fee.toFixed(4)}</span> : <span className="text-gray-700">-</span>}</td>
                            <td className="py-2.5 px-3">{isClose ? <PnlTooltip net={o.net} detail={<>PnL: {f4(o.posProfit)}<br />Fee: {o.fee.toFixed(4)}<br />Net PnL: {f4(o.net)}</>} /> : <span className="text-gray-700">-</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {filtO.length > 0 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{(oPage - 1) * PAGE + 1}~{Math.min(oPage * PAGE, filtO.length)} / 총 {filtO.length}개</span>
                  <Pagination page={oPage} total={oTotal} onChange={setOPage} />
                </div>
              )}
            </div>
          )}

          {/* ─ 포지션 내역 ─ */}
          {subTab === 'positions' && (
            <div>
              <div className="flex gap-2 mb-3 flex-wrap">
                {filterSelect(pSym, v => { setPSym(v); setPPage(1); }, [{ value: '', label: 'All Symbols' }, ...pSyms.map(s => ({ value: s, label: s }))])}
                {filterSelect(pSide, v => { setPSide(v); setPPage(1); }, [{ value: '', label: 'All Sides' }, { value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }])}
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wide">
                        {['Close Date', 'Symbol', 'Side', 'Entry', 'Close', 'Size', 'PnL', 'Funding', 'Fee', 'Net PnL', 'Memo', ''].map(h => (
                          <th key={h} className="py-3 px-3 text-left font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pItems.length === 0 ? (
                        <tr><td colSpan={12} className="py-12 text-center text-gray-600">{loading ? '불러오는 중...' : '포지션 내역이 없습니다'}</td></tr>
                      ) : pItems.map(p => (
                        <tr key={p.id}
                          onDoubleClick={() => handleRowDoubleClick(p.rawTime)}
                          className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${exportMode ? 'cursor-pointer select-none' : ''} ${exportRowCls(p.rawTime)}`}>
                          <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{p.date}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{p.sym}</td>
                          <td className="py-2.5 px-3">{badge(p.side === 'long' ? 'Long' : 'Short', p.side === 'long')}</td>
                          <td className="py-2.5 px-3 text-gray-300">{p.oAvg}</td>
                          <td className="py-2.5 px-3 text-gray-300">{p.cAvg}</td>
                          <td className="py-2.5 px-3 text-gray-400">{p.size}</td>
                          <td className="py-2.5 px-3"><span className={pnlCls(p.pnl)}>{f4(p.pnl)}</span></td>
                          <td className="py-2.5 px-3"><span className={pnlCls(p.funding)}>{f4(p.funding)}</span></td>
                          <td className="py-2.5 px-3 text-red-400">{p.totalFee.toFixed(4)}</td>
                          <td className="py-2.5 px-3">
                            <PnlTooltip net={p.net} detail={<>PnL: {f4(p.pnl)}<br />Funding: {f4(p.funding)}<br />Fee: {p.totalFee.toFixed(4)}<br />Net PnL: {f4(p.net)}</>} />
                          </td>
                          <td className="py-2.5 px-3">
                            <button onClick={() => setMemoModal({ id: p.id, src: 'pos', time: p.rawTime })}
                              className={`px-2 py-1 rounded text-xs border transition-colors ${memos[p.id] ? 'border-green-600 text-green-400 bg-green-900/30' : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}>
                              {memos[p.id] ? '✓ Memo' : '+ Memo'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => {
                                const url = `/replay?sym=${p.rawSym}&side=${p.side}&from=${p.openTime || p.rawTime - 86400000}&to=${p.rawTime}&label=${encodeURIComponent(p.sym)}&posId=${encodeURIComponent(p.id)}`;
                                window.open(url, '_blank');
                              }}
                              className="px-2 py-1 rounded text-xs border border-purple-700 text-purple-400 hover:border-purple-500 hover:bg-purple-900/30 transition-colors whitespace-nowrap">
                              ▶ Replay
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {filtP.length > 0 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{(pPage - 1) * PAGE + 1}~{Math.min(pPage * PAGE, filtP.length)} / 총 {filtP.length}개</span>
                  <Pagination page={pPage} total={pTotal} onChange={setPPage} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 현재 포지션 ──────────────────────────────────── */}
      {mainTab === 'openpos' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={loadOpenPos} className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors">⟳ 새로고침</button>
          </div>
          {openPos.length === 0 ? (
            <div className="text-center py-16 text-gray-600"><div className="text-4xl mb-3 opacity-50">📭</div>현재 오픈 포지션 없음</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {openPos.map((p, i) => {
                const isLong = (p.holdSide || '').toLowerCase() === 'long';
                const pnl = parseFloat(p.unrealizedPL || p.unrealizedPl || '0');
                const entry = parseFloat(p.openPriceAvg || p.avgPrice || '0');
                const mark = parseFloat(p.markPrice || '0');
                const planId = `open_${p.symbol}_${p.holdSide}`;
                return (
                  <div key={i} className={`bg-gray-900 rounded-xl p-4 border border-gray-800 border-l-4 ${isLong ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-base font-bold text-white">{symName(p.symbol || '')}</span>
                      <div className="flex items-center gap-2">
                        {badge(isLong ? 'Long' : 'Short', isLong)}
                        <button onClick={() => setMemoModal({ id: planId, src: 'plan' })}
                          className={`px-2 py-0.5 rounded text-xs border transition-colors ${memos[planId] ? 'border-green-600 text-green-400 bg-green-900/30' : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}>
                          {memos[planId] ? '✓ Plan' : '+ Plan'}
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const qty = parseFloat(p.total || p.size || '0');
                      const notional = qty * mark;
                      const items: { k: string; node: React.ReactNode; cls?: string }[] = [
                        { k: 'Entry', node: fmtPrice(entry) },
                        { k: 'Mark', node: fmtPrice(mark) },
                        { k: 'Size', node: <span className="text-right"><span className="text-gray-300">{qty.toLocaleString()}</span>{notional > 0 && <span className="text-gray-600 ml-1">≈{fmtPrice(notional)} USDT</span>}</span> },
                        { k: 'Leverage', node: `${p.leverage || '-'}x` },
                        { k: 'Margin', node: `${fmtPrice(parseFloat(p.marginSize || '0'))} USDT` },
                        { k: 'Liq Price', node: fmtPrice(parseFloat(p.liquidationPrice || '0')), cls: 'text-red-400' },
                        { k: 'Unrealized PnL', node: `${pnlSign(pnl)}${fmtPrice(pnl)} USDT`, cls: pnlCls(pnl) },
                      ];
                      return items.map(({ k, node, cls }) => (
                        <div key={k} className="flex justify-between items-center py-1.5 border-b border-gray-800 text-xs last:border-0">
                          <span className="text-gray-500">{k}</span>
                          <span className={cls || 'text-gray-300'}>{node}</span>
                        </div>
                      ));
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 설정 ─────────────────────────────────────────── */}
      {mainTab === 'settings' && (
        <SettingsTab interval={interval} setInterval={setAutoInterval} isAuto={isAuto} autoRef={autoRef} loadData={loadData} />
      )}

      {/* Memo / Plan Modal */}
      {memoModal && (
        <MemoModal
          id={memoModal.id}
          title={memoModal.src === 'plan' ? '포지션 계획' : '포지션 메모'}
          infoLine={memoInfoLine()}
          existing={memos[memoModal.id]}
          onSave={handleMemoSave}
          onClose={() => setMemoModal(null)}
          positionTime={memoModal.time}
        />
      )}
    </div>
  );
}
