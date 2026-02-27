// ===== TeamTrade — 实时行情版 =====
// 数据源: Binance 公开 WebSocket + REST API（无需 API Key）

var TEAM = [
  { name: '张明', init: 'ZM', color: '#6366f1' },
  { name: '李薇', init: 'LW', color: '#3b82f6' },
  { name: '王浩', init: 'WH', color: '#f59e0b' },
  { name: '陈露', init: 'CL', color: '#8b5cf6' },
  { name: '赵强', init: 'ZQ', color: '#ef4444' },
  { name: '孙婷', init: 'ST', color: '#06b6d4' },
];

var STRATS = [
  { name: 'BTC 网格策略', type: '网格交易', pair: 'BTC/USDT', status: 'running', pnl: '+$2,340', trades: 142, progress: 72, bar: 'green' },
  { name: 'ETH 均线突破', type: '均线突破', pair: 'ETH/USDT', status: 'running', pnl: '+$890', trades: 56, progress: 45, bar: 'green' },
  { name: 'SOL RSI反弹', type: 'RSI超卖', pair: 'SOL/USDT', status: 'paused', pnl: '-$120', trades: 23, progress: 30, bar: 'amber' },
  { name: 'BNB MACD金叉', type: 'MACD', pair: 'BNB/USDT', status: 'running', pnl: '+$456', trades: 38, progress: 60, bar: 'green' },
  { name: 'DOGE 布林带', type: '布林带', pair: 'DOGE/USDT', status: 'stopped', pnl: '-$67', trades: 12, progress: 15, bar: 'red' },
];

var SIGNALS = [];

// ===== 交易对配置 =====
var SYMBOL_MAP = {
  'BTC/USDT': 'btcusdt',
  'ETH/USDT': 'ethusdt',
  'SOL/USDT': 'solusdt',
  'BNB/USDT': 'bnbusdt',
};
var SYMBOL_LIST = Object.keys(SYMBOL_MAP);
var currentSymbol = 'BTC/USDT';
var currentInterval = '1m';

// 时间周期映射
var TF_MAP = { '1分': '1m', '5分': '5m', '15分': '15m', '1时': '1h', '4时': '4h', '1日': '1d' };

// ===== 实时数据存储 =====
var tickerData = {};    // { 'BTC/USDT': { price, chg, high, low, vol } }
var klineData = [];     // 当前交易对的K线
var depthData = { asks: [], bids: [] };

// WebSocket 连接
var wsKline = null;
var wsTicker = null;
var wsDepth = null;

// ===== 工具函数 =====
function formatPrice(p) {
  p = parseFloat(p);
  if (isNaN(p)) return '--';
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}
function timeAgo(i) {
  var u = ['刚刚','1分钟前','2分钟前','3分钟前','5分钟前','8分钟前','12分钟前','15分钟前','20分钟前','30分钟前'];
  return u[i % u.length];
}
function randBetween(a, b) { return a + Math.random() * (b - a); }

// ===== 时钟 =====
function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = h + ':' + m + ':' + s;
}

// ===== Binance REST: 拉取历史K线 =====
function fetchKlineHistory(symbol, interval, cb) {
  var sym = SYMBOL_MAP[symbol] ? SYMBOL_MAP[symbol].toUpperCase() : 'BTCUSDT';
  var url = 'https://api.binance.com/api/v3/klines?symbol=' + sym + '&interval=' + interval + '&limit=80';
  fetch(url).then(function(r) { return r.json(); }).then(function(data) {
    klineData = data.map(function(d) {
      return { t: d[0], o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5]) };
    });
    if (cb) cb();
  }).catch(function(e) { console.warn('K线历史拉取失败:', e); });
}

// ===== Binance REST: 拉取所有交易对 24h Ticker =====
function fetchAllTickers(cb) {
  var syms = Object.values(SYMBOL_MAP).map(function(s) { return '"' + s.toUpperCase() + '"'; });
  var url = 'https://api.binance.com/api/v3/ticker/24hr?symbols=[' + syms.join(',') + ']';
  fetch(url).then(function(r) { return r.json(); }).then(function(data) {
    data.forEach(function(t) {
      var key = SYMBOL_LIST.find(function(k) { return SYMBOL_MAP[k] === t.symbol.toLowerCase(); });
      if (key) {
        tickerData[key] = {
          price: parseFloat(t.lastPrice),
          chg: parseFloat(t.priceChangePercent),
          high: parseFloat(t.highPrice),
          low: parseFloat(t.lowPrice),
          vol: parseFloat(t.volume)
        };
      }
    });
    if (cb) cb();
  }).catch(function(e) { console.warn('Ticker拉取失败:', e); });
}

