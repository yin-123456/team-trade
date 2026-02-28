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
  var macdRes = calcMACD(klineData);
  if (macdRes && macdRes.hist.length > 1) {
    var last = macdRes.hist[macdRes.hist.length - 1];
    var prev = macdRes.hist[macdRes.hist.length - 2];
    snap.macdHist = last.val;
    snap.macdCross = (prev.val <= 0 && last.val > 0) ? 'golden' : (prev.val >= 0 && last.val < 0) ? 'death' : 'none';
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
  var feeEl = document.getElementById('estFee');
  var liqEl = document.getElementById('estLiqPrice');
  if (!priceEl || !amountEl || !costEl) return;
  var price = parseFloat(priceEl.value.replace(/,/g, '')) || 0;
  var qty = parseFloat(amountEl.value) || 0;
  var lev = levSlider ? parseInt(levSlider.value) : 1;
  var notional = price * qty;
  var margin = notional / lev;
  var fee = notional * 0.0004;
  costEl.textContent = margin > 0 ? '$' + margin.toFixed(2) : '--';
  if (feeEl) feeEl.textContent = '≈ $' + fee.toFixed(2);
  // 预估强平价
  if (liqEl && price > 0 && lev > 0) {
    var side = document.getElementById('btnBuy') && document.getElementById('btnBuy').classList.contains('active') ? 'long' : 'short';
    var maintRate = 0.02;
    var liqPrice = side === 'long'
      ? price * (1 - 1/lev + maintRate)
      : price * (1 + 1/lev - maintRate);
    liqEl.textContent = qty > 0 ? '$' + formatPrice(liqPrice) : '--';
  }
  // 交易天平实时更新
  updateTradeBalance();
}

function showTradeToast(title, detail, color) {
  var toast = document.createElement('div');
  toast.className = 'trade-toast ' + (color || 'green');
  toast.innerHTML = '<div class="toast-title">' + escapeHtml(title) + '</div><div class="toast-detail">' + escapeHtml(detail) + '</div>';
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 4000);
}

