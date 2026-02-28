// ============================================================
// Particle Canvas Background (Meta Whale style)
// ============================================================
(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((w * h) / 18000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy; p.pulse += 0.02;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34, 211, 238, ${alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize(); createParticles(); draw();
  window.addEventListener('resize', () => { resize(); createParticles(); });
})();

// ============================================================
// Nav Scroll Effect
// ============================================================
(function initNavScroll() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  window.addEventListener('scroll', () => {
    topbar.classList.toggle('scrolled', window.scrollY > 30);
  });
})();

// ============================================================
// TeamTrade Dashboard - app.js
// Real-time trading dashboard with Binance WebSocket/REST API
// ============================================================

// --- Security: HTML Escape ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Input Validation ---
function validateTradeInput(price, amount, leverage) {
  price = parseFloat(price);
  amount = parseFloat(amount);
  leverage = parseInt(leverage);
  var errors = [];
  if (isNaN(price) || price <= 0) errors.push('价格必须大于0');
  if (isNaN(amount) || amount <= 0) errors.push('数量必须大于0');
  if (isNaN(leverage) || leverage < 1 || leverage > 20) errors.push('杠杆必须在1-20之间');
  return { valid: errors.length === 0, errors: errors, price: price, amount: amount, leverage: leverage };
}

// --- Data Declarations ---
const TEAM = [
  { name: '张伟', init: 'ZW', color: '#6366f1', capital: 1000 },
  { name: '李娜', init: 'LN', color: '#f59e0b', capital: 1000 },
  { name: '王强', init: 'WQ', color: '#22c55e', capital: 1000 },
  { name: '赵敏', init: 'ZM', color: '#ef4444', capital: 1000 },
  { name: '陈晨', init: 'CC', color: '#3b82f6', capital: 1000 },
  { name: '刘洋', init: 'LY', color: '#a855f7', capital: 1000 }
];

const STRATS = [
  { name: '200MA趋势跟踪', type: 'trend', desc: '价格站上200日均线持有，跌破卖出。只做多头趋势，过滤熊市大跌。',
    rules: '入场: 收盘价 > MA200 | 出场: 收盘价 < MA200 | 止损: MA200下方2%',
    backtest: '年化45-80% · 胜率38% · 盈亏比3.2:1 · 最大回撤-35%(vs买入持有-78%)' },
  { name: 'RSI(2)均值回归', type: 'reversion', desc: 'RSI(2)<10超卖买入，RSI(2)>90卖出。必须配合MA200过滤，只在上升趋势做多。',
    rules: '入场: RSI(2)<10 且 价格>MA200 | 出场: RSI(2)>90 | 止损: 入场价下方3%',
    backtest: '胜率81% · 平均持仓2-5天 · 盈亏比1.2:1 · 夏普比率1.8' },
  { name: '布林带收缩突破', type: 'volatility', desc: '布林带宽度收缩至60日最低后等待突破。低波动后必有高波动，捕捉爆发行情。',
    rules: '入场: 带宽<60日最低 且 突破上轨 | 出场: 触及中轨 | 止损: 下轨',
    backtest: '年化35-55% · 胜率52% · 盈亏比2.1:1 · 月均交易3-5次' },
  { name: 'MACD趋势策略', type: 'trend', desc: 'MACD金叉做多死叉做空，结合柱状图放量确认动量方向。',
    rules: '入场: DIF上穿DEA 且 柱状图连续2根放大 | 出场: DIF下穿DEA | 止损: 入场价下方2%',
    backtest: '胜率45% · 盈亏比2.5:1 · 夏普比率1.3 · 适合4h/1d周期' },
  { name: '均线交叉策略', type: 'trend', desc: 'MA7上穿MA25买入，下穿卖出。经典趋势跟踪，配合成交量过滤假信号。',
    rules: '入场: MA7>MA25 且 成交量>20日均量1.5倍 | 出场: MA7<MA25 | 止损: MA25下方1.5%',
    backtest: '胜率42% · 盈亏比2.8:1 · 加量价过滤后假信号减少40%' },
  { name: '网格交易策略', type: 'grid', desc: '在价格区间内等距挂单自动低买高卖。无需判断方向，适合横盘震荡市。',
    rules: '设定: 上下界±5% · 网格数10 · 每格投入本金10% | 止损: 价格跌破下界5%',
    backtest: '月化3-8% · 胜率88% · 盈亏比0.6:1 · 适合BTC震荡区间' },
  { name: 'Fibonacci回撤', type: 'reversion', desc: '利用38.2%/50%/61.8%回撤位精准入场，止损明确盈亏比优秀。',
    rules: '入场: 回撤至61.8%且出现看涨K线 | 出场: 前高 | 止损: 回撤78.6%下方',
    backtest: '胜率48% · 盈亏比3.1:1 · 夏普比率1.5 · 适合趋势回调' },
  { name: '3-5-7风控法则', type: 'risk', desc: '不是交易策略，是资金管理法则。单笔最大亏3%，单方向敞口5%，总亏损上限7%。',
    rules: '单笔风险≤本金3% | 同方向总仓位≤5% | 账户总风险≤7% | 连亏3笔暂停30分钟',
    backtest: '配合任意策略使用 · 可将最大回撤降低40-60% · 职业交易员标配' }
];

const STRAT_NAMES = STRATS.map(function(s) { return s.name; });

let SIGNALS = [];

const SYMBOL_MAP = {
  'BTC/USDT': 'btcusdt',
  'ETH/USDT': 'ethusdt',
  'SOL/USDT': 'solusdt',
  'BNB/USDT': 'bnbusdt'
};

const SYMBOL_LIST = Object.keys(SYMBOL_MAP);
let currentSymbol = 'BTC/USDT';
let currentInterval = '1m';

const TF_MAP = {
  '1分': '1m', '5分': '5m', '15分': '15m',
  '1时': '1h', '4时': '4h', '1日': '1d'
};

let tickerData = {};
let klineData = [];
let depthData = { asks: [], bids: [] };

// --- 引擎集成 ---
var _memberRoundRobin = 0; // 成员轮询计数器
var _marketData = { fundingRate: null, fearGreed: null, longShortRatio: null, markPrice: 0 };

let wsKline = null;
let wsTicker = null;
let wsDepth = null;
var wsRetry = { ticker: 1, kline: 1, depth: 1 };
function retryDelay(key) { var d = Math.min(30000, 3000 * wsRetry[key]); wsRetry[key] = Math.min(wsRetry[key] * 2, 10); return d; }
function resetRetry(key) { wsRetry[key] = 1; }

const indicators = { ma7: true, ma25: true, boll: false, rsi: false, macd: false };
let tradeMarkers = [];

// ============================================================
// Trading Journal System (localStorage persistence)
// ============================================================

var JOURNAL_KEY = 'teamtrade_journal';

function loadJournal() {
  try {
    var raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveJournal(journal) {
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)); } catch(e) {}
}

function addJournalEntry(entry) {
  var journal = loadJournal();
  entry.id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  entry.timestamp = new Date().toISOString();
  entry.status = entry.status || 'open';
  entry.closePrice = null;
  entry.closedAt = null;
  entry.pnl = null;
  entry.pnlPct = null;
  journal.unshift(entry);
  saveJournal(journal);
  return entry;
}

function closeJournalEntry(id, closePrice, closeNote) {
  var journal = loadJournal();
  for (var i = 0; i < journal.length; i++) {
    if (journal[i].id === id && journal[i].status === 'open') {
      journal[i].status = 'closed';
      journal[i].closePrice = parseFloat(closePrice);
      journal[i].closedAt = new Date().toISOString();
      journal[i].closeNote = closeNote || '';
      var entry = parseFloat(journal[i].entryPrice);
      var exit = journal[i].closePrice;
      var qty = parseFloat(journal[i].amount) || 1;
      var lev = parseFloat(journal[i].leverage) || 1;
      if (journal[i].side === 'long') {
        journal[i].pnl = (exit - entry) * qty * lev;
      } else {
        journal[i].pnl = (entry - exit) * qty * lev;
      }
      // ROE% = PnL / 保证金 × 100 (正确的杠杆收益率公式)
      var margin = entry * qty / lev;
      journal[i].pnlPct = margin > 0 ? (journal[i].pnl / margin * 100) : 0;
      break;
    }
  }
  saveJournal(journal);
}

function deleteJournalEntry(id) {
  var journal = loadJournal();
  journal = journal.filter(function(e) { return e.id !== id; });
  saveJournal(journal);
}

// ============================================================
// Strategy Analytics
// ============================================================

function calcStrategyStats() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });
  var stratMap = {};

  closed.forEach(function(e) {
    var key = e.strategy || '未分类';
    if (!stratMap[key]) {
      stratMap[key] = { name: key, total: 0, wins: 0, losses: 0, totalPnl: 0, trades: [] };
    }
    var s = stratMap[key];
    s.total++;
    s.totalPnl += (e.pnl || 0);
    if (e.pnl > 0) s.wins++;
    else s.losses++;
    s.trades.push(e);
  });

  var stats = Object.keys(stratMap).map(function(k) {
    var s = stratMap[k];
    s.winRate = s.total > 0 ? (s.wins / s.total * 100) : 0;
    s.avgPnl = s.total > 0 ? (s.totalPnl / s.total) : 0;
    return s;
  });

  stats.sort(function(a, b) { return b.totalPnl - a.totalPnl; });
  return stats;
}

function calcOverallStats() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });
  var open = journal.filter(function(e) { return e.status === 'open'; });
  var totalPnl = 0, wins = 0, losses = 0, maxWin = 0, maxLoss = 0;

  closed.forEach(function(e) {
    var p = e.pnl || 0;
    totalPnl += p;
    if (p > 0) { wins++; if (p > maxWin) maxWin = p; }
    else { losses++; if (p < maxLoss) maxLoss = p; }
  });

  return {
    totalTrades: journal.length,
    openTrades: open.length,
    closedTrades: closed.length,
    totalPnl: totalPnl,
    winRate: closed.length > 0 ? (wins / closed.length * 100) : 0,
    wins: wins,
    losses: losses,
    maxWin: maxWin,
    maxLoss: maxLoss,
    avgPnl: closed.length > 0 ? (totalPnl / closed.length) : 0
  };
}

// ============================================================
// 引擎辅助函数 — 指标快照、成本预览、Toast提示
// ============================================================