// ===== WebSocket: 全币种 Ticker 实时推送 =====
function connectTickerWS() {
  if (wsTicker) wsTicker.close();
  var streams = Object.values(SYMBOL_MAP).map(function(s) { return s + '@ticker'; });
  var url = 'wss://stream.binance.com:9443/stream?streams=' + streams.join('/');
  wsTicker = new WebSocket(url);
  wsTicker.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    var d = msg.data;
    if (!d || !d.s) return;
    var key = SYMBOL_LIST.find(function(k) { return SYMBOL_MAP[k] === d.s.toLowerCase(); });
    if (!key) return;
    tickerData[key] = {
      price: parseFloat(d.c),
      chg: parseFloat(d.P),
      high: parseFloat(d.h),
      low: parseFloat(d.l),
      vol: parseFloat(d.v)
    };
    updateTickerBar();
    if (key === currentSymbol) updatePriceDisplay();
  };
  wsTicker.onclose = function() { setTimeout(connectTickerWS, 3000); };
}

// ===== WebSocket: K线实时推送 =====
function connectKlineWS() {
  if (wsKline) wsKline.close();
  var sym = SYMBOL_MAP[currentSymbol];
  var url = 'wss://stream.binance.com:9443/ws/' + sym + '@kline_' + currentInterval;
  wsKline = new WebSocket(url);
  wsKline.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    var k = msg.k;
    if (!k) return;
    var bar = { t: k.t, o: parseFloat(k.o), h: parseFloat(k.h), l: parseFloat(k.l), c: parseFloat(k.c), v: parseFloat(k.v) };
    // 更新最后一根或追加新K线
    if (klineData.length && klineData[klineData.length - 1].t === bar.t) {
      klineData[klineData.length - 1] = bar;
    } else {
      klineData.push(bar);
      if (klineData.length > 80) klineData.shift();
    }
    drawKline();
    drawVolume();
    // 生成信号
    if (k.x) pushAutoSignal(bar);
  };
  wsKline.onclose = function() { setTimeout(connectKlineWS, 3000); };
}

// ===== WebSocket: 盘口深度 =====
function connectDepthWS() {
  if (wsDepth) wsDepth.close();
  var sym = SYMBOL_MAP[currentSymbol];
  var url = 'wss://stream.binance.com:9443/ws/' + sym + '@depth10@100ms';
  wsDepth = new WebSocket(url);
  wsDepth.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.asks && msg.bids) {
      depthData.asks = msg.asks.map(function(a) { return { p: parseFloat(a[0]), q: parseFloat(a[1]) }; });
      depthData.bids = msg.bids.map(function(b) { return { p: parseFloat(b[0]), q: parseFloat(b[1]) }; });
      renderOrderbook();
    }
  };
  wsDepth.onclose = function() { setTimeout(connectDepthWS, 3000); };
}

// ===== 自动信号生成 =====
function pushAutoSignal(bar) {
  var chg = ((bar.c - bar.o) / bar.o * 100).toFixed(2);
  var member = TEAM[Math.floor(Math.random() * TEAM.length)];
  var sig;
  if (parseFloat(chg) > 0.3) {
    sig = { type: 'buy', icon: '▲', text: member.name + ' 买入 ' + currentSymbol + ' @ ' + formatPrice(bar.c), time: new Date() };
  } else if (parseFloat(chg) < -0.3) {
    sig = { type: 'sell', icon: '▼', text: member.name + ' 卖出 ' + currentSymbol + ' @ ' + formatPrice(bar.c), time: new Date() };
  } else {
    sig = { type: 'info', icon: 'ℹ', text: currentSymbol + ' K线收盘 ' + formatPrice(bar.c) + ' (' + chg + '%)', time: new Date() };
  }
  SIGNALS.unshift(sig);
  if (SIGNALS.length > 30) SIGNALS.pop();
  renderSignals();
}