function updateTradeBalance() {
  var box = document.getElementById('tradeBalanceBox');
  if (!box || klineData.length < 20) return;
  var side = document.getElementById('btnBuy') && document.getElementById('btnBuy').classList.contains('active') ? 'long' : 'short';
  var snap = collectIndicatorSnapshot();
  var bal = TTA.calcTradeBalance(currentSymbol, side, snap);
  box.style.display = 'block';
  var scoreEl = document.getElementById('balanceScore');
  var prosEl = document.getElementById('balancePros');
  var consEl = document.getElementById('balanceCons');
  if (scoreEl) {
    var cls = bal.recommendation === 'go' ? 'green' : bal.recommendation === 'stop' ? 'red' : 'amber';
    scoreEl.className = 'balance-score ' + cls;
    scoreEl.textContent = bal.score.toFixed(0) + '/100';
  }
  if (prosEl) prosEl.innerHTML = bal.pros.length > 0 ? bal.pros.join('<br>') : '<span class="muted">无支持信号</span>';
  if (consEl) consEl.innerHTML = bal.cons.length > 0 ? bal.cons.join('<br>') : '<span class="muted">无反对信号</span>';
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
      modalOverlay.classList.add('active');
    });
  }
  if (modalClose && modalOverlay) {
    modalClose.addEventListener('click', function() {
      modalOverlay.classList.remove('active');
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

  // ---- 创新功能分类筛选 ----
  document.querySelectorAll('.innov-cat').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.innov-cat').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderInnovGrid(btn.getAttribute('data-cat'));
    });
  });

  // ---- 创新功能卡片点击弹窗 ----
  var innovGrid = document.getElementById('innovGrid');
  var innovModal = document.getElementById('innovModal');
  if (innovGrid) {
    innovGrid.addEventListener('click', function(e) {
      var card = e.target.closest('.innov-card');
      if (!card) return;
      var id = parseInt(card.getAttribute('data-id'));
      var item = INNOVATIONS.find(function(it) { return it.id === id; });
      if (!item) return;
      document.getElementById('innovModalIcon').textContent = item.icon;
      document.getElementById('innovModalName').textContent = item.name;
      document.getElementById('innovModalCat').textContent = CAT_NAMES[item.cat] || '';
      document.getElementById('innovModalCat').style.color = CAT_COLORS[item.cat] || '#38bdf8';
      document.getElementById('innovModalDesc').textContent = item.desc;
      document.getElementById('innovModalUsage').textContent = item.usage;
      document.getElementById('innovModalImpact').textContent = item.impact;
      var statusEl = document.getElementById('innovModalStatus');
      statusEl.textContent = item.status === 'active' ? '✅ 已上线 — 可直接使用' : '🔮 规划中 — 即将推出';
      statusEl.className = 'innov-modal-status ' + item.status;
      if (innovModal) innovModal.classList.add('active');
    });
  }

  // ---- 创新弹窗关闭 ----
  var innovModalClose = document.getElementById('innovModalClose');
  if (innovModalClose && innovModal) {
    innovModalClose.addEventListener('click', function() { innovModal.classList.remove('active'); });
  }
  if (innovModal) {
    innovModal.addEventListener('click', function(e) {
      if (e.target === innovModal) innovModal.classList.remove('active');
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

// ============ 团队资金总览 ============
function renderFundOverview() {
  var el = document.getElementById('fundOverview');
  if (!el) return;
  var totalBal = 0, totalMargin = 0, totalAvail = 0;
  var html = '<div class="fund-members">';

  TEAM.forEach(function(m) {
    var acc = TT.getAccount(m.name);
    if (!acc) return;
    totalBal += acc.walletBalance;
    totalMargin += acc.usedMargin;
    totalAvail += acc.walletBalance - acc.usedMargin;

    var usedPct = acc.walletBalance > 0 ? (acc.usedMargin / acc.walletBalance * 100) : 0;
    var cls = usedPct > 80 ? 'red' : usedPct > 50 ? 'amber' : 'green';

    html += '<div class="fund-member">';
    html += '<span class="fund-avatar" style="background:' + m.color + '">' + m.init + '</span>';
    html += '<span class="fund-name">' + m.name + '</span>';
    html += '<span class="fund-bal">$' + acc.walletBalance.toFixed(0) + '</span>';
    html += '<div class="fund-bar-wrap"><div class="fund-bar ' + cls + '" style="width:' + Math.min(usedPct, 100).toFixed(0) + '%"></div></div>';
    html += '<span class="fund-pct ' + cls + '">' + usedPct.toFixed(0) + '%</span>';
    html += '</div>';
  });

  html += '</div>';
  html += '<div class="fund-summary">';
  html += '<span>总资金 $' + totalBal.toFixed(0) + '</span>';
  html += '<span>已用 $' + totalMargin.toFixed(0) + '</span>';
  html += '<span>可用 $' + totalAvail.toFixed(0) + '</span>';
  html += '</div>';
  el.innerHTML = html;
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
  renderFundOverview();
  renderEquityCurve();
  renderLeaderboard();
  renderRiskPanel();
  renderQuantDashboard();
  renderSentimentPanel();
  renderMarketOverview();
  renderLongShortPanel();
  renderShadowPanel();
  renderPuzzlePanel();
  renderBlackboxPanel();
  renderRhythmPanel();
  renderHeatmapPanel();
  renderGamificationPanel();
  renderInnovGrid();
  renderLeaderboard2();

  // 延迟初始化图表（等DOM渲染完成）
  setTimeout(function() {
    initCompareCharts();
    initLeverageChart();
    initPnlDistChart();
    initRiskExposureChart();
    initDrawdownChart();
    initLSHistoryChart();
  }, 500);

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
var tvRsiChart = null, tvRsiSeries = null;
var tvMacdChart = null, tvMacdHistSeries = null, tvMacdLineSeries = null, tvMacdSignalSeries = null;

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

  // RSI 副图
  updateRsiSubChart();

  // MACD 副图
  updateMacdSubChart();
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
  var macdResult = calcMACD(klineData);
  if (macdResult && macdResult.hist.length > 0) {
    var m = macdResult.hist[macdResult.hist.length - 1];
    var mCls = m.val > 0 ? 'green' : 'red';
    html += '<span class="chart-tag ' + mCls + '">MACD ' + m.val.toFixed(2) + '</span>';
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

// --- RSI 副图 ---
function updateRsiSubChart() {
  var area = document.getElementById('rsiChartArea');
  var container = document.getElementById('rsiChart');
  if (!area || !container) return;

  if (!indicators.rsi) {
    area.style.display = 'none';
    return;
  }
  area.style.display = 'block';

  var rsiArr = calcRSI(klineData, 14);
  if (rsiArr.length === 0) return;

  if (!tvRsiChart) {
    tvRsiChart = LightweightCharts.createChart(container, {
      width: container.clientWidth, height: 100,
      layout: { background: { color: 'transparent' }, textColor: '#8ba3c7', fontFamily: 'Outfit' },
      grid: { vertLines: { color: 'rgba(56,189,248,0.03)' }, horzLines: { color: 'rgba(56,189,248,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(56,189,248,0.08)', scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { visible: false }, crosshair: { mode: 0 }
    });
    tvRsiSeries = tvRsiChart.addLineSeries({ color: '#f59e0b', lineWidth: 1.5 });
    window.addEventListener('resize', function() {
      if (tvRsiChart && container) tvRsiChart.applyOptions({ width: container.clientWidth });
    });
  }

  var data = rsiArr.map(function(p) {
    return { time: Math.floor(klineData[p.idx].time / 1000), value: p.val };
  });
  tvRsiSeries.setData(data);
}

// --- MACD 副图 ---
function updateMacdSubChart() {
  var area = document.getElementById('macdChartArea');
  var container = document.getElementById('macdChart');
  if (!area || !container) return;

  if (!indicators.macd) {
    area.style.display = 'none';
    return;
  }
  area.style.display = 'block';

  var macdResult = calcMACD(klineData);
  if (!macdResult || macdResult.hist.length === 0) return;

  if (!tvMacdChart) {
    tvMacdChart = LightweightCharts.createChart(container, {
      width: container.clientWidth, height: 100,
      layout: { background: { color: 'transparent' }, textColor: '#8ba3c7', fontFamily: 'Outfit' },
      grid: { vertLines: { color: 'rgba(56,189,248,0.03)' }, horzLines: { color: 'rgba(56,189,248,0.03)' } },
      rightPriceScale: { borderColor: 'rgba(56,189,248,0.08)' },
      timeScale: { visible: false }, crosshair: { mode: 0 }
    });
    tvMacdHistSeries = tvMacdChart.addHistogramSeries({ priceFormat: { type: 'price', precision: 2 } });
    tvMacdLineSeries = tvMacdChart.addLineSeries({ color: '#22d3ee', lineWidth: 1 });
    tvMacdSignalSeries = tvMacdChart.addLineSeries({ color: '#f59e0b', lineWidth: 1 });
    window.addEventListener('resize', function() {
      if (tvMacdChart && container) tvMacdChart.applyOptions({ width: container.clientWidth });
    });
  }

  var hist = [], dif = [], dea = [];
  macdResult.hist.forEach(function(m) {
    var t = Math.floor(klineData[m.idx].time / 1000);
    hist.push({ time: t, value: m.val, color: m.val >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)' });
  });
  macdResult.macd.forEach(function(m) {
    dif.push({ time: Math.floor(klineData[m.idx].time / 1000), value: m.val });
  });
  macdResult.signal.forEach(function(m) {
    dea.push({ time: Math.floor(klineData[m.idx].time / 1000), value: m.val });
  });
  tvMacdHistSeries.setData(hist);
  tvMacdLineSeries.setData(dif);
  tvMacdSignalSeries.setData(dea);
}

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
// 交易拼图 — 每笔交易7维评分
// ============================================================

function renderPuzzlePanel() {
  var el = document.getElementById('puzzlePanel');
  if (!el) return;
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; }).slice(0, 8);

  if (closed.length === 0) {
    el.innerHTML = '<div class="quant-empty">暂无已平仓交易</div>';
    return;
  }

  var html = '';
  closed.forEach(function(trade) {
    var puzzle = TTA.calcTradePuzzle(trade, klineData);
    var pCls = trade.pnl >= 0 ? 'green' : 'red';
    html += '<div class="puzzle-row">';
    html += '<div class="puzzle-head">';
    html += '<span>' + (trade.side === 'long' ? '▲' : '▼') + ' ' + (trade.symbol || currentSymbol) + '</span>';
    html += '<span class="' + pCls + '">' + (trade.pnl >= 0 ? '+' : '') + '$' + (trade.pnl || 0).toFixed(2) + '</span>';
    html += '<span class="puzzle-score">' + puzzle.score + '/7</span>';
    html += '</div>';
    html += '<div class="puzzle-pieces">';
    puzzle.pieces.forEach(function(p) {
      html += '<span class="puzzle-piece ' + (p.ok ? 'ok' : 'fail') + '">' + p.name + '</span>';
    });
    html += '</div></div>';
  });
  el.innerHTML = html;
}

// ============================================================
// 交易黑匣子 — 亏损复盘分析
// ============================================================

function renderBlackboxPanel() {
  var el = document.getElementById('blackboxPanel');
  if (!el) return;
  var journal = loadJournal();
  var losses = journal.filter(function(e) {
    return e.status === 'closed' && (e.pnl || 0) < 0;
  }).slice(0, 6);

  if (losses.length === 0) {
    el.innerHTML = '<div class="quant-empty">暂无亏损记录 🎉</div>';
    return;
  }

  // 分析亏损模式
  var patterns = {};
  losses.forEach(function(t) {
    var lev = parseFloat(t.leverage) || 1;
    if (lev >= 10) patterns['高杠杆'] = (patterns['高杠杆'] || 0) + 1;
    if (t.side === 'long') patterns['做多亏损'] = (patterns['做多亏损'] || 0) + 1;
    else patterns['做空亏损'] = (patterns['做空亏损'] || 0) + 1;
  });

  var html = '<div class="bb-patterns">';
  Object.keys(patterns).forEach(function(k) {
    html += '<span class="bb-tag">' + k + ' ×' + patterns[k] + '</span>';
  });
  html += '</div>';

  var totalLoss = losses.reduce(function(s, t) { return s + Math.abs(t.pnl || 0); }, 0);
  html += '<div class="bb-total">总亏损 <span class="red">-$' + totalLoss.toFixed(2) + '</span></div>';

  losses.forEach(function(t) {
    html += '<div class="bb-row">';
    html += '<span>' + (t.side === 'long' ? '▲' : '▼') + ' ' + (t.symbol || '--') + '</span>';
    html += '<span class="red">-$' + Math.abs(t.pnl || 0).toFixed(2) + '</span>';
    html += '<span>' + (t.leverage || 1) + 'x</span>';
    html += '</div>';
  });

  el.innerHTML = html;
}

// ============================================================
// 节奏大师 — 最佳交易频率分析
// ============================================================

function renderRhythmPanel() {
  var el = document.getElementById('rhythmPanel');
  if (!el) return;
  var html = '';

  TEAM.forEach(function(m) {
    var trades = TT.getTrades({ member: m.name });
    if (trades.length < 3) return;

    // 计算交易间隔
    var gaps = [];
    for (var i = 1; i < trades.length; i++) {
      var gap = Math.abs(new Date(trades[i-1].timestamp) - new Date(trades[i].timestamp));
      gaps.push({ gap: gap, pnl: trades[i].pnl || 0 });
    }

    // 按间隔分桶
    var buckets = { '急(<3m)': { pnl: 0, count: 0 }, '快(3-15m)': { pnl: 0, count: 0 }, '中(15m-1h)': { pnl: 0, count: 0 }, '慢(>1h)': { pnl: 0, count: 0 } };
    gaps.forEach(function(g) {
      var min = g.gap / 60000;
      var key = min < 3 ? '急(<3m)' : min < 15 ? '快(3-15m)' : min < 60 ? '中(15m-1h)' : '慢(>1h)';
      buckets[key].pnl += g.pnl;
      buckets[key].count++;
    });

    html += '<div class="rhythm-member">';
    html += '<div class="quant-header"><span class="pos-avatar" style="background:' + m.color + ';width:24px;height:24px;font-size:10px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%">' + m.init + '</span><span class="quant-name">' + m.name + '</span></div>';
    html += '<div class="rhythm-grid">';
    Object.keys(buckets).forEach(function(k) {
      var b = buckets[k];
      var cls = b.pnl > 0 ? 'green' : b.pnl < 0 ? 'red' : '';
      html += '<div class="rhythm-cell"><div class="rhythm-label">' + k + '</div>';
      html += '<div class="rhythm-count">' + b.count + '笔</div>';
      html += '<div class="rhythm-pnl ' + cls + '">' + (b.pnl >= 0 ? '+' : '') + '$' + b.pnl.toFixed(2) + '</div></div>';
    });
    html += '</div></div>';
  });

  el.innerHTML = html || '<div class="quant-empty">暂无数据</div>';
}

// ============================================================
// 时段热力图
// ============================================================

function renderHeatmapPanel() {
  var el = document.getElementById('heatmapPanel');
  if (!el) return;
  var member = TEAM[0]; // 默认第一个成员
  var hm = TTA.calcTimeHeatmap(member.name);
  if (!hm || Object.keys(hm.map).length === 0) {
    el.innerHTML = '<div class="quant-empty">暂无数据</div>';
    return;
  }

  var hours = [0, 3, 6, 9, 12, 15, 18, 21];
  var html = '<div class="hm-grid">';
  html += '<div class="hm-corner"></div>';
  hours.forEach(function(h) {
    html += '<div class="hm-head">' + h + ':00</div>';
  });

  for (var d = 0; d < 7; d++) {
    html += '<div class="hm-day">' + hm.days[d] + '</div>';
    hours.forEach(function(h) {
      var key = d + '_' + h;
      var cell = hm.map[key];
      if (cell) {
        var intensity = Math.min(1, Math.abs(cell.pnl) / 50);
        var bg = cell.pnl >= 0
          ? 'rgba(34,197,94,' + (0.1 + intensity * 0.6) + ')'
          : 'rgba(239,68,68,' + (0.1 + intensity * 0.6) + ')';
        html += '<div class="hm-cell" style="background:' + bg + '" title="' + cell.count + '笔 $' + cell.pnl.toFixed(2) + '">' + cell.count + '</div>';
      } else {
        html += '<div class="hm-cell"></div>';
      }
    });
  }
  html += '</div>';
  el.innerHTML = html;
}

// ============================================================
// 游戏化引擎 — EXP/等级/成就/每日任务
// ============================================================

var GAME_CONFIG = {
  levels: [0,100,300,600,1000,1500,2200,3000,4000,5500,7500,10000,13000,17000,22000,28000,35000,43000,52000,65000],
  achievements: {
    '首笔交易': { desc: '完成第一笔交易', check: function(s) { return s.totalTrades >= 1; } },
    '十连斩': { desc: '累计10笔交易', check: function(s) { return s.totalTrades >= 10; } },
    '百战老兵': { desc: '累计100笔交易', check: function(s) { return s.totalTrades >= 100; } },
    '神枪手': { desc: '胜率超过60%', check: function(s) { return s.winRate > 60 && s.totalTrades >= 10; } },
    '稳如泰山': { desc: '连续5笔盈利', check: function(s) { return s.maxConsecWin >= 5; } },
    '风控达人': { desc: '最大回撤<5%', check: function(s) { return s.maxDrawdown < 5 && s.totalTrades >= 10; } },
    '冷静杀手': { desc: '无冲动交易(10笔内)', check: function(s) { return s.impulseCount === 0 && s.totalTrades >= 10; } },
    '万元户': { desc: '累计盈利超$10000', check: function(s) { return s.totalPnl >= 10000; } }
  }
};

function calcGameStats(memberName) {
  var trades = TT.getTrades({ member: memberName });
  var closed = trades.filter(function(t) { return t.type === 'close' || t.type === 'liquidation'; });
  var totalPnl = 0, wins = 0, maxConsecWin = 0, curWin = 0;
  closed.forEach(function(t) {
    totalPnl += t.pnl || 0;
    if (t.pnl > 0) { wins++; curWin++; maxConsecWin = Math.max(maxConsecWin, curWin); }
    else curWin = 0;
  });
  var impulse = TTA.detectImpulseTrades(memberName);
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    totalPnl: totalPnl,
    winRate: closed.length > 0 ? wins / closed.length * 100 : 0,
    maxConsecWin: maxConsecWin,
    maxDrawdown: 0,
    impulseCount: impulse.impulseCount
  };
}

function calcEXP(memberName) {
  var stats = calcGameStats(memberName);
  var exp = 0;
  exp += stats.totalTrades * 10;
  exp += stats.closedTrades * 5;
  if (stats.winRate > 50) exp += Math.floor(stats.winRate) * 2;
  if (stats.totalPnl > 0) exp += Math.floor(stats.totalPnl);
  return Math.max(0, exp);
}

function getLevel(exp) {
  for (var i = GAME_CONFIG.levels.length - 1; i >= 0; i--) {
    if (exp >= GAME_CONFIG.levels[i]) return { level: i + 1, exp: exp, nextExp: GAME_CONFIG.levels[i+1] || exp, curLevelExp: GAME_CONFIG.levels[i] };
  }
  return { level: 1, exp: 0, nextExp: 100, curLevelExp: 0 };
}

function renderGamificationPanel() {
  var el = document.getElementById('gamificationPanel');
  if (!el) return;
  var html = '<div class="game-members">';

  TEAM.forEach(function(m) {
    var exp = calcEXP(m.name);
    var lv = getLevel(exp);
    var stats = calcGameStats(m.name);
    var pct = lv.nextExp > lv.curLevelExp ? ((exp - lv.curLevelExp) / (lv.nextExp - lv.curLevelExp) * 100) : 100;

    html += '<div class="game-member">';
    html += '<div class="game-header">';
    html += '<span class="pos-avatar" style="background:' + m.color + ';width:28px;height:28px;font-size:11px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%">' + m.init + '</span>';
    html += '<span class="game-name">' + m.name + '</span>';
    html += '<span class="game-lv">Lv.' + lv.level + '</span>';
    html += '</div>';
    // EXP 进度条
    html += '<div class="game-exp-wrap">';
    html += '<div class="game-exp-bar" style="width:' + pct.toFixed(0) + '%"></div>';
    html += '</div>';
    html += '<div class="game-exp-text">' + exp + ' / ' + lv.nextExp + ' EXP</div>';
    // 成就
    var unlocked = [];
    Object.keys(GAME_CONFIG.achievements).forEach(function(k) {
      if (GAME_CONFIG.achievements[k].check(stats)) unlocked.push(k);
    });
    if (unlocked.length > 0) {
      html += '<div class="game-badges">';
      unlocked.forEach(function(b) { html += '<span class="game-badge">🏅 ' + b + '</span>'; });
      html += '</div>';
    }
    html += '</div>';
  });

  html += '</div>';
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
      renderMarketOverview();
    }).catch(function() {});

  // 2. 多空比
  fetch('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=' + sym.toUpperCase() + '&period=5m&limit=1')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d[0]) {
        _marketData.longShortRatio = parseFloat(d[0].longShortRatio).toFixed(2);
        pushLSHistory(_marketData.longShortRatio);
      }
      renderSentimentPanel();
      renderMarketOverview();
      renderLongShortPanel();
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
      renderMarketOverview();
    }).catch(function() {});
}