function collectIndicatorSnapshot() {
  var snap = {};
  if (klineData.length < 2) return snap;
  var rsiArr = calcRSI(klineData, 14);
  if (rsiArr.length > 0) snap.rsi = rsiArr[rsiArr.length - 1].val;
  var macdArr = calcMACD(klineData);
  if (macdArr.length > 1) {
    var last = macdArr[macdArr.length - 1];
    var prev = macdArr[macdArr.length - 2];
    snap.macdHist = last.hist;
    snap.macdCross = (prev.hist <= 0 && last.hist > 0) ? 'golden' : (prev.hist >= 0 && last.hist < 0) ? 'death' : 'none';
  }
  var bollArr = calcBoll(klineData, 20);
  if (bollArr.length > 0) {
    var b = bollArr[bollArr.length - 1];
    var curClose = parseFloat(klineData[klineData.length - 1].close);
    snap.bollUpper = b.upper;
    snap.bollLower = b.lower;
    snap.bollPosition = curClose <= b.lower ? 'lower' : curClose >= b.upper ? 'upper' : 'mid';
  }
  var ma200 = calcMA(klineData, Math.min(200, klineData.length));
  if (ma200.length > 0) {
    snap.priceAboveMa200 = parseFloat(klineData[klineData.length - 1].close) > ma200[ma200.length - 1].val;
  }
  // 成交量判断
  if (klineData.length >= 20) {
    var volSum = 0;
    for (var vi = klineData.length - 20; vi < klineData.length; vi++) volSum += parseFloat(klineData[vi].volume || 0);
    var avgVol = volSum / 20;
    snap.volumeAboveAvg = parseFloat(klineData[klineData.length - 1].volume || 0) > avgVol * 1.5;
  }
  return snap;
}

function updateCostPreview() {
  var priceEl = document.getElementById('tradePrice');
  var amountEl = document.getElementById('tradeAmount');
  var levSlider = document.getElementById('leverageSlider');
  var costEl = document.getElementById('estCost');
  var feeEl = costEl ? costEl.parentElement.querySelector('.cost-line:nth-child(2) span:last-child') : null;
  if (!priceEl || !amountEl || !costEl) return;
  var price = parseFloat(priceEl.value.replace(/,/g, '')) || 0;
  var qty = parseFloat(amountEl.value) || 0;
  var lev = levSlider ? parseInt(levSlider.value) : 1;
  var notional = price * qty;
  var margin = notional / lev;
  var fee = notional * 0.0004;
  costEl.textContent = margin > 0 ? '$' + margin.toFixed(2) : '--';
  if (feeEl) feeEl.textContent = '≈ $' + fee.toFixed(2);
}

function showTradeToast(title, detail, color) {
  var toast = document.createElement('div');
  toast.className = 'trade-toast ' + (color || 'green');
  toast.innerHTML = '<div class="toast-title">' + escapeHtml(title) + '</div><div class="toast-detail">' + escapeHtml(detail) + '</div>';
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 4000);
}

// ============================================================
// Technical Indicator Calculation Functions
// ============================================================

function calcMA(data, period) {
  var result = [];
  for (var i = period - 1; i < data.length; i++) {
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) {
      sum += parseFloat(data[j].close);
    }
    result.push({ idx: i, val: sum / period });
  }
  return result;
}

function calcEMA(data, period) {
  var result = [];
  if (data.length === 0) return result;
  var k = 2 / (period + 1);
  var ema = parseFloat(data[0].close);
  result.push({ idx: 0, val: ema });
  for (var i = 1; i < data.length; i++) {
    ema = parseFloat(data[i].close) * k + ema * (1 - k);
    result.push({ idx: i, val: ema });
  }
  return result;
}

function calcRSI(data, period) {
  if (typeof period === 'undefined') period = 14;
  var result = [];
  if (data.length < period + 1) return result;
  var gains = 0, losses = 0;
  for (var i = 1; i <= period; i++) {
    var diff = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  var avgGain = gains / period;
  var avgLoss = losses / period;
  var rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({ idx: period, val: 100 - 100 / (1 + rs) });
  for (var i = period + 1; i < data.length; i++) {
    var diff = parseFloat(data[i].close) - parseFloat(data[i - 1].close);
    var gain = diff >= 0 ? diff : 0;
    var loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ idx: i, val: 100 - 100 / (1 + rs) });
  }
  return result;
}

function calcMACD(data, fast, slow, signal) {
  if (typeof fast === 'undefined') fast = 12;
  if (typeof slow === 'undefined') slow = 26;
  if (typeof signal === 'undefined') signal = 9;
  var emaFast = calcEMA(data, fast);
  var emaSlow = calcEMA(data, slow);
  var macdLine = [];
  var sFast = {}, sSlow = {};
  for (var i = 0; i < emaFast.length; i++) sFast[emaFast[i].idx] = emaFast[i].val;
  for (var i = 0; i < emaSlow.length; i++) sSlow[emaSlow[i].idx] = emaSlow[i].val;
  for (var i = 0; i < data.length; i++) {
    if (typeof sFast[i] !== 'undefined' && typeof sSlow[i] !== 'undefined') {
      macdLine.push({ idx: i, val: sFast[i] - sSlow[i] });
    }
  }
  var sigLine = [];
  if (macdLine.length >= signal) {
    var k = 2 / (signal + 1);
    var ema = macdLine[0].val;
    sigLine.push({ idx: macdLine[0].idx, val: ema });
    for (var i = 1; i < macdLine.length; i++) {
      ema = macdLine[i].val * k + ema * (1 - k);
      sigLine.push({ idx: macdLine[i].idx, val: ema });
    }
  }
  var hist = [];
  var sigMap = {};
  for (var i = 0; i < sigLine.length; i++) sigMap[sigLine[i].idx] = sigLine[i].val;
  for (var i = 0; i < macdLine.length; i++) {
    var idx = macdLine[i].idx;
    if (typeof sigMap[idx] !== 'undefined') {
      hist.push({ idx: idx, val: macdLine[i].val - sigMap[idx] });
    }
  }
  return { macd: macdLine, signal: sigLine, hist: hist };
}

function calcBoll(data, period, mult) {
  if (typeof period === 'undefined') period = 20;
  if (typeof mult === 'undefined') mult = 2;
  var upper = [], mid = [], lower = [];
  for (var i = period - 1; i < data.length; i++) {
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) sum += parseFloat(data[j].close);
    var mean = sum / period;
    var sqSum = 0;
    for (var j = i - period + 1; j <= i; j++) {
      var diff = parseFloat(data[j].close) - mean;
      sqSum += diff * diff;
    }
    var std = Math.sqrt(sqSum / period);
    mid.push({ idx: i, val: mean });
    upper.push({ idx: i, val: mean + mult * std });
    lower.push({ idx: i, val: mean - mult * std });
  }
  return { upper: upper, mid: mid, lower: lower };
}

function detectSignals(data) {
  tradeMarkers = [];
  if (data.length < 30) return;
  var ma7 = calcMA(data, 7);
  var ma25 = calcMA(data, 25);
  var rsi = calcRSI(data, 14);
  var macd = calcMACD(data);
  var boll = calcBoll(data, 20, 2);
  // Build lookup maps
  var ma7Map = {}, ma25Map = {}, rsiMap = {}, macdHistMap = {};
  var bollUpperMap = {}, bollLowerMap = {};
  for (var i = 0; i < ma7.length; i++) ma7Map[ma7[i].idx] = ma7[i].val;
  for (var i = 0; i < ma25.length; i++) ma25Map[ma25[i].idx] = ma25[i].val;
  for (var i = 0; i < rsi.length; i++) rsiMap[rsi[i].idx] = rsi[i].val;
  for (var i = 0; i < macd.hist.length; i++) macdHistMap[macd.hist[i].idx] = macd.hist[i].val;
  for (var i = 0; i < boll.upper.length; i++) bollUpperMap[boll.upper[i].idx] = boll.upper[i].val;
  for (var i = 0; i < boll.lower.length; i++) bollLowerMap[boll.lower[i].idx] = boll.lower[i].val;

  for (var i = 1; i < data.length; i++) {
    var price = parseFloat(data[i].close);
    var low = parseFloat(data[i].low);
    var high = parseFloat(data[i].high);
    // MA crossover signals
    if (indicators.ma7 && indicators.ma25 && ma7Map[i] && ma25Map[i] && ma7Map[i - 1] && ma25Map[i - 1]) {
      if (ma7Map[i - 1] <= ma25Map[i - 1] && ma7Map[i] > ma25Map[i]) {
        tradeMarkers.push({ idx: i, type: 'buy', price: low, reason: 'MA金叉' });
      }
      if (ma7Map[i - 1] >= ma25Map[i - 1] && ma7Map[i] < ma25Map[i]) {
        tradeMarkers.push({ idx: i, type: 'sell', price: high, reason: 'MA死叉' });
      }
    }
    // RSI signals
    if (indicators.rsi && rsiMap[i] !== undefined) {
      if (rsiMap[i] < 30) {
        tradeMarkers.push({ idx: i, type: 'buy', price: low, reason: 'RSI超卖' });
      }
      if (rsiMap[i] > 70) {
        tradeMarkers.push({ idx: i, type: 'sell', price: high, reason: 'RSI超买' });
      }
    }
    // MACD histogram cross zero
    if (indicators.macd && macdHistMap[i] !== undefined && macdHistMap[i - 1] !== undefined) {
      if (macdHistMap[i - 1] <= 0 && macdHistMap[i] > 0) {
        tradeMarkers.push({ idx: i, type: 'buy', price: low, reason: 'MACD金叉' });
      }
      if (macdHistMap[i - 1] >= 0 && macdHistMap[i] < 0) {
        tradeMarkers.push({ idx: i, type: 'sell', price: high, reason: 'MACD死叉' });
      }
    }
    // Bollinger band touch
    if (indicators.boll && bollLowerMap[i] !== undefined && bollUpperMap[i] !== undefined) {
      if (low <= bollLowerMap[i]) {
        tradeMarkers.push({ idx: i, type: 'buy', price: low, reason: '触及布林下轨' });
      }
      if (high >= bollUpperMap[i]) {
        tradeMarkers.push({ idx: i, type: 'sell', price: high, reason: '触及布林上轨' });
      }
    }
  }
}

// ============================================================
// Utility Functions
// ============================================================