// ===== 行情滚动条（实时数据驱动） =====
function updateTickerBar() {
  var track = document.getElementById('tickerTrack');
  if (!track) return;
  var html = '';
  for (var r = 0; r < 2; r++) {
    for (var i = 0; i < SYMBOL_LIST.length; i++) {
      var key = SYMBOL_LIST[i];
      var t = tickerData[key] || { price: 0, chg: 0 };
      var cls = t.chg >= 0 ? 'up' : 'down';
      var sign = t.chg >= 0 ? '+' : '';
      html += '<span class="ticker-item">' +
        '<span class="ticker-sym">' + key + '</span>' +
        '<span class="ticker-price">' + formatPrice(t.price) + '</span>' +
        '<span class="ticker-chg ' + cls + '">' + sign + t.chg.toFixed(2) + '%</span></span>';
    }
  }
  track.innerHTML = html;
}

// ===== 价格显示更新 =====
function updatePriceDisplay() {
  var t = tickerData[currentSymbol];
  if (!t) return;
  var pm = document.getElementById('priceMain');
  var pc = document.getElementById('priceChange');
  var ob = document.getElementById('obMidPrice');
  var tp = document.getElementById('tradePrice');
  if (pm) pm.textContent = formatPrice(t.price);
  if (pc) {
    var sign = t.chg >= 0 ? '+' : '';
    pc.textContent = sign + t.chg.toFixed(2) + '%';
    pc.className = 'price-badge ' + (t.chg >= 0 ? 'up' : 'down');
  }
  if (ob) ob.textContent = formatPrice(t.price);
  if (tp) tp.value = formatPrice(t.price);
}

// ===== 绘制K线 =====
function drawKline() {
  var canvas = document.getElementById('klineCanvas');
  var area = document.getElementById('chartArea');
  if (!canvas || !area) return;
  var dpr = window.devicePixelRatio || 1;
  var W = area.clientWidth;
  var H = area.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!klineData.length) return;

  var pad = { top: 60, bottom: 20, left: 10, right: 10 };
  var cw = (W - pad.left - pad.right) / klineData.length;
  var maxP = -Infinity, minP = Infinity;
  for (var k = 0; k < klineData.length; k++) {
    if (klineData[k].h > maxP) maxP = klineData[k].h;
    if (klineData[k].l < minP) minP = klineData[k].l;
  }
  var range = maxP - minP || 1;
  function yPos(p) { return pad.top + (1 - (p - minP) / range) * (H - pad.top - pad.bottom); }

  // 网格
  ctx.strokeStyle = '#e8eaf0';
  ctx.lineWidth = 0.5;
  for (var g = 0; g < 5; g++) {
    var gy = pad.top + g * (H - pad.top - pad.bottom) / 4;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
  }

  // 蜡烛
  for (var i = 0; i < klineData.length; i++) {
    var d = klineData[i];
    var x = pad.left + i * cw + cw / 2;
    var bull = d.c >= d.o;
    var color = bull ? '#22c55e' : '#ef4444';
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yPos(d.h)); ctx.lineTo(x, yPos(d.l)); ctx.stroke();
    var bTop = yPos(Math.max(d.o, d.c));
    var bBot = yPos(Math.min(d.o, d.c));
    var bH = Math.max(bBot - bTop, 1);
    var bw = cw * 0.6;
    ctx.fillStyle = color;
    ctx.fillRect(x - bw / 2, bTop, bw, bH);
  }
}

// ===== 成交量柱 =====
function drawVolume() {
  var bar = document.getElementById('volumeBar');
  if (!bar || !klineData.length) return;
  var maxV = 0;
  for (var k = 0; k < klineData.length; k++) { if (klineData[k].v > maxV) maxV = klineData[k].v; }
  var html = '';
  for (var i = 0; i < klineData.length; i++) {
    var d = klineData[i];
    var h = Math.round((d.v / maxV) * 34) + 2;
    var c = d.c >= d.o ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
    html += '<div style="flex:1;height:' + h + 'px;background:' + c + ';border-radius:2px 2px 0 0"></div>';
  }
  bar.innerHTML = html;
}