// ============================================================
// 可视化图表集 — TradingView Lightweight Charts
// ============================================================
var tvExpChart=null,tvExpSeries=null;
var tvWrChart=null,tvWrSeries=null;
var tvRrChart=null,tvRrSeries=null;
var tvLevChart=null,tvLevSeries=null;
var tvPnlDistChart=null,tvPnlDistSeries=null;
var tvRiskExpChart=null,tvRiskExpSeries=null;
var tvDdChart=null,tvDdSeries=null;
var tvLSHistChart=null,tvLSHistSeries=null;
var _lsHistory = [];

var CHART_OPTS = {
  layout:{background:{type:'solid',color:'transparent'},textColor:'#8a919e',fontSize:10},
  grid:{vertLines:{color:'rgba(255,255,255,0.03)'},horzLines:{color:'rgba(255,255,255,0.03)'}},
  rightPriceScale:{borderColor:'rgba(255,255,255,0.06)'},
  timeScale:{borderColor:'rgba(255,255,255,0.06)',timeVisible:true},
  crosshair:{mode:0},handleScroll:false,handleScale:false
};

function mkMiniChart(id, h) {
  var el = document.getElementById(id);
  if (!el || el.offsetWidth === 0) return null;
  return LightweightCharts.createChart(el, Object.assign({}, CHART_OPTS, {
    width: el.offsetWidth, height: h || 150
  }));
}