function formatPrice(p) {
  p = parseFloat(p);
  if (isNaN(p)) return '--';
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

function timeAgo(i) {
  var u = ['刚刚', '1分钟前', '2分钟前', '3分钟前', '5分钟前', '8分钟前', '12分钟前', '15分钟前', '20分钟前', '30分钟前'];
  return u[i % u.length];
}

function randBetween(a, b) { return a + Math.random() * (b - a); }

function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  var el = document.getElementById('clock');
  if (el) el.textContent = h + ':' + m + ':' + s;
}

// ============================================================
// Binance REST API Functions
// ============================================================

function fetchKlineHistory(symbol, interval, cb) {
  var sym = SYMBOL_MAP[symbol] || 'btcusdt';
  var url = 'https://api.binance.com/api/v3/klines?symbol=' + sym.toUpperCase() + '&interval=' + interval + '&limit=80';
  fetch(url).then(function(r) { return r.json(); }).then(function(arr) {
    klineData = arr.map(function(d) {
      return {
        time: d[0], open: d[1], high: d[2], low: d[3], close: d[4],
        volume: d[5], closeTime: d[6]
      };
    });
    detectSignals(klineData);
    if (cb) cb(klineData);
  }).catch(function(e) { console.error('Kline fetch error:', e); });
}

function fetchAllTickers(cb) {
  fetch('https://api.binance.com/api/v3/ticker/24hr').then(function(r) { return r.json(); }).then(function(arr) {
    arr.forEach(function(t) {
      tickerData[t.symbol] = {
        price: t.lastPrice,
        change: t.priceChangePercent,
        high: t.highPrice,
        low: t.lowPrice,
        vol: t.volume,
        quoteVol: t.quoteVolume
      };
    });
    if (cb) cb(tickerData);
  }).catch(function(e) { console.error('Ticker fetch error:', e); });
}

// ============================================================
// Binance WebSocket Functions
// ============================================================

function connectTickerWS() {
  if (wsTicker) { try { wsTicker.close(); } catch(e) {} }
  var streams = SYMBOL_LIST.map(function(s) { return SYMBOL_MAP[s] + '@ticker'; }).join('/');
  wsTicker = new WebSocket('wss://stream.binance.com:9443/stream?streams=' + streams);
  wsTicker.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.data) {
      var d = msg.data;
      tickerData[d.s] = {
        price: d.c, change: d.P, high: d.h, low: d.l,
        vol: d.v, quoteVol: d.q
      };
      updateTickerBar();
      if (d.s === SYMBOL_MAP[currentSymbol].toUpperCase()) {
        updatePriceDisplay();
      }
    }
  };
  wsTicker.onopen = function() { resetRetry('ticker'); };
  wsTicker.onerror = function(e) { console.error('Ticker WS error:', e); };
  wsTicker.onclose = function() { setTimeout(connectTickerWS, retryDelay('ticker')); };
}

function connectKlineWS() {
  if (wsKline) { try { wsKline.close(); } catch(e) {} }
  var sym = SYMBOL_MAP[currentSymbol];
  wsKline = new WebSocket('wss://stream.binance.com:9443/ws/' + sym + '@kline_' + currentInterval);
  wsKline.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.k) {
      var k = msg.k;
      var bar = {
        time: k.t, open: k.o, high: k.h, low: k.l, close: k.c,
        volume: k.v, closeTime: k.T
      };
      if (klineData.length > 0 && klineData[klineData.length - 1].time === bar.time) {
        klineData[klineData.length - 1] = bar;
      } else {
        klineData.push(bar);
        if (klineData.length > 200) klineData.shift();
      }
      if (k.x) {
        pushAutoSignal(bar);
      }
      detectSignals(klineData);
      updateTVBar(bar);
    }
  };
  wsKline.onopen = function() { resetRetry('kline'); };
  wsKline.onerror = function(e) { console.error('Kline WS error:', e); };
  wsKline.onclose = function() { setTimeout(connectKlineWS, retryDelay('kline')); };
}

function connectDepthWS() {
  if (wsDepth) { try { wsDepth.close(); } catch(e) {} }
  var sym = SYMBOL_MAP[currentSymbol];
  wsDepth = new WebSocket('wss://stream.binance.com:9443/ws/' + sym + '@depth10@100ms');
  wsDepth.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg.asks && msg.bids) {
      depthData.asks = msg.asks.map(function(a) { return { price: parseFloat(a[0]), qty: parseFloat(a[1]) }; });
      depthData.bids = msg.bids.map(function(b) { return { price: parseFloat(b[0]), qty: parseFloat(b[1]) }; });
      renderOrderbook();
    }
  };
  wsDepth.onopen = function() { resetRetry('depth'); };
  wsDepth.onerror = function(e) { console.error('Depth WS error:', e); };
  wsDepth.onclose = function() { setTimeout(connectDepthWS, retryDelay('depth')); };
}

// ============================================================
// Signal Generation
// ============================================================

function pushAutoSignal(bar) {
  detectSignals(klineData);
  if (tradeMarkers.length === 0) return;
  var last = tradeMarkers[tradeMarkers.length - 1];
  var priceStr = formatPrice(last.price);
  var direction = last.type === 'buy' ? '买入信号' : '卖出信号';
  var text = '';
  if (last.reason === 'MA金叉' || last.reason === 'MA死叉') {
    text = 'MA7上穿MA25 ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
    if (last.reason === 'MA死叉') text = 'MA7下穿MA25 ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  } else if (last.reason === 'RSI超卖') {
    var rsiVals = calcRSI(klineData, 14);
    var rsiLast = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1].val.toFixed(1) : '?';
    text = 'RSI(14)=' + rsiLast + ' 超卖反弹 ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  } else if (last.reason === 'RSI超买') {
    var rsiVals = calcRSI(klineData, 14);
    var rsiLast = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1].val.toFixed(1) : '?';
    text = 'RSI(14)=' + rsiLast + ' 超买回落 ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  } else if (last.reason === 'MACD金叉' || last.reason === 'MACD死叉') {
    text = last.reason + ' ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  } else if (last.reason === '触及布林下轨' || last.reason === '触及布林上轨') {
    text = last.reason + ' ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  } else {
    text = last.reason + ' ' + direction + ' ' + currentSymbol + ' @ ' + priceStr;
  }
  var member = TEAM[Math.floor(Math.random() * TEAM.length)];
  SIGNALS.unshift({
    type: last.type === 'buy' ? 'long' : 'short',
    text: text,
    member: member.name,
    init: member.init,
    color: member.color,
    time: '刚刚',
    pair: currentSymbol
  });
  if (SIGNALS.length > 50) SIGNALS.length = 50;
  renderSignals();

  // Write auto signal to journal
  var stratName = last.reason.indexOf('MA') >= 0 ? '均线交叉策略' :
    last.reason.indexOf('RSI') >= 0 ? 'RSI反转策略' :
    last.reason.indexOf('MACD') >= 0 ? 'MACD趋势策略' :
    last.reason.indexOf('布林') >= 0 ? '布林带突破策略' : '自动策略';
  addJournalEntry({
    side: last.type === 'buy' ? 'long' : 'short',
    symbol: currentSymbol,
    entryPrice: last.price,
    amount: '0',
    leverage: '1',
    strategy: stratName,
    method: last.reason,
    note: '自动信号触发 · ' + text,
    member: member.name,
    capital: member.capital,
    source: 'auto'
  });
  renderJournal();
  renderAnalytics();
}

// ============================================================
// Rendering Functions - Ticker & Price
// ============================================================

function updateTickerBar() {
  var el = document.getElementById('tickerTrack');
  if (!el) return;
  var html = '';
  SYMBOL_LIST.forEach(function(sym) {
    var key = SYMBOL_MAP[sym].toUpperCase();
    var t = tickerData[key];
    if (!t) return;
    var chg = parseFloat(t.change);
    var cls = chg >= 0 ? 'green' : 'red';
    html += '<span class="ticker-item">';
    html += '<span class="ticker-sym">' + sym + '</span> ';
    html += '<span class="ticker-price">$' + formatPrice(t.price) + '</span> ';
    html += '<span class="ticker-chg ' + cls + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>';
    html += '</span>';
  });
  // Duplicate for seamless scroll
  el.innerHTML = html + html;
}

function updatePriceDisplay() {
  var key = SYMBOL_MAP[currentSymbol].toUpperCase();
  var t = tickerData[key];
  if (!t) return;
  var priceEl = document.getElementById('priceMain');
  var changeEl = document.getElementById('priceChange');
  var tradeEl = document.getElementById('tradePrice');
  var midEl = document.getElementById('obMidPrice');
  var spreadEl = document.getElementById('spreadVal');

  if (priceEl) priceEl.textContent = '$' + formatPrice(t.price);
  var chg = parseFloat(t.change);
  if (changeEl) {
    changeEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
    changeEl.className = chg >= 0 ? 'price-change green' : 'price-change red';
  }
  if (tradeEl) tradeEl.value = formatPrice(t.price);

  // Orderbook mid price from depth
  if (depthData.bids.length > 0 && depthData.asks.length > 0) {
    var midPrice = (depthData.bids[0].price + depthData.asks[0].price) / 2;
    if (midEl) midEl.textContent = '$' + formatPrice(midPrice);
    var spread = depthData.asks[0].price - depthData.bids[0].price;
    if (spreadEl) spreadEl.textContent = formatPrice(spread);
  }
}

// ============================================================
// TradingView Lightweight Charts
// ============================================================

var tvChart = null;
var tvCandleSeries = null;
var tvVolumeSeries = null;
var tvMa7Series = null;
var tvMa25Series = null;

function initTVChart() {
  var container = document.getElementById('chartArea');
  if (!container || !window.LightweightCharts) return;

  tvChart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 380,
    layout: { background: { color: 'transparent' }, textColor: '#8ba3c7', fontFamily: 'Outfit, sans-serif' },
    grid: { vertLines: { color: 'rgba(56,189,248,0.04)' }, horzLines: { color: 'rgba(56,189,248,0.04)' } },
    crosshair: { mode: 0 },
    rightPriceScale: { borderColor: 'rgba(56,189,248,0.1)' },
    timeScale: { borderColor: 'rgba(56,189,248,0.1)', timeVisible: true, secondsVisible: false }
  });

  tvCandleSeries = tvChart.addCandlestickSeries({
    upColor: '#22c55e', downColor: '#ef4444',
    borderUpColor: '#22c55e', borderDownColor: '#ef4444',
    wickUpColor: '#22c55e', wickDownColor: '#ef4444'
  });

  tvVolumeSeries = tvChart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol'
  });
  tvChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

  tvMa7Series = tvChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5 });
  tvMa25Series = tvChart.addLineSeries({ color: '#a78bfa', lineWidth: 1.5 });

  window.addEventListener('resize', function() {
    if (tvChart && container) tvChart.applyOptions({ width: container.clientWidth });
  });
}