// ===== 盘口渲染（实时深度数据） =====
function renderOrderbook() {
  var asks = document.getElementById('obAsks');
  var bids = document.getElementById('obBids');
  var spread = document.getElementById('spreadVal');
  if (!asks || !bids) return;
  var maxQ = 0;
  depthData.asks.forEach(function(a) { if (a.q > maxQ) maxQ = a.q; });
  depthData.bids.forEach(function(b) { if (b.q > maxQ) maxQ = b.q; });
  if (!maxQ) maxQ = 1;

  var ahtml = '';
  var sortedAsks = depthData.asks.slice().sort(function(a, b) { return b.p - a.p; });
  for (var i = 0; i < sortedAsks.length; i++) {
    var a = sortedAsks[i];
    var w = Math.round((a.q / maxQ) * 100);
    ahtml += '<div class="ob-row"><div class="ob-bg" style="width:' + w + '%"></div>' +
      '<span class="ob-price">' + formatPrice(a.p) + '</span><span class="ob-amount">' + a.q.toFixed(4) + '</span></div>';
  }

  var bhtml = '';
  for (var j = 0; j < depthData.bids.length; j++) {
    var b = depthData.bids[j];
    var bw = Math.round((b.q / maxQ) * 100);
    bhtml += '<div class="ob-row"><div class="ob-bg" style="width:' + bw + '%"></div>' +
      '<span class="ob-price">' + formatPrice(b.p) + '</span><span class="ob-amount">' + b.q.toFixed(4) + '</span></div>';
  }

  asks.innerHTML = ahtml;
  bids.innerHTML = bhtml;
  if (spread && depthData.asks.length && depthData.bids.length) {
    var sp = (depthData.asks[0].p - depthData.bids[0].p).toFixed(2);
    spread.textContent = sp;
  }
}

// ===== 团队持仓 =====
function renderPositions() {
  var el = document.getElementById('positionsList');
  if (!el) return;
  var pairs = SYMBOL_LIST;
  var html = '';
  for (var i = 0; i < TEAM.length; i++) {
    var t = TEAM[i];
    var pair = pairs[i % pairs.length];
    var td = tickerData[pair];
    var pnl = td ? (td.chg * randBetween(50, 200)).toFixed(0) : '0';
    var isUp = parseFloat(pnl) >= 0;
    var size = randBetween(0.01, 5).toFixed(3);
    html += '<div class="member-row">' +
      '<div class="member-left">' +
        '<div class="member-avatar" style="background:' + t.color + '">' + t.init + '</div>' +
        '<div><div class="member-name">' + t.name + '</div>' +
        '<div class="member-pair">' + pair + '</div></div>' +
      '</div>' +
      '<div class="member-right">' +
        '<div class="member-pnl ' + (isUp ? 'up' : 'down') + '">' + (isUp ? '+' : '') + '$' + Math.abs(pnl) + '</div>' +
        '<div class="member-size">' + size + '</div>' +
      '</div></div>';
  }
  el.innerHTML = html;
}

// ===== 智能策略 =====
function renderStrategies() {
  var el = document.getElementById('strategyList');
  if (!el) return;
  var html = '';
  for (var i = 0; i < STRATS.length; i++) {
    var s = STRATS[i];
    var st = s.status === 'running' ? '运行中' : s.status === 'paused' ? '已暂停' : '已停止';
    html += '<div class="strat-item">' +
      '<div class="strat-top"><span class="strat-name">' + s.name + '</span>' +
      '<span class="strat-badge ' + s.status + '">' + st + '</span></div>' +
      '<div class="strat-meta"><span>' + s.type + '</span><span>' + s.pair + '</span>' +
      '<span>盈亏 ' + s.pnl + '</span><span>' + s.trades + ' 笔</span></div>' +
      '<div class="strat-bar"><div class="strat-bar-fill ' + s.bar + '" style="width:' + s.progress + '%"></div></div></div>';
  }
  el.innerHTML = html;
}

// ===== 实时动态 =====
function renderSignals(filter) {
  var el = document.getElementById('signalFeed');
  if (!el) return;
  filter = filter || 'all';
  var html = '';
  for (var i = 0; i < SIGNALS.length; i++) {
    var s = SIGNALS[i];
    if (filter !== 'all' && s.type !== filter) continue;
    html += '<div class="feed-item ' + s.type + '">' +
      '<div class="feed-icon">' + s.icon + '</div>' +
      '<div><div class="feed-text">' + s.text + '</div>' +
      '<div class="feed-time">' + timeAgo(i) + '</div></div></div>';
  }
  if (!html) html = '<div style="text-align:center;color:#94a3b8;padding:24px">等待实时信号...</div>';
  el.innerHTML = html;
}