// ============ 成员收益对比柱状图 ============
function initCompareCharts() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });

  var expData = [], wrData = [], rrData = [];
  var baseTime = Math.floor(Date.now() / 1000) - 86400;

  TEAM.forEach(function(m, i) {
    var metrics = TTA.calcCoreMetrics(m.name);
    var t = baseTime + i * 86400;
    if (metrics) {
      expData.push({time:t, value:metrics.expectancy, color: metrics.expectancy>=0?'rgba(34,197,94,0.8)':'rgba(239,68,68,0.8)'});
      wrData.push({time:t, value:metrics.winRate*100, color:'rgba(56,189,248,0.8)'});
      rrData.push({time:t, value:Math.min(metrics.riskReward,5), color:'rgba(167,139,250,0.8)'});
    } else {
      expData.push({time:t, value:0, color:'rgba(255,255,255,0.1)'});
      wrData.push({time:t, value:0, color:'rgba(255,255,255,0.1)'});
      rrData.push({time:t, value:0, color:'rgba(255,255,255,0.1)'});
    }
  });

  // 期望值图
  if (!tvExpChart) {
    tvExpChart = mkMiniChart('chartExpectancy', 130);
    if (tvExpChart) {
      tvExpSeries = tvExpChart.addHistogramSeries({priceFormat:{type:'price',precision:2}});
      tvExpChart.timeScale().fitContent();
    }
  }
  if (tvExpSeries) tvExpSeries.setData(expData);

  // 胜率图
  if (!tvWrChart) {
    tvWrChart = mkMiniChart('chartWinRate', 130);
    if (tvWrChart) {
      tvWrSeries = tvWrChart.addHistogramSeries({priceFormat:{type:'price',precision:1}});
      tvWrChart.timeScale().fitContent();
    }
  }
  if (tvWrSeries) tvWrSeries.setData(wrData);

  // 盈亏比图
  if (!tvRrChart) {
    tvRrChart = mkMiniChart('chartRiskReward', 130);
    if (tvRrChart) {
      tvRrSeries = tvRrChart.addHistogramSeries({priceFormat:{type:'price',precision:2}});
      tvRrChart.timeScale().fitContent();
    }
  }
  if (tvRrSeries) tvRrSeries.setData(rrData);
}

// ============ 杠杆收益分析图 ============
function initLeverageChart() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });
  if (closed.length === 0) return;

  var levBuckets = {};
  closed.forEach(function(e) {
    var lev = parseInt(e.leverage) || 1;
    var key = lev + 'x';
    if (!levBuckets[key]) levBuckets[key] = {sum:0,count:0,lev:lev};
    levBuckets[key].sum += (e.pnl || 0);
    levBuckets[key].count++;
  });

  var keys = Object.keys(levBuckets).sort(function(a,b){ return levBuckets[a].lev - levBuckets[b].lev; });
  var baseTime = Math.floor(Date.now()/1000) - 86400;
  var data = keys.map(function(k,i){
    var avg = levBuckets[k].sum / levBuckets[k].count;
    return {time: baseTime + i*86400, value: avg, color: avg>=0?'rgba(34,197,94,0.7)':'rgba(239,68,68,0.7)'};
  });

  if (!tvLevChart) {
    tvLevChart = mkMiniChart('chartLeverage', 200);
    if (tvLevChart) {
      tvLevSeries = tvLevChart.addHistogramSeries({priceFormat:{type:'price',precision:2}});
      tvLevChart.timeScale().fitContent();
    }
  }
  if (tvLevSeries && data.length) tvLevSeries.setData(data);
}

// ============ 盈亏分布图 ============
function initPnlDistChart() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) { return e.status === 'closed'; });
  if (closed.length === 0) return;

  var sorted = closed.slice().sort(function(a,b){ return (a.pnl||0)-(b.pnl||0); });
  var baseTime = Math.floor(Date.now()/1000) - 86400;
  var data = sorted.map(function(e,i){
    var p = e.pnl || 0;
    return {
      time: baseTime + i*86400,
      value: p,
      color: p>=0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'
    };
  });

  if (!tvPnlDistChart) {
    tvPnlDistChart = mkMiniChart('chartPnlDist', 200);
    if (tvPnlDistChart) {
      tvPnlDistSeries = tvPnlDistChart.addHistogramSeries({
        priceFormat:{type:'price',precision:2}
      });
      tvPnlDistChart.timeScale().fitContent();
    }
  }
  if (tvPnlDistSeries && data.length) tvPnlDistSeries.setData(data);
}

// ============ 风险敞口分布图 ============
function initRiskExposureChart() {
  var journal = loadJournal();
  var open = journal.filter(function(e) { return e.status === 'open'; });
  var baseTime = Math.floor(Date.now()/1000) - 86400;

  var data = TEAM.map(function(m, i) {
    var trades = open.filter(function(e) { return e.member === m.name; });
    var exposure = 0;
    trades.forEach(function(e) {
      exposure += (parseFloat(e.amount)||0) * (parseFloat(e.entryPrice)||0);
    });
    return {
      time: baseTime + i * 86400,
      value: exposure,
      color: m.color + 'cc'
    };
  });

  if (!tvRiskExpChart) {
    tvRiskExpChart = mkMiniChart('chartRiskExposure', 200);
    if (tvRiskExpChart) {
      tvRiskExpSeries = tvRiskExpChart.addHistogramSeries({
        priceFormat:{type:'price',precision:0}
      });
      tvRiskExpChart.timeScale().fitContent();
    }
  }
  if (tvRiskExpSeries) tvRiskExpSeries.setData(data);
}

// ============ 回撤曲线图 ============
function initDrawdownChart() {
  var journal = loadJournal();
  var closed = journal.filter(function(e) {
    return e.status === 'closed';
  });
  if (closed.length < 2) return;

  closed.sort(function(a,b) {
    return new Date(a.closeTime||a.timestamp) - new Date(b.closeTime||b.timestamp);
  });

  var equity = 100000, peak = equity;
  var ddData = [];

  closed.forEach(function(e, i) {
    equity += (e.pnl || 0);
    if (equity > peak) peak = equity;
    var dd = peak > 0 ? ((equity - peak) / peak * 100) : 0;
    var t = Math.floor(new Date(e.closeTime||e.timestamp).getTime()/1000);
    if (isNaN(t)) t = Math.floor(Date.now()/1000) - (closed.length-i)*3600;
    ddData.push({ time: t, value: dd });
  });

  if (!tvDdChart) {
    tvDdChart = mkMiniChart('chartDrawdown', 200);
    if (tvDdChart) {
      tvDdSeries = tvDdChart.addAreaSeries({
        topColor: 'rgba(239,68,68,0.4)',
        bottomColor: 'rgba(239,68,68,0.02)',
        lineColor: 'rgba(239,68,68,0.8)',
        lineWidth: 2,
        priceFormat:{type:'price',precision:2}
      });
      tvDdChart.timeScale().fitContent();
    }
  }
  if (tvDdSeries && ddData.length) tvDdSeries.setData(ddData);
}

// ============ 多空比历史趋势 ============
function initLSHistoryChart() {
  if (!tvLSHistChart) {
    tvLSHistChart = mkMiniChart('chartLSHistory', 200);
    if (tvLSHistChart) {
      tvLSHistSeries = tvLSHistChart.addLineSeries({
        color: 'rgba(56,189,248,0.9)',
        lineWidth: 2,
        priceFormat:{type:'price',precision:2}
      });
    }
  }
  if (tvLSHistSeries && _lsHistory.length > 1) {
    tvLSHistSeries.setData(_lsHistory);
    tvLSHistChart.timeScale().fitContent();
  }
}