function updateTVChart() {
  if (!tvCandleSeries || klineData.length === 0) return;

  var candles = klineData.map(function(d) {
    return { time: Math.floor(d.time / 1000), open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close) };
  });
  var volumes = klineData.map(function(d) {
    var c = parseFloat(d.close), o = parseFloat(d.open);
    return { time: Math.floor(d.time / 1000), value: parseFloat(d.volume), color: c >= o ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' };
  });

  tvCandleSeries.setData(candles);
  tvVolumeSeries.setData(volumes);

  // MA overlays
  if (indicators.ma7) {
    var ma7 = calcMA(klineData, 7).map(function(p) { return { time: Math.floor(klineData[p.idx].time / 1000), value: p.val }; });
    tvMa7Series.setData(ma7);
  } else { tvMa7Series.setData([]); }

  if (indicators.ma25) {
    var ma25 = calcMA(klineData, 25).map(function(p) { return { time: Math.floor(klineData[p.idx].time / 1000), value: p.val }; });
    tvMa25Series.setData(ma25);
  } else { tvMa25Series.setData([]); }

  tvChart.timeScale().fitContent();
}

function updateTVBar(bar) {
  if (!tvCandleSeries) return;
  var t = Math.floor(bar.time / 1000);
  tvCandleSeries.update({ time: t, open: parseFloat(bar.open), high: parseFloat(bar.high), low: parseFloat(bar.low), close: parseFloat(bar.close) });
  var c = parseFloat(bar.close), o = parseFloat(bar.open);
  tvVolumeSeries.update({ time: t, value: parseFloat(bar.volume), color: c >= o ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' });
}

// Volume is now handled by TV Charts - no separate drawVolume needed

// ============================================================
// Rendering - Orderbook
// ============================================================

function renderOrderbook() {
  var asksEl = document.getElementById('obAsks');
  var bidsEl = document.getElementById('obBids');
  if (!asksEl || !bidsEl) return;

  var maxQty = 0;
  depthData.asks.forEach(function(a) { if (a.qty > maxQty) maxQty = a.qty; });
  depthData.bids.forEach(function(b) { if (b.qty > maxQty) maxQty = b.qty; });

  var askHtml = '';
  var asks = depthData.asks.slice(0, 10).reverse();
  asks.forEach(function(a) {
    var pct = maxQty > 0 ? (a.qty / maxQty * 100) : 0;
    askHtml += '<div class="ob-row ask">';
    askHtml += '<div class="ob-bar" style="width:' + pct + '%"></div>';
    askHtml += '<span class="ob-price">' + formatPrice(a.price) + '</span>';
    askHtml += '<span class="ob-qty">' + a.qty.toFixed(4) + '</span>';
    askHtml += '</div>';
  });
  asksEl.innerHTML = askHtml;

  var bidHtml = '';
  depthData.bids.slice(0, 10).forEach(function(b) {
    var pct = maxQty > 0 ? (b.qty / maxQty * 100) : 0;
    bidHtml += '<div class="ob-row bid">';
    bidHtml += '<div class="ob-bar" style="width:' + pct + '%"></div>';
    bidHtml += '<span class="ob-price">' + formatPrice(b.price) + '</span>';
    bidHtml += '<span class="ob-qty">' + b.qty.toFixed(4) + '</span>';
    bidHtml += '</div>';
  });
  bidsEl.innerHTML = bidHtml;

  // Update mid price and spread
  if (depthData.bids.length > 0 && depthData.asks.length > 0) {
    var mid = (depthData.bids[0].price + depthData.asks[0].price) / 2;
    var midEl = document.getElementById('obMidPrice');
    if (midEl) midEl.textContent = '$' + formatPrice(mid);
    var spread = depthData.asks[0].price - depthData.bids[0].price;
    var spreadEl = document.getElementById('spreadVal');
    if (spreadEl) spreadEl.textContent = formatPrice(spread);
  }
}

// ============================================================
// Rendering - Positions
// ============================================================

function renderPositions() {
  var el = document.getElementById('positionsList');
  if (!el) return;
  var journal = loadJournal();
  var openTrades = journal.filter(function(e) { return e.status === 'open'; });

  if (openTrades.length === 0) {
    // Show team members with real ticker data, no fake PnL
    var html = '';
    TEAM.forEach(function(m, idx) {
      var pair = SYMBOL_LIST[idx % SYMBOL_LIST.length];
      var key = SYMBOL_MAP[pair].toUpperCase();
      var t = tickerData[key];
      var price = t ? formatPrice(t.price) : '--';
      var chg = t ? parseFloat(t.change) : 0;
      var chgCls = chg >= 0 ? 'green' : 'red';
      html += '<div class="position-row">';
      html += '<div class="pos-avatar" style="background:' + m.color + '">' + m.init + '</div>';
      html += '<div class="pos-info">';
      html += '<div class="pos-name">' + m.name + ' <span class="tag-muted">$' + m.capital + ' 本金</span></div>';
      html += '<div class="pos-detail">' + pair + ' $' + price + ' <span class="' + chgCls + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span></div>';
      html += '</div>';
      html += '<div class="pos-pnl ' + chgCls + '">观望中</div>';
      html += '</div>';
    });
    el.innerHTML = html;
    return;
  }

  var html = '';
  openTrades.forEach(function(e) {
    var member = TEAM.find(function(m) { return m.name === e.member; }) || TEAM[0];
    var sym = e.symbol || currentSymbol;
    var key = SYMBOL_MAP[sym] ? SYMBOL_MAP[sym].toUpperCase() : '';
    var t = tickerData[key];
    var curPrice = t ? parseFloat(t.price) : 0;
    var entry = parseFloat(e.entryPrice) || 0;
    var qty = parseFloat(e.amount) || 0;
    var lev = parseFloat(e.leverage) || 1;
    var pnl = 0;
    if (entry > 0 && curPrice > 0 && qty > 0) {
      pnl = e.side === 'long' ? (curPrice - entry) * qty * lev : (entry - curPrice) * qty * lev;
    }
    var pnlCls = pnl >= 0 ? 'green' : 'red';
    var pnlStr = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
    var side = e.side === 'long' ? 'LONG' : 'SHORT';
    var sideCls = e.side === 'long' ? 'tag-long' : 'tag-short';

    html += '<div class="position-row">';
    html += '<div class="pos-avatar" style="background:' + member.color + '">' + member.init + '</div>';
    html += '<div class="pos-info">';
    html += '<div class="pos-name">' + member.name + ' <span class="' + sideCls + '">' + side + ' ' + lev + 'x</span></div>';
    html += '<div class="pos-detail">' + sym + ' 入场 $' + formatPrice(entry) + ' → $' + formatPrice(curPrice) + '</div>';
    html += '</div>';
    html += '<div class="pos-pnl ' + pnlCls + '">' + pnlStr + '</div>';
    html += '</div>';
  });
  el.innerHTML = html;
}

// ============================================================
// Rendering - Strategies
// ============================================================

function renderStrategies() {
  var el = document.getElementById('strategyList');
  if (!el) return;
  var stats = calcStrategyStats();
  var journal = loadJournal();
  var html = '';

  STRATS.forEach(function(strat) {
    var name = strat.name;
    var s = stats.find(function(x) { return x.name === name; });
    var openCount = journal.filter(function(e) { return e.strategy === name && e.status === 'open'; }).length;
    var total = s ? s.total : 0;
    var pnl = s ? s.totalPnl : 0;
    var winRate = s ? s.winRate : 0;
    var status = openCount > 0 ? 'running' : (total > 0 ? 'paused' : 'stopped');
    var statusCls = status === 'running' ? 'st-run' : (status === 'paused' ? 'st-pause' : 'st-stop');
    var statusTxt = status === 'running' ? '运行中' : (status === 'paused' ? '已完成' : '待启动');
    var pnlCls = pnl >= 0 ? 'green' : 'red';
    var pnlStr = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);

    html += '<div class="strat-card" onclick="this.classList.toggle(\'expanded\')">';
    html += '<div class="strat-header">';
    html += '<span class="strat-name">' + name + '</span>';
    html += '<span class="strat-status ' + statusCls + '">' + statusTxt + '</span>';
    html += '</div>';
    html += '<div class="strat-stats">';
    html += '<span>交易 ' + total + ' 笔</span>';
    html += '<span>胜率 ' + winRate.toFixed(0) + '%</span>';
    html += '<span class="' + pnlCls + '">PnL: ' + pnlStr + '</span>';
    html += '</div>';
    html += '<div class="strat-progress"><div class="strat-bar" style="width:' + Math.min(100, winRate) + '%;background:' + (pnl >= 0 ? 'var(--green)' : 'var(--red)') + '"></div></div>';
    html += '<div class="strat-detail">';
    html += '<div class="strat-detail-title">策略原理</div>';
    html += '<div class="strat-detail-text">' + escapeHtml(strat.desc) + '</div>';
    if (strat.rules) {
      html += '<div class="strat-detail-title" style="margin-top:8px">交易规则</div>';
      html += '<div class="strat-detail-text strat-rules">' + escapeHtml(strat.rules).replace(/\|/g, '<br>') + '</div>';
    }
    if (strat.backtest) {
      html += '<div class="strat-detail-title" style="margin-top:8px">回测数据</div>';
      html += '<div class="strat-detail-text strat-backtest">' + escapeHtml(strat.backtest) + '</div>';
    }
    html += '</div>';
    html += '</div>';
  });
  el.innerHTML = html;
}

// ============================================================
// Rendering - Signals
// ============================================================

function renderSignals(filter) {
  var el = document.getElementById('signalFeed');
  if (!el) return;
  var list = SIGNALS;
  if (filter && filter !== 'all') {
    list = SIGNALS.filter(function(s) { return s.type === filter; });
  }
  var html = '';
  list.forEach(function(s, idx) {
    var icon = s.type === 'long' ? '▲' : '▼';
    var cls = s.type === 'long' ? 'sig-long' : 'sig-short';
    html += '<div class="signal-row ' + cls + '">';
    html += '<div class="sig-avatar" style="background:' + s.color + '">' + s.init + '</div>';
    html += '<div class="sig-body">';
    html += '<div class="sig-text">' + icon + ' ' + escapeHtml(s.text) + '</div>';
    html += '<div class="sig-meta">' + escapeHtml(s.member) + ' · ' + (s.time || timeAgo(idx)) + ' · ' + escapeHtml(s.pair) + '</div>';
    html += '</div>';
    html += '</div>';
  });
  if (list.length === 0) {
    html = '<div class="signal-empty">暂无信号</div>';
  }
  el.innerHTML = html;
}

// ============================================================
// Rendering - Trading Journal
// ============================================================

function renderJournal(filterStrat) {
  var el = document.getElementById('journalList');
  if (!el) return;
  var journal = loadJournal();
  if (filterStrat && filterStrat !== 'all') {
    journal = journal.filter(function(e) { return e.strategy === filterStrat; });
  }
  if (journal.length === 0) {
    el.innerHTML = '<div class="journal-empty">暂无交易记录</div>';
    return;
  }
  var html = '';
  journal.forEach(function(e) {
    var sideCls = e.side === 'long' ? 'j-long' : 'j-short';
    var sideText = e.side === 'long' ? 'LONG' : 'SHORT';
    var statusCls = e.status === 'open' ? 'j-open' : 'j-closed';
    var statusText = e.status === 'open' ? '持仓中' : '已平仓';
    var dt = new Date(e.timestamp);
    var timeStr = dt.toLocaleDateString('zh-CN') + ' ' + dt.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
    var pnlHtml = '';
    if (e.status === 'closed' && e.pnl !== null) {
      var pCls = e.pnl >= 0 ? 'green' : 'red';
      var pSign = e.pnl >= 0 ? '+' : '';
      pnlHtml = '<span class="j-pnl ' + pCls + '">' + pSign + '$' + e.pnl.toFixed(2) + ' (' + pSign + e.pnlPct.toFixed(1) + '%)</span>';
    }
    var srcIcon = e.source === 'auto' ? '🤖' : '👤';

    html += '<div class="journal-row">';
    html += '<div class="j-head">';
    html += '<span class="j-side ' + sideCls + '">' + sideText + '</span>';
    html += '<span class="j-symbol">' + (e.symbol || '--') + '</span>';
    html += '<span class="j-status ' + statusCls + '">' + statusText + '</span>';
    html += '<span class="j-src">' + srcIcon + '</span>';
    html += '<span class="j-time">' + timeStr + '</span>';
    html += '</div>';
    html += '<div class="j-body">';
    html += '<div class="j-detail">';
    html += '<span>入场: $' + formatPrice(e.entryPrice) + '</span>';
    if (e.amount && e.amount !== '0') html += '<span>数量: ' + e.amount + '</span>';
    if (e.leverage && e.leverage !== '1') html += '<span>杠杆: ' + e.leverage + 'x</span>';
    if (e.closePrice) html += '<span>平仓: $' + formatPrice(e.closePrice) + '</span>';
    html += pnlHtml;
    html += '</div>';
    html += '<div class="j-strat">策略: <b>' + escapeHtml(e.strategy || '--') + '</b>';
    if (e.method) html += ' · 方法: ' + escapeHtml(e.method);
    html += '</div>';
    if (e.note) html += '<div class="j-note">' + escapeHtml(e.note) + '</div>';
    if (e.closeNote) html += '<div class="j-note">平仓心得: ' + escapeHtml(e.closeNote) + '</div>';
    html += '</div>';
    html += '<div class="j-actions">';
    if (e.status === 'open') {
      html += '<button class="j-btn j-close-btn" data-id="' + e.id + '">平仓</button>';
    }
    html += '<button class="j-btn j-del-btn" data-id="' + e.id + '">删除</button>';
    html += '</div>';
    html += '</div>';
  });
  el.innerHTML = html;
  bindJournalActions();
}

function bindJournalActions() {
  // Close position buttons
  document.querySelectorAll('.j-close-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      var key = SYMBOL_MAP[currentSymbol] ? SYMBOL_MAP[currentSymbol].toUpperCase() : '';
      var curPrice = tickerData[key] ? tickerData[key].price : '0';
      var closeNote = prompt('平仓心得（可选）：', '');
      closeJournalEntry(id, curPrice, closeNote || '');
      renderJournal();
      renderAnalytics();
    });
  });
  // Delete buttons
  document.querySelectorAll('.j-del-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = btn.getAttribute('data-id');
      if (confirm('确认删除此交易记录？')) {
        deleteJournalEntry(id);
        renderJournal();
        renderAnalytics();
      }
    });
  });
}