// ===== 切换交易对 =====
function switchSymbol(sym) {
  currentSymbol = sym;
  fetchKlineHistory(sym, currentInterval, function() {
    drawKline();
    drawVolume();
  });
  connectKlineWS();
  connectDepthWS();
  updatePriceDisplay();
}

// ===== 交互绑定 =====
function initInteractions() {
  // 导航标签
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
    });
  });

  // 时间周期按钮
  var tfBtns = document.querySelectorAll('.tf-btn');
  tfBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tfBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tf = TF_MAP[btn.textContent.trim()];
      if (tf) {
        currentInterval = tf;
        fetchKlineHistory(currentSymbol, tf, function() {
          drawKline(); drawVolume();
        });
        connectKlineWS();
      }
    });
  });

  // 信号过滤
  var filterMap = { '全部': 'all', '买入': 'buy', '卖出': 'sell', '提醒': 'alert' };
  var filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderSignals(filterMap[btn.textContent.trim()] || 'all');
    });
  });

  // 买卖切换
  var btnBuy = document.getElementById('btnBuy');
  var btnSell = document.getElementById('btnSell');
  var btnExec = document.getElementById('btnExecute');
  if (btnBuy && btnSell) {
    btnBuy.addEventListener('click', function() {
      btnBuy.classList.add('active'); btnSell.classList.remove('active');
      if (btnExec) { btnExec.className = 'btn-exec buy'; btnExec.textContent = '确认买入'; }
    });
    btnSell.addEventListener('click', function() {
      btnSell.classList.add('active'); btnBuy.classList.remove('active');
      if (btnExec) { btnExec.className = 'btn-exec sell'; btnExec.textContent = '确认卖出'; }
    });
  }

  // 杠杆滑块
  var slider = document.getElementById('leverageSlider');
  var leverVal = document.getElementById('leverageVal');
  if (slider && leverVal) {
    slider.addEventListener('input', function() { leverVal.textContent = slider.value + 'x'; });
  }

  // 百分比按钮
  var pctBtns = document.querySelectorAll('.pct-btn');
  var amountInput = document.getElementById('tradeAmount');
  pctBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var pcts = { '25%': 0.25, '50%': 0.5, '75%': 0.75, '全部': 1 };
      var pct = pcts[btn.textContent.trim()] || 0.25;
      if (amountInput) amountInput.value = (10000 * pct).toFixed(2);
    });
  });

  // 新建策略弹窗
  var overlay = document.getElementById('modalOverlay');
  var btnAdd = document.getElementById('btnAddStrategy');
  var btnClose = document.getElementById('modalClose');
  if (btnAdd && overlay) {
    btnAdd.addEventListener('click', function() { overlay.classList.add('active'); });
  }
  if (btnClose && overlay) {
    btnClose.addEventListener('click', function() { overlay.classList.remove('active'); });
  }
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }

  // 交易对切换
  var symSelect = document.getElementById('symbolSelect');
  if (symSelect) {
    symSelect.addEventListener('change', function() {
      var sym = symSelect.options[symSelect.selectedIndex].text;
      switchSymbol(sym);
    });
  }

  // 窗口缩放重绘
  window.addEventListener('resize', function() { drawKline(); });
}

// ===== 初始化 =====
function init() {
  // 时钟
  setInterval(updateClock, 1000);
  updateClock();

  // 静态渲染
  renderStrategies();
  renderSignals();
  renderPositions();
  initInteractions();

  // 拉取初始数据，然后连接 WebSocket
  fetchAllTickers(function() {
    updateTickerBar();
    updatePriceDisplay();
    renderPositions();
  });

  fetchKlineHistory(currentSymbol, currentInterval, function() {
    drawKline();
    drawVolume();
  });

  // 启动 WebSocket 实时流
  connectTickerWS();
  connectKlineWS();
  connectDepthWS();

  // 定时刷新持仓（基于实时 ticker 数据）
  setInterval(renderPositions, 10000);
}

document.addEventListener('DOMContentLoaded', init);