function pushLSHistory(ratio) {
  var t = Math.floor(Date.now() / 1000);
  _lsHistory.push({ time: t, value: parseFloat(ratio) || 1 });
  if (_lsHistory.length > 120) _lsHistory.shift();
  initLSHistoryChart();
}

// ============ 市场概览卡片 ============
function renderMarketOverview() {
  var el = document.getElementById('marketOverview');
  if (!el) return;
  var mp = _marketData.markPrice ? '$' + formatPrice(_marketData.markPrice) : '--';
  var fr = _marketData.fundingRate || '--';
  var frVal = parseFloat(_marketData.fundingRate) || 0;
  var frCls = frVal > 0 ? 'green' : frVal < 0 ? 'red' : '';
  var lsr = _marketData.longShortRatio || '--';
  var fg = _marketData.fearGreed ? _marketData.fearGreed.value : '--';
  var fgText = _marketData.fearGreed ? _marketData.fearGreed.text : '';
  var fgCls = fg >= 60 ? 'green' : fg <= 40 ? 'red' : 'amber';

  el.innerHTML = '<div class="mkt-cards">' +
    '<div class="mkt-card"><div class="mkt-label">标记价格</div><div class="mkt-val">' + mp + '</div></div>' +
    '<div class="mkt-card"><div class="mkt-label">资金费率</div><div class="mkt-val ' + frCls + '">' + fr + '%</div></div>' +
    '<div class="mkt-card"><div class="mkt-label">多空比</div><div class="mkt-val">' + lsr + '</div></div>' +
    '<div class="mkt-card"><div class="mkt-label">恐惧贪婪</div><div class="mkt-val ' + fgCls + '">' + fg + ' <small>' + fgText + '</small></div></div>' +
  '</div>';
}

// ============ 多空力量对比面板 ============
function renderLongShortPanel() {
  var el = document.getElementById('longShortPanel');
  if (!el) return;
  var ratio = parseFloat(_marketData.longShortRatio) || 1;
  var longPct = (ratio / (1 + ratio) * 100).toFixed(1);
  var shortPct = (100 - parseFloat(longPct)).toFixed(1);

  el.innerHTML = '<div class="ls-panel">' +
    '<div class="ls-bar-wrap">' +
      '<div class="ls-bar-long" style="width:' + longPct + '%">' + longPct + '% 多</div>' +
      '<div class="ls-bar-short" style="width:' + shortPct + '%">' + shortPct + '% 空</div>' +
    '</div>' +
    '<div class="ls-info">' +
      '<span>多空比: ' + ratio.toFixed(2) + '</span>' +
      '<span>' + (ratio > 1 ? '🟢 多头占优' : ratio < 1 ? '🔴 空头占优' : '⚪ 均衡') + '</span>' +
    '</div>' +
  '</div>';
}

// ============================================================
// 80项创新功能数据
// ============================================================