// ============================================================
// Rendering - Strategy Analytics
// ============================================================

function renderAnalytics() {
  var statsEl = document.getElementById('analyticsStats');
  var listEl = document.getElementById('analyticsList');
  if (!statsEl && !listEl) return;

  var overall = calcOverallStats();
  var stratStats = calcStrategyStats();

  if (statsEl) {
    var pCls = overall.totalPnl >= 0 ? 'green' : 'red';
    var pSign = overall.totalPnl >= 0 ? '+' : '';
    statsEl.innerHTML =
      '<div class="a-stat"><div class="a-val">' + overall.totalTrades + '</div><div class="a-label">总交易</div></div>' +
      '<div class="a-stat"><div class="a-val">' + overall.openTrades + '</div><div class="a-label">持仓中</div></div>' +
      '<div class="a-stat"><div class="a-val ' + pCls + '">' + pSign + '$' + overall.totalPnl.toFixed(2) + '</div><div class="a-label">总盈亏</div></div>' +
      '<div class="a-stat"><div class="a-val">' + overall.winRate.toFixed(1) + '%</div><div class="a-label">胜率</div></div>' +
      '<div class="a-stat"><div class="a-val green">+$' + overall.maxWin.toFixed(2) + '</div><div class="a-label">最大盈利</div></div>' +
      '<div class="a-stat"><div class="a-val red">-$' + Math.abs(overall.maxLoss).toFixed(2) + '</div><div class="a-label">最大亏损</div></div>';
  }

  if (listEl) {
    if (stratStats.length === 0) {
      listEl.innerHTML = '<div class="journal-empty">暂无已平仓数据</div>';
      return;
    }
    var html = '';
    stratStats.forEach(function(s) {
      var pCls = s.totalPnl >= 0 ? 'green' : 'red';
      var pSign = s.totalPnl >= 0 ? '+' : '';
      var barW = Math.min(100, s.winRate);
      html += '<div class="a-row">';
      html += '<div class="a-row-head">';
      html += '<span class="a-name">' + s.name + '</span>';
      html += '<span class="a-pnl ' + pCls + '">' + pSign + '$' + s.totalPnl.toFixed(2) + '</span>';
      html += '</div>';
      html += '<div class="a-row-body">';
      html += '<span>交易 ' + s.total + ' 次</span>';
      html += '<span>胜 ' + s.wins + ' / 负 ' + s.losses + '</span>';
      html += '<span>胜率 ' + s.winRate.toFixed(1) + '%</span>';
      html += '<span>均盈 ' + (s.avgPnl >= 0 ? '+' : '') + '$' + s.avgPnl.toFixed(2) + '</span>';
      html += '</div>';
      html += '<div class="a-bar-wrap"><div class="a-bar" style="width:' + barW + '%;background:' + (s.totalPnl >= 0 ? 'var(--green)' : 'var(--red)') + '"></div></div>';
      html += '</div>';
    });
    listEl.innerHTML = html;
  }
}

// ============================================================
// Interaction - Switch Symbol
// ============================================================

function switchSymbol(sym) {
  if (!SYMBOL_MAP[sym]) return;
  currentSymbol = sym;
  klineData = [];
  depthData = { asks: [], bids: [] };
  tradeMarkers = [];
  fetchKlineHistory(currentSymbol, currentInterval, function() {
    updateTVChart();
  });
  connectKlineWS();
  connectDepthWS();
  updatePriceDisplay();
}

// ============================================================
// Interaction - Event Bindings
// ============================================================

