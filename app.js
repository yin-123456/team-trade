// ============================================================
// TeamTrade Dashboard - app.js
// Real-time trading dashboard with Binance WebSocket/REST API
// ============================================================

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
  '均线交叉策略', '布林带突破策略', 'RSI反转策略', 'MACD趋势策略', '网格交易策略'
];

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

let wsKline = null;
let wsTicker = null;
let wsDepth = null;

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
      journal[i].pnlPct = entry > 0 ? ((journal[i].pnl / (entry * qty)) * 100) : 0;
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
  wsTicker.onerror = function(e) { console.error('Ticker WS error:', e); };
  wsTicker.onclose = function() { setTimeout(connectTickerWS, 3000); };
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
      drawKline();
      drawVolume();
    }
  };
  wsKline.onerror = function(e) { console.error('Kline WS error:', e); };
  wsKline.onclose = function() { setTimeout(connectKlineWS, 3000); };
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
  wsDepth.onerror = function(e) { console.error('Depth WS error:', e); };
  wsDepth.onclose = function() { setTimeout(connectDepthWS, 3000); };
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
// Chart Drawing - drawKline (Main Chart Function)
// ============================================================

function drawKline() {
  var canvas = document.getElementById('klineCanvas');
  if (!canvas || klineData.length === 0) return;
  var area = document.getElementById('chartArea');
  if (area) {
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight || 400;
  }
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  var pad = { top: 20, bottom: 30, left: 10, right: 60 };
  var chartW = W - pad.left - pad.right;
  var chartH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  var data = klineData;
  var n = data.length;
  var barW = Math.max(2, Math.floor(chartW / n) - 2);
  var gap = Math.max(1, Math.floor((chartW - barW * n) / n));
  var totalBarW = barW + gap;

  // Find price range
  var hi = -Infinity, lo = Infinity;
  for (var i = 0; i < n; i++) {
    var h = parseFloat(data[i].high);
    var l = parseFloat(data[i].low);
    if (h > hi) hi = h;
    if (l < lo) lo = l;
  }
  var range = hi - lo || 1;
  hi += range * 0.05;
  lo -= range * 0.05;
  range = hi - lo;

  function yPos(price) { return pad.top + (1 - (price - lo) / range) * chartH; }
  function xPos(idx) { return pad.left + idx * totalBarW + barW / 2; }

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (var g = 0; g <= 5; g++) {
    var gy = pad.top + (chartH / 5) * g;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
    var gPrice = hi - (range / 5) * g;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatPrice(gPrice), W - 5, gy + 3);
  }

  // Draw candlesticks
  for (var i = 0; i < n; i++) {
    var o = parseFloat(data[i].open);
    var c = parseFloat(data[i].close);
    var h = parseFloat(data[i].high);
    var l = parseFloat(data[i].low);
    var bull = c >= o;
    var color = bull ? '#22c55e' : '#ef4444';
    var x = pad.left + i * totalBarW;
    var xMid = x + barW / 2;

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xMid, yPos(h));
    ctx.lineTo(xMid, yPos(l));
    ctx.stroke();

    // Body
    var yTop = yPos(Math.max(o, c));
    var yBot = yPos(Math.min(o, c));
    var bodyH = Math.max(1, yBot - yTop);
    ctx.fillStyle = color;
    ctx.fillRect(x, yTop, barW, bodyH);
  }

  // --- Indicator Overlays ---
  // Helper to draw a line series
  function drawLine(series, color, width, dashed) {
    if (series.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1.5;
    if (dashed) ctx.setLineDash([4, 3]);
    else ctx.setLineDash([]);
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < series.length; i++) {
      var px = xPos(series[i].idx);
      var py = yPos(series[i].val);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // MA7 line
  var ma7Vals = null;
  if (indicators.ma7) {
    ma7Vals = calcMA(data, 7);
    drawLine(ma7Vals, '#f59e0b', 1.5, false);
  }

  // MA25 line
  var ma25Vals = null;
  if (indicators.ma25) {
    ma25Vals = calcMA(data, 25);
    drawLine(ma25Vals, '#6366f1', 1.5, false);
  }

  // Bollinger Bands
  if (indicators.boll) {
    var boll = calcBoll(data, 20, 2);
    drawLine(boll.upper, '#ef4444', 1, true);
    drawLine(boll.mid, '#94a3b8', 1, false);
    drawLine(boll.lower, '#22c55e', 1, true);
    // Fill between upper and lower
    if (boll.upper.length > 1) {
      ctx.fillStyle = 'rgba(99,102,241,0.06)';
      ctx.beginPath();
      ctx.moveTo(xPos(boll.upper[0].idx), yPos(boll.upper[0].val));
      for (var i = 1; i < boll.upper.length; i++) {
        ctx.lineTo(xPos(boll.upper[i].idx), yPos(boll.upper[i].val));
      }
      for (var i = boll.lower.length - 1; i >= 0; i--) {
        ctx.lineTo(xPos(boll.lower[i].idx), yPos(boll.lower[i].val));
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- Draw Buy/Sell Markers from tradeMarkers ---
  for (var i = 0; i < tradeMarkers.length; i++) {
    var mk = tradeMarkers[i];
    var mx = xPos(mk.idx);
    if (mk.type === 'buy') {
      // Green triangle pointing up below candle low
      var my = yPos(parseFloat(data[mk.idx].low)) + 12;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.moveTo(mx, my - 8);
      ctx.lineTo(mx - 5, my);
      ctx.lineTo(mx + 5, my);
      ctx.closePath();
      ctx.fill();
      // Label
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('买', mx, my + 10);
    } else {
      // Red triangle pointing down above candle high
      var my = yPos(parseFloat(data[mk.idx].high)) - 12;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(mx, my + 8);
      ctx.lineTo(mx - 5, my);
      ctx.lineTo(mx + 5, my);
      ctx.closePath();
      ctx.fill();
      // Label
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('卖', mx, my - 4);
    }
  }

  // --- Update chart overlay tags with current indicator values ---
  var tagsEl = document.getElementById('chartTags');
  if (tagsEl) {
    var tagHtml = '';
    if (indicators.ma7 && ma7Vals && ma7Vals.length > 0) {
      var v = ma7Vals[ma7Vals.length - 1].val;
      tagHtml += '<span style="color:#f59e0b">MA7: ' + formatPrice(v) + '</span> ';
    }
    if (indicators.ma25 && ma25Vals && ma25Vals.length > 0) {
      var v = ma25Vals[ma25Vals.length - 1].val;
      tagHtml += '<span style="color:#6366f1">MA25: ' + formatPrice(v) + '</span> ';
    }
    if (indicators.rsi) {
      var rsiVals = calcRSI(data, 14);
      if (rsiVals.length > 0) {
        tagHtml += '<span style="color:#a855f7">RSI: ' + rsiVals[rsiVals.length - 1].val.toFixed(1) + '</span> ';
      }
    }
    if (indicators.macd) {
      var macdRes = calcMACD(data);
      if (macdRes.macd.length > 0) {
        var mv = macdRes.macd[macdRes.macd.length - 1].val;
        tagHtml += '<span style="color:#3b82f6">MACD: ' + mv.toFixed(2) + '</span> ';
      }
      if (macdRes.signal.length > 0) {
        var sv = macdRes.signal[macdRes.signal.length - 1].val;
        tagHtml += '<span style="color:#f59e0b">SIG: ' + sv.toFixed(2) + '</span> ';
      }
    }
    if (indicators.boll) {
      var bollRes = calcBoll(data, 20, 2);
      if (bollRes.upper.length > 0) {
        tagHtml += '<span style="color:#ef4444">UB: ' + formatPrice(bollRes.upper[bollRes.upper.length - 1].val) + '</span> ';
        tagHtml += '<span style="color:#22c55e">LB: ' + formatPrice(bollRes.lower[bollRes.lower.length - 1].val) + '</span> ';
      }
    }
    tagsEl.innerHTML = tagHtml;
  }
}

// ============================================================
// Chart Drawing - Volume
// ============================================================

function drawVolume() {
  var el = document.getElementById('volumeBar');
  if (!el || klineData.length === 0) return;
  var html = '';
  var maxVol = 0;
  for (var i = 0; i < klineData.length; i++) {
    var v = parseFloat(klineData[i].volume);
    if (v > maxVol) maxVol = v;
  }
  for (var i = 0; i < klineData.length; i++) {
    var v = parseFloat(klineData[i].volume);
    var pct = maxVol > 0 ? (v / maxVol * 100) : 0;
    var bull = parseFloat(klineData[i].close) >= parseFloat(klineData[i].open);
    var color = bull ? '#22c55e' : '#ef4444';
    html += '<div style="display:inline-block;width:' + Math.max(2, Math.floor(100 / klineData.length) - 1) + '%;height:' + pct + '%;background:' + color + ';opacity:0.6;vertical-align:bottom;margin-right:1px"></div>';
  }
  el.innerHTML = '<div style="display:flex;align-items:flex-end;height:100%">' + html + '</div>';
}

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
  var html = '';
  TEAM.forEach(function(m, idx) {
    var pair = SYMBOL_LIST[idx % SYMBOL_LIST.length];
    var key = SYMBOL_MAP[pair].toUpperCase();
    var t = tickerData[key];
    var price = t ? formatPrice(t.price) : '--';
    var pnl = randBetween(-500, 3000).toFixed(2);
    var pnlNum = parseFloat(pnl);
    var pnlCls = pnlNum >= 0 ? 'green' : 'red';
    var pnlSign = pnlNum >= 0 ? '+$' : '-$';
    var side = idx % 2 === 0 ? 'LONG' : 'SHORT';
    var sideCls = side === 'LONG' ? 'tag-long' : 'tag-short';
    var lev = Math.floor(randBetween(2, 20));

    html += '<div class="position-row">';
    html += '<div class="pos-avatar" style="background:' + m.color + '">' + m.init + '</div>';
    html += '<div class="pos-info">';
    html += '<div class="pos-name">' + m.name + ' <span class="' + sideCls + '">' + side + ' ' + lev + 'x</span></div>';
    html += '<div class="pos-detail">' + pair + ' @ $' + price + '</div>';
    html += '</div>';
    html += '<div class="pos-pnl ' + pnlCls + '">' + pnlSign + Math.abs(pnlNum).toFixed(2) + '</div>';
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
  var html = '';
  STRATS.forEach(function(name, idx) {
    var pair = SYMBOL_LIST[idx % SYMBOL_LIST.length];
    var status = idx < 3 ? 'running' : (idx === 3 ? 'paused' : 'stopped');
    var statusCls = status === 'running' ? 'st-run' : (status === 'paused' ? 'st-pause' : 'st-stop');
    var statusTxt = status === 'running' ? '运行中' : (status === 'paused' ? '已暂停' : '已停止');
    var pnl = randBetween(-200, 2000).toFixed(2);
    var pnlNum = parseFloat(pnl);
    var pnlCls = pnlNum >= 0 ? 'green' : 'red';
    var pnlStr = (pnlNum >= 0 ? '+$' : '-$') + Math.abs(pnlNum).toFixed(2);
    var trades = Math.floor(randBetween(5, 150));
    var progress = Math.floor(randBetween(10, 95));

    html += '<div class="strat-card">';
    html += '<div class="strat-header">';
    html += '<span class="strat-name">' + name + '</span>';
    html += '<span class="strat-status ' + statusCls + '">' + statusTxt + '</span>';
    html += '</div>';
    html += '<div class="strat-pair">' + pair + '</div>';
    html += '<div class="strat-stats">';
    html += '<span>交易: ' + trades + '</span>';
    html += '<span class="' + pnlCls + '">PnL: ' + pnlStr + '</span>';
    html += '</div>';
    html += '<div class="strat-progress"><div class="strat-bar" style="width:' + progress + '%"></div></div>';
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
    html += '<div class="sig-text">' + icon + ' ' + s.text + '</div>';
    html += '<div class="sig-meta">' + s.member + ' · ' + (s.time || timeAgo(idx)) + ' · ' + s.pair + '</div>';
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
    html += '<div class="j-strat">策略: <b>' + (e.strategy || '--') + '</b>';
    if (e.method) html += ' · 方法: ' + e.method;
    html += '</div>';
    if (e.note) html += '<div class="j-note">' + e.note + '</div>';
    if (e.closeNote) html += '<div class="j-note">平仓心得: ' + e.closeNote + '</div>';
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
    drawKline();
    drawVolume();
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
        drawKline();
        drawVolume();
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

  // Percentage buttons (25%, 50%, 75%, 100%)
  document.querySelectorAll('.pct-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.pct-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var pct = parseInt(btn.getAttribute('data-pct')) || 0;
      var amountEl = document.getElementById('tradeAmount');
      if (amountEl) {
        var maxAmount = 10;
        amountEl.value = (maxAmount * pct / 100).toFixed(4);
      }
    });
  });

  // Execute trade button
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
      var member = TEAM[Math.floor(Math.random() * TEAM.length)];
      var direction = side === 'long' ? '买入' : '卖出';

      // Write to journal
      addJournalEntry({
        side: side,
        symbol: currentSymbol,
        entryPrice: price,
        amount: amount,
        leverage: leverage,
        strategy: strategy,
        method: method,
        note: note,
        member: member.name,
        capital: member.capital,
        source: 'manual'
      });

      SIGNALS.unshift({
        type: side,
        text: direction + ' ' + currentSymbol + ' @ $' + formatPrice(price) + ' x ' + amount + ' [' + strategy + ']',
        member: member.name,
        init: member.init,
        color: member.color,
        time: '刚刚',
        pair: currentSymbol
      });
      if (SIGNALS.length > 50) SIGNALS.length = 50;
      renderSignals();
      renderJournal();
      renderAnalytics();

      // Clear note field after trade
      if (noteEl) noteEl.value = '';
      if (methodEl) methodEl.value = '';
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
        drawKline();
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

  // Window resize - redraw chart
  window.addEventListener('resize', function() {
    drawKline();
    drawVolume();
  });
}

// ============================================================
// Init Function
// ============================================================

function init() {
  // Setup clock
  updateClock();
  setInterval(updateClock, 1000);

  // Render static content
  renderStrategies();
  renderSignals();
  renderJournal();
  renderAnalytics();

  // Fetch initial ticker data
  fetchAllTickers(function() {
    updateTickerBar();
    updatePriceDisplay();
    renderPositions();
  });

  // Fetch initial K-line data
  fetchKlineHistory(currentSymbol, currentInterval, function() {
    drawKline();
    drawVolume();
  });

  // Connect WebSocket streams
  connectTickerWS();
  connectKlineWS();
  connectDepthWS();

  // Setup event bindings
  initInteractions();

  // Refresh positions periodically
  setInterval(function() {
    fetchAllTickers(function() {
      updateTickerBar();
      updatePriceDisplay();
      renderPositions();
    });
  }, 30000);
}

// ============================================================
// Bootstrap
// ============================================================

document.addEventListener('DOMContentLoaded', init);