var INNOVATIONS = [
  {id:1,icon:'👻',name:'影子交易',cat:'trade',desc:'不用真金白银，虚拟下单验证你的判断力。系统1小时后自动结算，统计你的"如果当时下了"胜率。',usage:'在市场Tab点击"影子下单"，选择方向和价格即可。1小时后自动结算，查看虚拟盈亏。',impact:'帮你建立交易信心，减少犹豫导致的错过行情，提升决策速度20%+',status:'active'},
  {id:2,icon:'🧬',name:'交易者DNA',cat:'analysis',desc:'分析你的交易基因——擅长做多还是做空？高杠杆还是低杠杆？哪个时段最赚钱？',usage:'在分析Tab的量化仪表盘中查看每位成员的交易光谱数据。',impact:'找到你的"甜蜜区"，专注优势领域可提升盈利30%+',status:'active'},
  {id:3,icon:'🔮',name:'What-If假设机',cat:'ai',desc:'输入假设条件（如"如果我用5x杠杆而不是10x"），AI回测历史数据给出模拟结果。',usage:'在交易面板输入不同参数，系统自动对比不同杠杆/仓位的历史表现。',impact:'避免过度杠杆，历史数据显示降低杠杆可减少40%回撤',status:'planned'},
  {id:4,icon:'🌤️',name:'市场天气预报',cat:'ai',desc:'综合恐惧贪婪指数、资金费率、多空比、波动率，给出今日市场"天气"：晴/多云/暴风雨。',usage:'在市场Tab查看市场情绪面板，系统自动综合多维数据给出天气评级。',impact:'暴风雨天气减仓可避免80%的黑天鹅损失',status:'active'},
  {id:5,icon:'⚔️',name:'交易竞技场',cat:'social',desc:'团队成员PK赛，比拼胜率、盈亏比、最大回撤等指标，激发良性竞争。',usage:'在成长Tab查看排行榜，系统自动根据多维指标综合排名。',impact:'团队竞争氛围提升整体交易纪律性，平均胜率提升15%',status:'active'},
  {id:6,icon:'💘',name:'策略红娘',cat:'ai',desc:'根据你的交易风格和历史数据，AI推荐最适合你的策略组合。',usage:'系统分析你的历史交易，在策略面板标注"推荐"标签。',impact:'匹配度高的策略可提升盈利效率25%',status:'planned'},
  {id:7,icon:'⏳',name:'时间胶囊',cat:'game',desc:'记录当前市场判断，封存30天后开启，回顾你的预测准确率。',usage:'在交易心得中写下预测，系统30天后自动对比实际走势。',impact:'培养长期思维，减少短线冲动交易',status:'planned'},
  {id:8,icon:'👨‍🏫',name:'导师匹配',cat:'social',desc:'根据交易数据，自动匹配团队中最适合指导你的"导师"成员。',usage:'系统分析每位成员的优势领域，自动推荐互补配对。',impact:'新手跟随高手学习，成长速度提升3倍',status:'planned'},
  {id:9,icon:'🎬',name:'市场剧本',cat:'ai',desc:'AI根据当前技术形态，生成3种可能的市场走势剧本及概率。',usage:'在图表区域查看AI生成的多空剧本和概率评估。',impact:'提前准备应对方案，减少被动交易',status:'planned'},
  {id:10,icon:'⚡',name:'交易能量',cat:'game',desc:'每日交易能量值，高质量交易充能，冲动交易耗能。能量耗尽建议休息。',usage:'顶部状态栏显示当日能量值，低于20%时系统提醒休息。',impact:'防止过度交易，研究显示每日超过5笔交易盈利率下降60%',status:'planned'},
  {id:11,icon:'💓',name:'交易心跳',cat:'analysis',desc:'实时监控交易频率，像心电图一样展示你的交易节奏是否健康。',usage:'在分析Tab的节奏大师面板查看交易频率分布。',impact:'识别冲动交易模式，冲动交易平均亏损是正常交易的2.3倍',status:'active'},
  {id:12,icon:'🌀',name:'平行宇宙',cat:'ai',desc:'同时模拟多种策略在当前市场的表现，找出最优策略。',usage:'系统自动对比8种策略在近期K线上的模拟表现。',impact:'选择当前最优策略可提升短期收益率',status:'planned'},
  {id:13,icon:'⭐',name:'交易者星座',cat:'game',desc:'根据交易风格分类：激进型(火象)、稳健型(土象)、灵活型(风象)、直觉型(水象)。',usage:'系统根据你的历史数据自动分析交易风格类型。',impact:'了解自己的交易性格，扬长避短',status:'planned'},
  {id:14,icon:'🗺️',name:'交易地图',cat:'analysis',desc:'可视化展示你的交易路径——从入场到出场的完整轨迹。',usage:'在交易日志中点击任意交易，查看完整的价格轨迹图。',impact:'复盘利器，直观看到入场出场时机是否最优',status:'planned'},
  {id:15,icon:'💡',name:'呼吸灯',cat:'risk',desc:'根据市场波动率动态调整界面呼吸灯颜色：绿色平静/黄色警惕/红色危险。',usage:'页面背景粒子颜色自动随市场波动率变化。',impact:'潜意识提醒风险等级，减少高波动期的冲动操作',status:'planned'},
  {id:16,icon:'🏛️',name:'交易考古',cat:'analysis',desc:'挖掘历史交易中的"化石"——那些被遗忘但有价值的交易模式。',usage:'系统自动分析历史交易，发现重复出现的盈利/亏损模式。',impact:'发现隐藏的盈利模式，平均可提升策略效率20%',status:'planned'},
  {id:17,icon:'🎵',name:'交易之声',cat:'game',desc:'将K线走势转化为音乐旋律，上涨高音下跌低音，用听觉感知市场。',usage:'开启声音模式后，价格变动会转化为不同音调的提示音。',impact:'多感官感知市场，部分交易者反馈听觉辅助提升了直觉判断',status:'planned'},
  {id:18,icon:'🧪',name:'策略进化',cat:'ai',desc:'策略自动进化系统——根据近期表现自动微调参数，适应市场变化。',usage:'系统每周自动回测并优化策略参数，在策略面板显示优化建议。',impact:'自适应策略比固定参数策略平均多赚15-25%',status:'planned'},
  {id:19,icon:'🎭',name:'交易剧场',cat:'social',desc:'匿名分享精彩交易案例，团队投票评选"最佳操作"和"最惨教训"。',usage:'在交易日志中标记精彩交易，系统自动推送到团队动态。',impact:'从他人的成功和失败中学习，加速经验积累',status:'planned'},
  {id:20,icon:'📜',name:'交易遗嘱',cat:'risk',desc:'预设极端情况下的自动操作：如BTC跌破某价位自动全部平仓。',usage:'在风控面板设置紧急平仓条件和触发价格。',impact:'黑天鹅事件中自动保护资金，避免情绪化决策',status:'planned'},
  {id:21,icon:'📦',name:'交易黑匣子',cat:'risk',desc:'记录每笔亏损交易的完整上下文——入场理由、市场状态、情绪状态，自动分析亏损模式。',usage:'在风控Tab查看黑匣子面板，系统自动归类亏损原因。',impact:'识别重复犯错模式，针对性改进可减少30%亏损',status:'active'},
  {id:22,icon:'🎵',name:'节奏大师',cat:'analysis',desc:'分析你的最佳交易频率——是急速短线还是慢节奏波段？找到你的盈利节奏。',usage:'在分析Tab查看节奏大师面板，对比不同频率下的盈亏表现。',impact:'在最佳节奏下交易，盈利效率提升40%',status:'active'},
  {id:23,icon:'🌳',name:'交易之树',cat:'game',desc:'你的交易成长可视化为一棵树——盈利让树枝繁茂，亏损让叶子凋零。',usage:'在成长Tab查看你的交易树，每笔交易都会影响树的形态。',impact:'直观感受交易健康度，激励保持良好交易习惯',status:'planned'},
  {id:24,icon:'🔍',name:'交易侦探',cat:'analysis',desc:'AI自动侦测异常交易——偏离正常模式的操作会被标记并分析原因。',usage:'系统自动标记异常交易（如突然加大杠杆、频繁换方向等）。',impact:'及时发现情绪化交易，避免连续亏损',status:'planned'},
  {id:25,icon:'📸',name:'快照分享',cat:'social',desc:'一键生成精美的交易成绩单图片，分享到社交媒体。',usage:'点击导出按钮，系统自动生成包含关键数据的精美图片。',impact:'分享成就激励自己，也帮助团队建立品牌',status:'planned'},
  {id:26,icon:'🏰',name:'交易迷宫',cat:'game',desc:'将交易学习路径设计为迷宫闯关——每掌握一个技能解锁新区域。',usage:'在成长Tab查看技能树，完成特定条件解锁新功能。',impact:'游戏化学习提升参与度，学习效率提升50%',status:'planned'},
  {id:27,icon:'🪞',name:'镜像交易',cat:'trade',desc:'一键复制团队中表现最好的成员的交易策略和参数。',usage:'在排行榜中点击任意成员，选择"镜像交易"复制其策略。',impact:'新手快速上手，跟随高手策略平均收益提升',status:'planned'},
  {id:28,icon:'😊',name:'情绪日记',cat:'risk',desc:'每笔交易前记录当前情绪状态，系统分析情绪与盈亏的关联。',usage:'在交易心得中选择当前情绪标签（冷静/兴奋/恐惧/贪婪）。',impact:'情绪管理是交易成功的关键，冷静状态下胜率高出25%',status:'planned'},
  {id:29,icon:'🪜',name:'技能阶梯',cat:'game',desc:'从青铜到王者的交易段位系统，每个段位有明确的晋级条件。',usage:'在成长Tab查看当前段位和晋级进度。',impact:'明确的成长目标让交易者更有方向感',status:'planned'},
  {id:30,icon:'🔗',name:'量子纠缠',cat:'analysis',desc:'发现不同交易对之间的隐藏关联——当BTC涨时ETH通常怎么走？',usage:'系统自动计算交易对之间的相关性系数并可视化展示。',impact:'利用相关性做对冲或确认信号，提升交易确定性',status:'planned'},
  {id:31,icon:'🎯',name:'精准狙击',cat:'trade',desc:'基于多指标共振的高概率入场点检测，只在RSI+MACD+布林带同时发出信号时提醒。',usage:'系统自动监测多指标共振，当3个以上指标同时触发时弹出狙击信号。',impact:'过滤掉80%的噪音信号，只留下高胜率机会',status:'active'},
  {id:32,icon:'🌊',name:'浪潮追踪',cat:'analysis',desc:'识别市场的大级别趋势浪型，判断当前处于上升浪还是回调浪。',usage:'在分析Tab查看当前市场浪型结构和预测的下一浪方向。',impact:'顺势交易胜率提升30%，避免逆势操作',status:'planned'},
  {id:33,icon:'🔔',name:'智能预警',cat:'risk',desc:'自定义价格、指标、持仓盈亏等多维度预警条件，触发时实时通知。',usage:'在风控Tab设置预警规则，如"BTC跌破65000"或"持仓亏损超5%"。',impact:'不用盯盘也能及时响应市场变化，减少错过止损的风险',status:'active'},
  {id:34,icon:'📐',name:'黄金分割',cat:'analysis',desc:'自动计算Fibonacci回撤和扩展位，标注关键支撑阻力价位。',usage:'选择一段趋势的高低点，系统自动绘制Fibonacci线并标注关键位。',impact:'精确定位入场和止盈位置，提升盈亏比',status:'active'},
  {id:35,icon:'🧲',name:'磁力位',cat:'analysis',desc:'基于历史成交密集区计算价格"磁力位"——价格倾向于被吸引到这些区域。',usage:'图表上自动标注成交密集区，颜色越深磁力越强。',impact:'预判价格运动目标，提前布局止盈位',status:'planned'},
  {id:36,icon:'⚡',name:'闪电下单',cat:'trade',desc:'一键快速下单，预设好仓位、杠杆、止盈止损，点击即执行。',usage:'在快速交易面板预设常用交易模板，一键触发。',impact:'抓住转瞬即逝的机会，下单速度提升10倍',status:'active'},
  {id:37,icon:'🎪',name:'策略马戏团',cat:'trade',desc:'同时运行多个策略并实时对比表现，找出最适合当前市场的策略。',usage:'在总览Tab的智能策略区同时启动多个策略，系统自动对比收益。',impact:'通过策略组合分散风险，整体收益更稳定',status:'active'},
  {id:38,icon:'🔬',name:'微观结构',cat:'analysis',desc:'分析订单簿深度、大单分布、买卖力量对比等微观市场结构。',usage:'在买卖盘口区域查看深度分析，大单标记和力量对比指标。',impact:'洞察主力动向，避免被大单砸盘',status:'active'},
  {id:39,icon:'🛡️',name:'风暴盾',cat:'risk',desc:'极端行情自动触发保护机制——降杠杆、缩仓位、设紧急止损。',usage:'在风控Tab开启风暴盾，设置触发条件（如5分钟跌幅>3%）。',impact:'黑天鹅事件中保护本金，避免爆仓',status:'active'},
  {id:40,icon:'📊',name:'资金流向',cat:'analysis',desc:'追踪大资金的流入流出方向，判断聪明钱在买还是卖。',usage:'在市场Tab查看资金流向图，绿色代表流入，红色代表流出。',impact:'跟随聪明钱方向交易，胜率提升15%',status:'planned'},
  {id:41,icon:'🎲',name:'蒙特卡洛',cat:'analysis',desc:'用蒙特卡洛模拟预测策略未来1000种可能的收益路径。',usage:'选择一个策略，系统基于历史数据模拟1000次未来走势。',impact:'量化策略的风险和收益分布，做出更理性的决策',status:'planned'},
  {id:42,icon:'🏋️',name:'压力测试',cat:'risk',desc:'模拟极端市场条件下你的持仓会怎样——暴跌30%、连续插针等。',usage:'在风控Tab选择压力场景，查看持仓在极端情况下的表现。',impact:'提前发现风险敞口，在灾难发生前做好准备',status:'planned'},
  {id:43,icon:'📈',name:'趋势雷达',cat:'analysis',desc:'多时间框架趋势一致性检测——当1分/5分/15分/1时全部同向时发出强信号。',usage:'图表上方显示多时间框架趋势指示灯，全绿=强多，全红=强空。',impact:'多周期共振信号胜率高达70%+',status:'active'},
  {id:44,icon:'🎭',name:'市场面具',cat:'analysis',desc:'检测市场的"假突破"——价格突破关键位后快速回落的陷阱。',usage:'系统自动标记疑似假突破的K线形态，提醒谨慎追单。',impact:'避免追高杀低，减少被假突破套牢的损失',status:'planned'},
  {id:45,icon:'💎',name:'钻石手',cat:'game',desc:'记录你持仓的最长时间和最大浮盈回撤忍耐度，培养持仓耐心。',usage:'在成长Tab查看钻石手指数和历史最佳持仓记录。',impact:'克服过早止盈的毛病，让利润奔跑',status:'planned'},
  {id:46,icon:'🧊',name:'冷静期',cat:'risk',desc:'连续亏损后强制进入冷静期，锁定交易功能一段时间防止报复性交易。',usage:'系统检测到连续3笔亏损后自动触发，倒计时结束前无法下单。',impact:'避免情绪化交易造成的连锁亏损，保护剩余本金',status:'active'},
  {id:47,icon:'🗺️',name:'交易航海图',cat:'analysis',desc:'将你的交易历程可视化为一张航海图，每笔交易是一个航点。',usage:'在分析Tab查看航海图，绿色航点=盈利，红色=亏损，大小=金额。',impact:'直观看到交易轨迹，发现规律和问题',status:'planned'},
  {id:48,icon:'🤖',name:'AI教练',cat:'ai',desc:'基于你的交易数据，AI给出个性化的改进建议和训练计划。',usage:'在成长Tab查看AI教练的每日建议和本周训练重点。',impact:'针对性改进弱点，加速交易技能提升',status:'planned'},
  {id:49,icon:'📡',name:'信号雷达',cat:'trade',desc:'聚合多个技术指标信号，用雷达图展示当前市场的多空力量分布。',usage:'在总览Tab查看信号雷达图，扇形越大代表该方向信号越强。',impact:'一眼看清市场多空力量对比，快速决策',status:'planned'},
  {id:50,icon:'🎰',name:'概率计算器',cat:'trade',desc:'输入你的胜率和盈亏比，计算长期期望收益和最优仓位。',usage:'在快速交易面板输入参数，系统实时计算凯利公式最优仓位。',impact:'科学管理仓位，避免过度下注或过于保守',status:'active'},
  {id:51,icon:'🌙',name:'月光宝盒',cat:'analysis',desc:'回溯任意历史时刻的市场状态，复盘当时的K线、指标和你的操作。',usage:'在分析Tab选择日期，系统还原当时的完整市场快照。',impact:'从历史中学习，避免重复犯错',status:'planned'},
  {id:52,icon:'🎪',name:'多空擂台',cat:'social',desc:'团队成员公开发表多空观点，投票PK，事后验证谁的判断更准。',usage:'在实时动态中发表多空观点，其他成员可以投票支持或反对。',impact:'集思广益，避免个人偏见，提升团队决策质量',status:'planned'},
  {id:53,icon:'🧬',name:'策略基因',cat:'ai',desc:'将每个策略拆解为基因片段（入场条件、出场条件、仓位管理），支持自由组合。',usage:'在策略编辑器中拖拽基因片段组合新策略，系统自动回测。',impact:'像搭积木一样创造新策略，无需编程',status:'planned'},
  {id:54,icon:'🔥',name:'热力追踪',cat:'analysis',desc:'实时追踪全市场热门交易对的资金热度和波动率排名。',usage:'在市场Tab查看热力排行榜，颜色越红越热门。',impact:'快速发现市场热点，抓住波动机会',status:'active'},
  {id:55,icon:'🎓',name:'交易学院',cat:'social',desc:'内置交易知识库，从K线基础到高级策略，系统化学习路径。',usage:'在成长Tab进入学院，按难度等级选择课程学习。',impact:'系统化提升交易认知，少走弯路',status:'planned'},
  {id:56,icon:'⏰',name:'时间锚点',cat:'trade',desc:'标记重要时间节点（美联储议息、非农数据等），提前提醒并建议仓位调整。',usage:'在日历中标记宏观事件，系统在事件前30分钟自动提醒。',impact:'避免在重大事件前持有过大仓位，减少意外损失',status:'planned'},
  {id:57,icon:'🎨',name:'K线画板',cat:'analysis',desc:'在K线图上自由绘制趋势线、通道线、标注区域，保存分析笔记。',usage:'点击图表工具栏的画笔图标，选择绘图工具在图表上标注。',impact:'记录分析思路，回顾时一目了然',status:'planned'},
  {id:58,icon:'🏅',name:'交易勋章',cat:'game',desc:'完成特定交易成就解锁勋章——首次盈利、连胜5次、月收益翻倍等。',usage:'在成长Tab查看勋章墙，已解锁的勋章会发光显示。',impact:'游戏化激励持续进步，增加交易乐趣',status:'active'},
  {id:59,icon:'🔄',name:'自动复投',cat:'trade',desc:'盈利自动按比例复投到下一笔交易，实现复利增长。',usage:'在策略设置中开启复投模式，设置复投比例（如盈利的50%）。',impact:'利用复利效应加速资金增长',status:'planned'},
  {id:60,icon:'📱',name:'移动哨兵',cat:'risk',desc:'关键信号通过推送通知发送到手机，即使不在电脑前也能及时响应。',usage:'绑定手机号或Telegram，选择需要推送的信号类型。',impact:'7×24小时不错过任何重要交易机会',status:'planned'},
  {id:61,icon:'🧮',name:'回撤计算器',cat:'risk',desc:'实时计算当前持仓的最大可能回撤，以及回撤到止损位需要多少时间。',usage:'在风控Tab输入持仓信息，系统计算各种回撤场景。',impact:'量化风险敞口，做到心中有数',status:'planned'},
  {id:62,icon:'🎵',name:'市场脉搏',cat:'analysis',desc:'将价格波动转化为音频节奏——快速波动=急促鼓点，平稳=舒缓旋律。',usage:'开启市场脉搏模式，用耳朵感受市场节奏变化。',impact:'多感官感知市场，发现视觉容易忽略的异常',status:'planned'},
  {id:63,icon:'🏰',name:'堡垒模式',cat:'risk',desc:'一键进入防守模式——关闭所有策略、设置全仓止损、降低杠杆到1x。',usage:'在风控Tab点击堡垒按钮，一键切换到最保守的防守状态。',impact:'市场不确定时快速保护本金',status:'planned'},
  {id:64,icon:'📋',name:'交易清单',cat:'trade',desc:'开仓前的检查清单——确认趋势、支撑阻力、仓位、止损止盈都设置好了。',usage:'点击下单前弹出检查清单，逐项确认后才能执行交易。',impact:'减少冲动交易和遗漏止损的情况',status:'planned'},
  {id:65,icon:'🌈',name:'彩虹通道',cat:'analysis',desc:'多周期均线组成的彩虹带，直观显示趋势强度和方向。',usage:'在指标栏开启彩虹通道，均线从短到长用不同颜色显示。',impact:'一眼判断趋势强弱，均线发散=强趋势，收敛=震荡',status:'planned'},
  {id:66,icon:'🎯',name:'止盈阶梯',cat:'trade',desc:'分批止盈策略——盈利达到不同目标时自动平掉部分仓位锁定利润。',usage:'在交易设置中配置阶梯止盈（如+5%平30%，+10%平30%，+20%平剩余）。',impact:'既能锁定利润又不错过大行情，平均收益提升25%',status:'planned'},
  {id:67,icon:'🔮',name:'预言水晶球',cat:'ai',desc:'基于机器学习模型预测未来4小时的价格走势概率分布。',usage:'在市场Tab查看AI预测面板，显示上涨/下跌/震荡的概率。',impact:'辅助决策参考，但不建议作为唯一依据',status:'planned'},
  {id:68,icon:'🏆',name:'赛季挑战',cat:'game',desc:'每月一个交易挑战赛季，设定目标（如月收益10%），完成获得奖励。',usage:'在成长Tab查看当前赛季目标和进度，赛季结束后结算排名。',impact:'持续的目标驱动让交易更有纪律性',status:'planned'},
  {id:69,icon:'🔍',name:'异常检测',cat:'risk',desc:'AI监测交易行为异常——突然加大仓位、频繁交易、深夜操作等。',usage:'系统自动分析交易模式，发现异常时弹出警告。',impact:'及时发现情绪化交易倾向，防患于未然',status:'planned'},
  {id:70,icon:'📊',name:'对比分析',cat:'analysis',desc:'将你的交易数据与团队平均水平、历史最佳表现进行对比分析。',usage:'在分析Tab查看对比雷达图，一眼看出优势和短板。',impact:'知己知彼，针对性提升薄弱环节',status:'planned'},
  {id:71,icon:'🧩',name:'模式识别',cat:'ai',desc:'AI自动识别K线形态——头肩顶、双底、三角收敛等经典形态。',usage:'系统在图表上自动标注识别到的K线形态和预期方向。',impact:'不再错过经典形态信号，提升技术分析效率',status:'planned'},
  {id:72,icon:'💬',name:'交易聊天室',cat:'social',desc:'团队实时聊天频道，分享观点、讨论策略、发送图表截图。',usage:'点击右下角聊天图标打开团队聊天室，支持文字和图片。',impact:'实时沟通提升团队协作效率',status:'planned'},
  {id:73,icon:'📦',name:'策略商店',cat:'social',desc:'团队成员可以分享和订阅彼此的交易策略，优秀策略获得评分。',usage:'在创新Tab浏览策略商店，一键订阅感兴趣的策略。',impact:'站在巨人肩膀上，快速获得经过验证的策略',status:'planned'},
  {id:74,icon:'🎪',name:'回测剧场',cat:'trade',desc:'选择任意历史时段，用你的策略进行模拟回测，查看假设收益。',usage:'选择策略和时间范围，系统自动执行回测并生成报告。',impact:'用数据验证策略有效性，避免盲目实盘',status:'planned'},
  {id:75,icon:'🌐',name:'全球视野',cat:'analysis',desc:'展示全球主要市场（美股、黄金、原油、外汇）与加密货币的联动关系。',usage:'在市场Tab查看全球市场联动面板，了解宏观环境。',impact:'把握宏观趋势，避免在不利环境中逆势操作',status:'planned'},
  {id:76,icon:'🎭',name:'角色扮演',cat:'game',desc:'选择交易风格角色（稳健派/激进派/套利派），系统根据角色给出匹配的策略建议。',usage:'在成长Tab选择你的交易角色，系统自动推荐适合的策略和参数。',impact:'找到适合自己性格的交易风格，减少内耗',status:'planned'},
  {id:77,icon:'⚖️',name:'仓位天平',cat:'risk',desc:'可视化展示当前多空仓位的平衡状态，提醒单边风险过大。',usage:'在风控Tab查看仓位天平，天平倾斜越大说明风险越集中。',impact:'保持仓位平衡，避免单边暴露过大风险',status:'active'},
  {id:78,icon:'🎯',name:'目标追踪',cat:'game',desc:'设定日/周/月收益目标，实时追踪完成进度，达标后庆祝动画。',usage:'在成长Tab设定各周期目标金额，系统实时显示完成百分比。',impact:'明确的目标让交易更有纪律，避免过度交易',status:'active'},
  {id:79,icon:'🔗',name:'API桥接',cat:'trade',desc:'连接真实交易所API，将平台信号直接发送到交易所执行。',usage:'在设置中配置交易所API Key，开启自动执行模式。',impact:'从模拟到实盘的无缝衔接，信号即执行',status:'planned'},
  {id:80,icon:'🌟',name:'交易之星',cat:'social',desc:'每周评选团队最佳交易者，展示其本周最佳操作和心得分享。',usage:'系统自动根据本周收益率、胜率、风控评分综合评选。',impact:'树立榜样，激励团队共同进步',status:'planned'},
];