function initInteractions() {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      var panel = document.getElementById(target);
      if (panel) panel.classList.add('active');
    });
  });

  // Timeframe buttons
  document.querySelectorAll('.tf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tf-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tf = btn.getAttribute('data-tf');
      if (TF_MAP[tf]) {
        currentInterval = TF_MAP[tf];
      } else {
        currentInterval = tf;
      }
      fetchKlineHistory(currentSymbol, currentInterval, function() {
        updateTVChart();
      });
      connectKlineWS();
    });
  });

  // Signal filter buttons
  document.querySelectorAll('.filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      renderSignals(f);
    });
  });

  // Buy/Sell toggle
  var btnBuy = document.getElementById('btnBuy');
  var btnSell = document.getElementById('btnSell');
  if (btnBuy) {
    btnBuy.addEventListener('click', function() {
      btnBuy.classList.add('active');
      if (btnSell) btnSell.classList.remove('active');
    });
  }
  if (btnSell) {
    btnSell.addEventListener('click', function() {
      btnSell.classList.add('active');
      if (btnBuy) btnBuy.classList.remove('active');
    });
  }

  // Leverage slider
  var levSlider = document.getElementById('leverageSlider');
  var levVal = document.getElementById('leverageVal');
  if (levSlider && levVal) {
    levSlider.addEventListener('input', function() {
      levVal.textContent = levSlider.value + 'x';
    });
  }

  // Percentage buttons — 基于真实可用余额计算
  document.querySelectorAll('.pct-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pct-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var pct = parseInt(btn.getAttribute('data-pct')) || 0;
      var amountEl = document.getElementById('tradeAmount');
      var priceEl = document.getElementById('tradePrice');
      if (amountEl && priceEl) {
        var member = TEAM[_memberRoundRobin % TEAM.length];
        var available = TT.getAvailableBalance(member.name);
        var lev = levSlider ? parseInt(levSlider.value) : 1;
        var price = parseFloat(priceEl.value.replace(/,/g, '')) || 1;
        // 可用余额 × 杠杆 × 百分比 / 价格 = 最大数量
        var maxQty = (available * lev * pct / 100) / price;
        amountEl.value = maxQty > 0 ? maxQty.toFixed(4) : '0';
        // 更新预估成本显示
        updateCostPreview();
      }
    });
  });

  // Execute trade button — 接入 TT.openPosition() 引擎
  var btnExec = document.getElementById('btnExecute');
  if (btnExec) {
    btnExec.addEventListener('click', function() {
      var side = btnBuy && btnBuy.classList.contains('active') ? 'long' : 'short';
      var priceEl = document.getElementById('tradePrice');
      var amountEl = document.getElementById('tradeAmount');
      var stratEl = document.getElementById('tradeStrategy');
      var methodEl = document.getElementById('tradeMethod');
      var noteEl = document.getElementById('tradeNote');
      var price = priceEl ? priceEl.value.replace(/,/g, '') : '0';
      var amount = amountEl ? amountEl.value : '0';
      var strategy = stratEl ? stratEl.value : '手动交易';
      var method = methodEl ? methodEl.value : '';
      var note = noteEl ? noteEl.value : '';
      var leverage = levSlider ? levSlider.value : '1';

      // 成员轮询分配（不再随机）
      var member = TEAM[_memberRoundRobin % TEAM.length];
      _memberRoundRobin++;
      var direction = side === 'long' ? '买入' : '卖出';

      // 收集当前指标快照
      var indSnap = collectIndicatorSnapshot();

      // 交易天平：开仓前多空论据
      var balance = TTA.calcTradeBalance(currentSymbol, side, indSnap);

      // 急救模式检测
      var emergency = TTA.checkEmergency(member.name);
      if (emergency.triggered) {
        if (!confirm('⚠️ 风控警告: ' + emergency.reason + '\n确定继续交易吗？')) return;
      }

      // 交易天平警告
      if (balance.recommendation === 'stop') {
        if (!confirm('🛑 交易天平评分 ' + balance.score.toFixed(0) + '/100\n反对理由:\n' + balance.cons.join('\n') + '\n确定继续？')) return;
      }

      // 通过引擎开仓
      var result = TT.openPosition({
        member: member.name,
        symbol: currentSymbol,
        side: side,
        price: price,
        quantity: amount,
        leverage: leverage,
        strategy: strategy,
        source: 'manual',
        note: (method ? '方法: ' + method + ' | ' : '') + note,
        indicators: indSnap
      });

      if (!result.ok) {
        alert('❌ 开仓失败:\n' + result.errors.join('\n'));
        return;
      }

      // 同时写入旧日志系统（兼容）
      addJournalEntry({
        side: side, symbol: currentSymbol, entryPrice: price,
        amount: amount, leverage: leverage, strategy: strategy,
        method: method, note: note, member: member.name,
        capital: member.capital, source: 'manual',
        positionId: result.position.id,
        margin: result.margin, fee: result.fee,
        liquidationPrice: result.position.liquidationPrice
      });

      // AI 信号评分
      var signal = TTA.calcSignalScore(indSnap);

      SIGNALS.unshift({
        type: side,
        text: direction + ' ' + currentSymbol + ' @ $' + formatPrice(price) + ' x ' + amount + ' ' + leverage + 'x [' + strategy + '] 保证金$' + result.margin.toFixed(2) + ' 手续费$' + result.fee.toFixed(2),
        member: member.name, init: member.init, color: member.color,
        time: '刚刚', pair: currentSymbol,
        signal: signal
      });
      if (SIGNALS.length > 50) SIGNALS.length = 50;

      renderSignals();
      renderJournal();
      renderAnalytics();
      renderPositions();
      updateStatsCards();
      renderLeaderboard();
      renderRiskPanel();
      renderQuantDashboard();

      if (noteEl) noteEl.value = '';
      if (methodEl) methodEl.value = '';

      // 显示开仓成功提示
      showTradeToast(direction + ' ' + currentSymbol + ' 成功', 'margin: $' + result.margin.toFixed(2) + ' | 强平价: $' + formatPrice(result.position.liquidationPrice), side === 'long' ? 'green' : 'red');
    });
  }

  // Modal open/close
  var modalOverlay = document.getElementById('modalOverlay');
  var btnAddStrat = document.getElementById('btnAddStrategy');
  var modalClose = document.getElementById('modalClose');
  if (btnAddStrat && modalOverlay) {
    btnAddStrat.addEventListener('click', function() {
      modalOverlay.classList.add('show');
    });
  }
  if (modalClose && modalOverlay) {
    modalClose.addEventListener('click', function() {
      modalOverlay.classList.remove('show');
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) modalOverlay.classList.remove('show');
    });
  }

  // Symbol select dropdown
  var symSelect = document.getElementById('symbolSelect');
  if (symSelect) {
    symSelect.addEventListener('change', function() {
      switchSymbol(symSelect.value);
    });
  }

  // Indicator toggle buttons
  document.querySelectorAll('.ind-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var ind = btn.getAttribute('data-ind');
      if (ind && typeof indicators[ind] !== 'undefined') {
        indicators[ind] = !indicators[ind];
        btn.classList.toggle('active', indicators[ind]);
        detectSignals(klineData);
        updateTVChart();
        updateChartIndicators();
      }
    });
    // Set initial active state
    var ind = btn.getAttribute('data-ind');
    if (ind && indicators[ind]) {
      btn.classList.add('active');
    }
  });

  // Journal filter dropdown
  var jFilter = document.getElementById('journalFilter');
  if (jFilter) {
    jFilter.addEventListener('change', function() {
      renderJournal(jFilter.value);
    });
  }

  // Export journal to CSV
  var btnExport = document.getElementById('btnExportJournal');
  if (btnExport) {
    btnExport.addEventListener('click', function() {
      var journal = loadJournal();
      if (journal.length === 0) { alert('暂无交易记录'); return; }
      var header = '时间,方向,交易对,入场价,数量,杠杆,策略,方法,心得,状态,平仓价,盈亏,盈亏%,来源\n';
      var rows = journal.map(function(e) {
        return [
          e.timestamp, e.side, e.symbol, e.entryPrice, e.amount, e.leverage,
          '"' + (e.strategy || '') + '"', '"' + (e.method || '') + '"',
          '"' + (e.note || '').replace(/"/g, '""') + '"',
          e.status, e.closePrice || '', e.pnl !== null ? e.pnl.toFixed(2) : '',
          e.pnlPct !== null ? e.pnlPct.toFixed(1) : '', e.source
        ].join(',');
      }).join('\n');
      var blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'trading_journal_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Export journal to JSON (for AI analysis)
  var btnJSON = document.getElementById('btnExportJSON');
  if (btnJSON) {
    btnJSON.addEventListener('click', function() {
      var journal = loadJournal();
      if (journal.length === 0) { alert('暂无交易记录'); return; }
      var data = {
        exportTime: new Date().toISOString(),
        team: TEAM.map(function(m) { return { name: m.name, capital: m.capital }; }),
        totalTrades: journal.length,
        trades: journal
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'trading_journal_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Window resize - TV Charts handles its own resize
  // (handled in initTVChart)

  // 影子交易按钮
  var btnShadow = document.getElementById('btnShadowTrade');
  if (btnShadow) {
    btnShadow.addEventListener('click', function() {
      var side = document.getElementById('btnBuy') && document.getElementById('btnBuy').classList.contains('active') ? 'long' : 'short';
      var priceEl = document.getElementById('tradePrice');
      var price = priceEl ? priceEl.value.replace(/,/g, '') : '0';
      if (!price || parseFloat(price) <= 0) { alert('请先输入价格'); return; }
      TTA.addShadowTrade({ symbol: currentSymbol, side: side, price: price });
      renderShadowPanel();
      showTradeToast('👻 影子下单', side === 'long' ? '做多' : '做空' + ' ' + currentSymbol + ' @ $' + formatPrice(price), 'amber');
    });
  }
}

// ============================================================
// Update Top Stats Cards with Real Data
// ============================================================

function updateStatsCards() {
  var overall = calcOverallStats();
  var journal = loadJournal();

  // 1. Total PnL
  var pnlEl = document.getElementById('totalPnl');
  if (pnlEl) {
    var p = overall.totalPnl;
    pnlEl.textContent = (p >= 0 ? '+$' : '-$') + Math.abs(p).toFixed(2);
    pnlEl.className = 'stat-value ' + (p >= 0 ? 'green' : 'red');
  }

  // 2. Total position value + avg leverage
  var openTrades = journal.filter(function(e) { return e.status === 'open'; });
  var totalVal = 0, levSum = 0;
  openTrades.forEach(function(e) {
    var sym = e.symbol || currentSymbol;
    var key = SYMBOL_MAP[sym] ? SYMBOL_MAP[sym].toUpperCase() : '';
    var t = tickerData[key];
    var price = t ? parseFloat(t.price) : 0;
    var qty = parseFloat(e.amount) || 0;
    totalVal += price * qty;
    levSum += parseFloat(e.leverage) || 1;
  });
  var avgLev = openTrades.length > 0 ? (levSum / openTrades.length).toFixed(1) : '0';
  var valEl = document.getElementById('totalValue');
  if (valEl) valEl.textContent = '$' + totalVal.toLocaleString('en-US', {maximumFractionDigits: 0});
  var levEl = document.getElementById('avgLeverage');
  if (levEl) levEl.textContent = '平均杠杆 ' + avgLev + 'x';

  // 3. Win rate
  var wrEl = document.getElementById('winRate');
  if (wrEl) wrEl.textContent = overall.closedTrades > 0 ? overall.winRate.toFixed(1) + '%' : '--';
  var tcEl = document.getElementById('tradeCount');
  if (tcEl) tcEl.textContent = '近30日 · 共 ' + overall.totalTrades + ' 笔';

  // 4. Active members + running strategies
  var activeNames = {};
  openTrades.forEach(function(e) { if (e.member) activeNames[e.member] = true; });
  var amEl = document.getElementById('activeMembers');
  if (amEl) amEl.innerHTML = Object.keys(activeNames).length + ' <span class="stat-unit">/ ' + TEAM.length + ' 人</span>';
  var runCount = 0;
  STRATS.forEach(function(strat) {
    if (journal.some(function(e) { return e.strategy === strat.name && e.status === 'open'; })) runCount++;
  });
  var rsEl = document.getElementById('runningStrats');
  if (rsEl) rsEl.textContent = runCount + ' 个策略运行中';
}

// ============================================================
// Equity Curve + Drawdown
// ============================================================

var tvEquityChart = null;
var tvEquitySeries = null;

function initEquityChart() {
  var container = document.getElementById('equityChart');
  if (!container || !window.LightweightCharts) return;
  tvEquityChart = LightweightCharts.createChart(container, {
    width: container.clientWidth, height: 220,
    layout: { background: { color: 'transparent' }, textColor: '#8ba3c7', fontFamily: 'Outfit' },
    grid: { vertLines: { color: 'rgba(56,189,248,0.04)' }, horzLines: { color: 'rgba(56,189,248,0.04)' } },
    rightPriceScale: { borderColor: 'rgba(56,189,248,0.1)' },
    timeScale: { borderColor: 'rgba(56,189,248,0.1)' },
    crosshair: { mode: 0 }
  });
  tvEquitySeries = tvEquityChart.addAreaSeries({
    topColor: 'rgba(34,211,238,0.3)', bottomColor: 'rgba(34,211,238,0.02)',
    lineColor: '#22d3ee', lineWidth: 2
  });
  window.addEventListener('resize', function() {
    if (tvEquityChart && container) tvEquityChart.applyOptions({ width: container.clientWidth });
  });
}

function renderEquityCurve() {
  if (!tvEquitySeries) return;
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed' && e.closedAt; });
  closed.sort(function(a, b) { return new Date(a.closedAt) - new Date(b.closedAt); });

  var totalCapital = TEAM.reduce(function(s, m) { return s + m.capital; }, 0);
  var equity = totalCapital;
  var peak = equity;
  var maxDD = 0;
  var data = [{ time: Math.floor(Date.now() / 1000) - 86400 * 30, value: totalCapital }];

  closed.forEach(function(e) {
    equity += (e.pnl || 0);
    if (equity > peak) peak = equity;
    var dd = peak > 0 ? ((peak - equity) / peak * 100) : 0;
    if (dd > maxDD) maxDD = dd;
    data.push({ time: Math.floor(new Date(e.closedAt).getTime() / 1000), value: equity });
  });

  tvEquitySeries.setData(data);

  var statsEl = document.getElementById('equityStats');
  if (statsEl) {
    var ret = totalCapital > 0 ? ((equity - totalCapital) / totalCapital * 100) : 0;
    var cls = ret >= 0 ? 'green' : 'red';
    statsEl.innerHTML = '<span class="' + cls + '">净值 $' + equity.toFixed(0) + '</span>' +
      ' · <span>收益率 <b class="' + cls + '">' + (ret >= 0 ? '+' : '') + ret.toFixed(1) + '%</b></span>' +
      ' · <span>最大回撤 <b class="red">' + maxDD.toFixed(1) + '%</b></span>';
  }
}

// ============================================================
// Leaderboard
// ============================================================

function renderLeaderboard() {
  var el = document.getElementById('leaderboard');
  if (!el) return;
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });

  var board = TEAM.map(function(m) {
    var trades = closed.filter(function(e) { return e.member === m.name; });
    var pnl = 0, wins = 0;
    trades.forEach(function(e) { pnl += (e.pnl || 0); if (e.pnl > 0) wins++; });
    var wr = trades.length > 0 ? (wins / trades.length * 100) : 0;
    return { name: m.name, init: m.init, color: m.color, pnl: pnl, trades: trades.length, winRate: wr };
  });
  board.sort(function(a, b) { return b.pnl - a.pnl; });

  var html = '';
  board.forEach(function(m, i) {
    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    var cls = m.pnl >= 0 ? 'green' : 'red';
    html += '<div class="lb-row">';
    html += '<span class="lb-rank">' + medal + '</span>';
    html += '<span class="lb-avatar" style="background:' + m.color + '">' + m.init + '</span>';
    html += '<span class="lb-name">' + escapeHtml(m.name) + '</span>';
    html += '<span class="lb-stat">' + m.trades + '笔 · ' + m.winRate.toFixed(0) + '%</span>';
    html += '<span class="lb-pnl ' + cls + '">' + (m.pnl >= 0 ? '+' : '') + '$' + m.pnl.toFixed(2) + '</span>';
    html += '</div>';
  });
  if (board.length === 0) html = '<div class="signal-empty">暂无数据</div>';
  el.innerHTML = html;
}

// ============================================================
// Risk Control Panel
// ============================================================

function renderRiskPanel() {
  var el = document.getElementById('riskPanel');
  if (!el) return;
  var journal = loadJournal();
  var open = journal.filter(function(e) { return e.status === 'open'; });
  var closed = journal.filter(function(e) { return e.status === 'closed'; });
  var totalCapital = TEAM.reduce(function(s, m) { return s + m.capital; }, 0);

  // Calculate risk metrics
  var totalExposure = 0;
  open.forEach(function(e) {
    var qty = parseFloat(e.amount) || 0;
    var lev = parseFloat(e.leverage) || 1;
    var price = parseFloat(e.entryPrice) || 0;
    totalExposure += qty * price * lev;
  });
  var exposurePct = totalCapital > 0 ? (totalExposure / totalCapital * 100) : 0;

  // Recent loss streak
  var recent = closed.slice(0, 10);
  var streak = 0;
  for (var i = 0; i < recent.length; i++) {
    if ((recent[i].pnl || 0) < 0) streak++; else break;
  }

  // Total unrealized PnL
  var unrealPnl = 0;
  open.forEach(function(e) {
    var sym = e.symbol || currentSymbol;
    var key = SYMBOL_MAP[sym] ? SYMBOL_MAP[sym].toUpperCase() : '';
    var t = tickerData[key];
    var cur = t ? parseFloat(t.price) : 0;
    var entry = parseFloat(e.entryPrice) || 0;
    var qty = parseFloat(e.amount) || 0;
    var lev = parseFloat(e.leverage) || 1;
    if (entry > 0 && cur > 0) {
      unrealPnl += e.side === 'long' ? (cur - entry) * qty * lev : (entry - cur) * qty * lev;
    }
  });
  var drawdownPct = totalCapital > 0 ? (Math.min(0, unrealPnl) / totalCapital * -100) : 0;

  var html = '';
  html += riskItem('持仓敞口', exposurePct.toFixed(0) + '%', exposurePct > 500 ? 'red' : exposurePct > 200 ? 'amber' : 'green');
  html += riskItem('浮动盈亏', (unrealPnl >= 0 ? '+$' : '-$') + Math.abs(unrealPnl).toFixed(2), unrealPnl >= 0 ? 'green' : 'red');
  html += riskItem('当前回撤', drawdownPct.toFixed(1) + '%', drawdownPct > 7 ? 'red' : drawdownPct > 3 ? 'amber' : 'green');
  html += riskItem('连亏笔数', streak + ' 笔', streak >= 3 ? 'red' : streak >= 2 ? 'amber' : 'green');
  html += riskItem('活跃仓位', open.length + ' 个', open.length > 5 ? 'amber' : 'green');

  if (streak >= 3) html += '<div class="risk-warn">⚠️ 连续亏损3笔，建议暂停交易冷静30分钟</div>';
  if (drawdownPct > 7) html += '<div class="risk-warn">🚨 回撤超过7%，触发风控警告</div>';

  el.innerHTML = html;
}

function riskItem(label, value, color) {
  return '<div class="risk-row"><span class="risk-label">' + label + '</span><span class="risk-val ' + color + '">' + value + '</span></div>';
}

// ============================================================
// Init Function
// ============================================================

function init() {
  // === 引擎初始化 ===
  TT.initAccounts(TEAM);

  // Setup clock
  updateClock();
  setInterval(updateClock, 1000);

  // Render static content
  initTVChart();
  initEquityChart();
  renderStrategies();
  renderSignals();
  renderJournal();
  renderAnalytics();
  updateStatsCards();
  renderEquityCurve();
  renderLeaderboard();
  renderRiskPanel();
  renderQuantDashboard();
  renderSentimentPanel();
  renderShadowPanel();

  // Fetch initial ticker data
  fetchAllTickers(function() {
    updateTickerBar();
    updatePriceDisplay();
    renderPositions();
    updateStatsCards();
    // 同步标记价格到引擎
    syncMarkPrices();
  });

  // Fetch initial K-line data
  fetchKlineHistory(currentSymbol, currentInterval, function() {
    updateTVChart();
    updateChartIndicators();
  });

  // Connect WebSocket streams
  connectTickerWS();
  connectKlineWS();
  connectDepthWS();

  // Setup event bindings
  initInteractions();

  // === 新增: 数据源获取 ===
  fetchMarketData();
  setInterval(fetchMarketData, 60000); // 每分钟刷新

  // === 新增: 强平检测 (每5秒) ===
  setInterval(function() {
    var liquidated = TT.checkLiquidations();
    if (liquidated.length > 0) {
      liquidated.forEach(function(liq) {
        showTradeToast('⚠️ 强制平仓', '仓位已被强平，亏损保证金', 'red');
      });
      renderPositions();
      updateStatsCards();
      renderRiskPanel();
    }
  }, 5000);

  // === 新增: 影子交易结算 (每分钟) ===
  setInterval(function() {
    var key = SYMBOL_MAP[currentSymbol] ? SYMBOL_MAP[currentSymbol].toUpperCase() : '';
    var t = tickerData[key];
    if (t) TTA.resolveShadows(currentSymbol, parseFloat(t.price));
    renderShadowPanel();
  }, 60000);

  // Refresh positions periodically
  setInterval(function() {
    fetchAllTickers(function() {
      updateTickerBar();
      updatePriceDisplay();
      renderPositions();
      updateStatsCards();
      renderRiskPanel();
      syncMarkPrices();
    });
  }, 30000);

  // 成本预览实时更新
  var tradeAmountEl = document.getElementById('tradeAmount');
  var tradePriceEl = document.getElementById('tradePrice');
  if (tradeAmountEl) tradeAmountEl.addEventListener('input', updateCostPreview);
  if (tradePriceEl) tradePriceEl.addEventListener('input', updateCostPreview);
}

// ============================================================
// 图表指标可视化 — 布林带叠加 + RSI/MACD 副图
// ============================================================

var tvBollUpper = null, tvBollLower = null, tvBollMid = null;

function updateChartIndicators() {
  if (!tvChart || klineData.length < 20) return;

  // 布林带叠加到主图
  if (indicators.boll) {
    var bollData = calcBoll(klineData, 20);
    var upper = [], lower = [], mid = [];
    bollData.forEach(function(b) {
      var t = Math.floor(klineData[b.idx].time / 1000);
      upper.push({ time: t, value: b.upper });
      lower.push({ time: t, value: b.lower });
      mid.push({ time: t, value: b.mid });
    });
    if (!tvBollUpper) {
      tvBollUpper = tvChart.addLineSeries({ color: 'rgba(168,85,247,0.5)', lineWidth: 1, lineStyle: 2 });
      tvBollLower = tvChart.addLineSeries({ color: 'rgba(168,85,247,0.5)', lineWidth: 1, lineStyle: 2 });
      tvBollMid = tvChart.addLineSeries({ color: 'rgba(168,85,247,0.3)', lineWidth: 1, lineStyle: 1 });
    }
    tvBollUpper.setData(upper);
    tvBollLower.setData(lower);
    tvBollMid.setData(mid);
  } else {
    if (tvBollUpper) { tvBollUpper.setData([]); tvBollLower.setData([]); tvBollMid.setData([]); }
  }

  // 更新图表标签
  updateChartTags();
}

function updateChartTags() {
  var el = document.getElementById('chartTags');
  if (!el || klineData.length < 2) return;
  var html = '';

  // RSI 标签
  var rsiArr = calcRSI(klineData, 14);
  if (rsiArr.length > 0) {
    var rsi = rsiArr[rsiArr.length - 1].val;
    var rsiCls = rsi > 70 ? 'red' : rsi < 30 ? 'green' : '';
    html += '<span class="chart-tag ' + rsiCls + '">RSI ' + rsi.toFixed(1) + '</span>';
  }

  // MACD 标签
  var macdArr = calcMACD(klineData);
  if (macdArr.length > 0) {
    var m = macdArr[macdArr.length - 1];
    var mCls = m.hist > 0 ? 'green' : 'red';
    html += '<span class="chart-tag ' + mCls + '">MACD ' + m.hist.toFixed(2) + '</span>';
  }

  // 布林带标签
  if (indicators.boll) {
    var bollArr = calcBoll(klineData, 20);
    if (bollArr.length > 0) {
      var b = bollArr[bollArr.length - 1];
      var bw = ((b.upper - b.lower) / b.mid * 100).toFixed(1);
      html += '<span class="chart-tag">BOLL宽 ' + bw + '%</span>';
    }
  }

  // AI 信号评分
  var snap = collectIndicatorSnapshot();
  var sig = TTA.calcSignalScore(snap);
  var sigCls = sig.score >= 60 ? 'green' : sig.score <= 40 ? 'red' : '';
  html += '<span class="chart-tag ' + sigCls + '">AI ' + sig.score + '/100 ' + sig.strength + '</span>';

  el.innerHTML = html;
}

// ============================================================
// 量化仪表盘 — 核心盈利指标
// ============================================================

function renderQuantDashboard() {
  var el = document.getElementById('quantDashboard');
  if (!el) return;
  var html = '';

  TEAM.forEach(function(m) {
    var metrics = TTA.calcCoreMetrics(m.name);
    var acc = TT.getAccount(m.name);
    if (!acc) return;

    var impulse = TTA.detectImpulseTrades(m.name);
    var spectrum = TTA.calcTradeSpectrum(m.name);

    html += '<div class="quant-member">';
    html += '<div class="quant-header">';
    html += '<span class="pos-avatar" style="background:' + m.color + ';width:28px;height:28px;font-size:11px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%">' + m.init + '</span>';
    html += '<span class="quant-name">' + m.name + '</span>';
    html += '<span class="quant-bal">$' + acc.walletBalance.toFixed(2) + '</span>';
    html += '</div>';

    if (!metrics) {
      html += '<div class="quant-empty">暂无已平仓数据</div>';
    } else {
      html += '<div class="quant-grid">';
      html += quantCell('期望值', '$' + metrics.expectancy.toFixed(2), metrics.expectancy > 0 ? 'green' : 'red');
      html += quantCell('胜率', (metrics.winRate * 100).toFixed(1) + '%', metrics.winRate > 0.5 ? 'green' : '');
      html += quantCell('盈亏比', metrics.riskReward === Infinity ? '∞' : metrics.riskReward.toFixed(2), metrics.riskReward > 1.5 ? 'green' : 'red');
      html += quantCell('凯利仓位', (metrics.kelly * 100).toFixed(1) + '%', '');
      html += quantCell('最大连亏', metrics.maxConsecLoss + '笔', metrics.maxConsecLoss >= 3 ? 'red' : '');
      html += quantCell('费率侵蚀', metrics.feeErosion.toFixed(1) + '%', metrics.feeErosion > 10 ? 'red' : '');
      html += '</div>';
    }

    // 冲动交易检测
    if (impulse.impulseCount > 0) {
      var impCls = impulse.impulsePnl < 0 ? 'red' : 'green';
      html += '<div class="quant-warn">⚡ 冲动交易 ' + impulse.impulseCount + '笔 · PnL <span class="' + impCls + '">$' + impulse.impulsePnl.toFixed(2) + '</span></div>';
    }

    html += '</div>';
  });

  el.innerHTML = html || '<div class="quant-empty">暂无数据</div>';
}

function quantCell(label, value, cls) {
  return '<div class="quant-cell"><div class="quant-val ' + (cls || '') + '">' + value + '</div><div class="quant-label">' + label + '</div></div>';
}

// ============================================================
// 市场情绪面板
// ============================================================

function renderSentimentPanel() {
  var el = document.getElementById('sentimentPanel');
  if (!el) return;
  var html = '';

  // 恐惧贪婪指数
  var fg = _marketData.fearGreed;
  if (fg) {
    var fgCls = fg.value <= 25 ? 'red' : fg.value >= 75 ? 'green' : fg.value >= 50 ? 'green' : 'amber';
    var fgBar = fg.value;
    html += '<div class="sent-item">';
    html += '<div class="sent-label">恐惧贪婪指数</div>';
    html += '<div class="sent-val ' + fgCls + '">' + fg.value + ' · ' + fg.text + '</div>';
    html += '<div class="sent-bar-wrap"><div class="sent-bar" style="width:' + fgBar + '%;background:' + (fgCls === 'red' ? 'var(--red)' : fgCls === 'green' ? 'var(--green)' : '#f59e0b') + '"></div></div>';
    html += '</div>';
  }

  // 资金费率
  if (_marketData.fundingRate !== null) {
    var fr = parseFloat(_marketData.fundingRate);
    var frCls = fr > 0.01 ? 'green' : fr < -0.01 ? 'red' : '';
    html += '<div class="sent-item">';
    html += '<div class="sent-label">资金费率</div>';
    html += '<div class="sent-val ' + frCls + '">' + _marketData.fundingRate + '%</div>';
    html += '</div>';
  }

  // 多空比
  if (_marketData.longShortRatio) {
    var ls = parseFloat(_marketData.longShortRatio);
    var lsCls = ls > 1.5 ? 'green' : ls < 0.7 ? 'red' : '';
    var longPct = (ls / (1 + ls) * 100).toFixed(0);
    html += '<div class="sent-item">';
    html += '<div class="sent-label">多空比</div>';
    html += '<div class="sent-val ' + lsCls + '">' + _marketData.longShortRatio + ' (多' + longPct + '%)</div>';
    html += '<div class="sent-bar-wrap"><div class="sent-bar-dual"><div class="sent-long" style="width:' + longPct + '%"></div></div></div>';
    html += '</div>';
  }

  // 标记价格
  if (_marketData.markPrice > 0) {
    html += '<div class="sent-item">';
    html += '<div class="sent-label">标记价格</div>';
    html += '<div class="sent-val">$' + formatPrice(_marketData.markPrice) + '</div>';
    html += '</div>';
  }

  el.innerHTML = html || '<div class="quant-empty">加载中...</div>';
}

// ============================================================
// 影子交易面板
// ============================================================

function renderShadowPanel() {
  var el = document.getElementById('shadowPanel');
  if (!el) return;
  var stats = TTA.getShadowStats();
  var shadows = (TT.load(TT.DB.SHADOW) || []).slice(0, 10);

  var html = '<div class="shadow-stats">';
  html += '<span>总计 ' + stats.total + ' 笔</span>';
  html += '<span>胜率 ' + (stats.winRate * 100).toFixed(0) + '%</span>';
  var profCls = stats.totalProfit >= 0 ? 'green' : 'red';
  html += '<span class="' + profCls + '">虚拟PnL $' + stats.totalProfit.toFixed(2) + '</span>';
  html += '</div>';

  if (shadows.length > 0) {
    html += '<div class="shadow-list">';
    shadows.forEach(function(s) {
      var cls = s.resolved ? (s.result > 0 ? 'green' : 'red') : '';
      var status = s.resolved ? (s.result > 0 ? '+$' + s.result.toFixed(2) : '-$' + Math.abs(s.result).toFixed(2)) : '等待中...';
      var side = s.side === 'long' ? '▲' : '▼';
      html += '<div class="shadow-row ' + cls + '">';
      html += '<span>' + side + ' ' + s.symbol + ' $' + formatPrice(s.price) + '</span>';
      html += '<span class="' + cls + '">' + status + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  el.innerHTML = html;
}

// ============================================================
// 数据源获取 — 标记价格、资金费率、恐惧贪婪、多空比
// ============================================================

function syncMarkPrices() {
  SYMBOL_LIST.forEach(function(sym) {
    var key = SYMBOL_MAP[sym] ? SYMBOL_MAP[sym].toUpperCase() : '';
    var t = tickerData[key];
    if (t) TT.setMarkPrice(sym, parseFloat(t.price));
  });
}

function fetchMarketData() {
  // 1. 标记价格 + 资金费率
  var sym = SYMBOL_MAP[currentSymbol];
  fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + sym.toUpperCase())
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.markPrice) {
        _marketData.markPrice = parseFloat(d.markPrice);
        TT.setMarkPrice(currentSymbol, _marketData.markPrice);
      }
      if (d.lastFundingRate) {
        _marketData.fundingRate = (parseFloat(d.lastFundingRate) * 100).toFixed(4);
      }
      renderSentimentPanel();
    }).catch(function() {});

  // 2. 多空比
  fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=' + sym.toUpperCase() + '&period=5m&limit=1')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d[0]) {
        _marketData.longShortRatio = parseFloat(d[0].longShortRatio).toFixed(2);
      }
      renderSentimentPanel();
    }).catch(function() {});

  // 3. 恐惧贪婪指数
  fetch('https://api.alternative.me/fng/?limit=1')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.data && d.data[0]) {
        _marketData.fearGreed = {
          value: parseInt(d.data[0].value),
          text: d.data[0].value_classification
        };
      }
      renderSentimentPanel();
    }).catch(function() {});
}

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', init);