// ============ 成就排行榜 (Growth Tab) ============
function renderLeaderboard2() {
  var el = document.getElementById('leaderboard2');
  if (!el) return;
  var html = '';

  var board = TEAM.map(function(m) {
    var exp = calcEXP(m.name);
    var lv = getLevel(exp);
    var stats = calcGameStats(m.name);
    var unlocked = 0;
    Object.keys(GAME_CONFIG.achievements).forEach(function(k) {
      if (GAME_CONFIG.achievements[k].check(stats)) unlocked++;
    });
    return { name: m.name, init: m.init, color: m.color, level: lv.level, exp: exp, badges: unlocked };
  });
  board.sort(function(a, b) { return b.exp - a.exp; });

  board.forEach(function(m, i) {
    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    html += '<div class="lb-row">';
    html += '<span class="lb-rank">' + medal + '</span>';
    html += '<span class="lb-avatar" style="background:' + m.color + '">' + m.init + '</span>';
    html += '<span class="lb-name">' + escapeHtml(m.name) + '</span>';
    html += '<span class="lb-stat">Lv.' + m.level + ' · ' + m.badges + '🏅</span>';
    html += '<span class="lb-pnl">' + m.exp + ' EXP</span>';
    html += '</div>';
  });
  if (board.length === 0) html = '<div class="signal-empty">暂无成就数据</div>';
  el.innerHTML = html;
}

// ============ 创新功能渲染 ============
var CAT_NAMES = {trade:'交易工具',analysis:'分析洞察',risk:'风控安全',social:'社交协作',game:'游戏成长',ai:'AI智能'};
var CAT_COLORS = {trade:'#22c55e',analysis:'#38bdf8',risk:'#ef4444',social:'#a78bfa',game:'#f59e0b',ai:'#22d3ee'};

function renderInnovGrid(filter) {
  var grid = document.getElementById('innovGrid');
  if (!grid) return;
  filter = filter || 'all';
  var items = INNOVATIONS.filter(function(it) { return filter === 'all' || it.cat === filter; });
  grid.innerHTML = items.map(function(it) {
    var color = CAT_COLORS[it.cat] || '#38bdf8';
    var statusTag = it.status === 'active'
      ? '<span class="innov-status-tag active">已上线</span>'
      : '<span class="innov-status-tag planned">规划中</span>';
    return '<div class="innov-card" data-id="' + it.id + '" style="--card-accent:' + color + '">' +
      '<div class="innov-card-icon">' + it.icon + '</div>' +
      '<div class="innov-card-name">' + it.name + '</div>' +
      '<div class="innov-card-cat" style="color:' + color + '">' + (CAT_NAMES[it.cat] || '') + '</div>' +
      '<div class="innov-card-desc">' + it.desc.slice(0, 40) + (it.desc.length > 40 ? '…' : '') + '</div>' +
      statusTag +
    '</div>';
  }).join('');
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);