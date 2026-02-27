// ===== TeamTrade — 核心交互逻辑 =====

var TEAM = [
  { name: '张明', init: 'ZM', color: '#6366f1' },
  { name: '李薇', init: 'LW', color: '#3b82f6' },
  { name: '王浩', init: 'WH', color: '#f59e0b' },
  { name: '陈露', init: 'CL', color: '#8b5cf6' },
  { name: '赵强', init: 'ZQ', color: '#ef4444' },
  { name: '孙婷', init: 'ST', color: '#06b6d4' },
];

var SYMBOLS = [
  { sym: 'BTC/USDT', price: 68432.50, chg: 2.34 },
  { sym: 'ETH/USDT', price: 3856.20, chg: -1.12 },
  { sym: 'SOL/USDT', price: 142.85, chg: 5.67 },
  { sym: 'BNB/USDT', price: 612.30, chg: 0.89 },
  { sym: 'XRP/USDT', price: 0.6234, chg: -0.45 },
  { sym: 'ADA/USDT', price: 0.4521, chg: 3.21 },
  { sym: 'DOGE/USDT', price: 0.1234, chg: -2.10 },
  { sym: 'AVAX/USDT', price: 38.92, chg: 1.56 },
  { sym: 'DOT/USDT', price: 7.45, chg: -0.78 },
  { sym: 'LINK/USDT', price: 14.67, chg: 4.32 },
];

var STRATS = [
  { name: 'BTC 网格策略', type: '网格交易', pair: 'BTC/USDT', status: 'running', pnl: '+$2,340', trades: 142, progress: 72, bar: 'green' },
  { name: 'ETH 均线突破', type: '均线突破', pair: 'ETH/USDT', status: 'running', pnl: '+$890', trades: 56, progress: 45, bar: 'green' },
  { name: 'SOL RSI反弹', type: 'RSI超卖', pair: 'SOL/USDT', status: 'paused', pnl: '-$120', trades: 23, progress: 30, bar: 'amber' },
  { name: 'BNB MACD金叉', type: 'MACD', pair: 'BNB/USDT', status: 'running', pnl: '+$456', trades: 38, progress: 60, bar: 'green' },
  { name: 'DOGE 布林带', type: '布林带', pair: 'DOGE/USDT', status: 'stopped', pnl: '-$67', trades: 12, progress: 15, bar: 'red' },
];

var SIGNALS = [
  { type: 'buy', icon: '▲', text: '张明 买入 BTC/USDT 0.5 BTC @ 68,420' },
  { type: 'sell', icon: '▼', text: '李薇 卖出 ETH/USDT 2.0 ETH @ 3,860' },
  { type: 'alert', icon: '⚠', text: 'SOL/USDT 触及布林带上轨 $145.20' },
  { type: 'buy', icon: '▲', text: '网格策略自动买入 BTC 0.02 @ 68,100' },
  { type: 'info', icon: 'ℹ', text: 'ETH 均线突破策略 MA7 上穿 MA25' },
  { type: 'sell', icon: '▼', text: '赵强 平仓 SOL/USDT +$342' },
  { type: 'alert', icon: '⚠', text: 'BNB/USDT RSI(14) 达到 72.5 超买区' },
  { type: 'buy', icon: '▲', text: '王浩 加仓 BTC/USDT 做多 0.1 BTC' },
  { type: 'info', icon: 'ℹ', text: 'MACD金叉策略检测到 BNB 金叉信号' },
  { type: 'sell', icon: '▼', text: '陈露 止盈 XRP/USDT 做空 +$128' },
  { type: 'alert', icon: '⚠', text: 'BTC/USDT 1H 成交量异常放大 3.2倍' },
  { type: 'buy', icon: '▲', text: '孙婷 开仓 ADA/USDT 做多 5000 ADA' },
];

// ===== 工具函数 =====
function formatPrice(p) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}
function randBetween(a, b) { return a + Math.random() * (b - a); }
function timeAgo(i) {
  var u = ['刚刚','1分钟前','2分钟前','3分钟前','5分钟前','8分钟前','12分钟前','15分钟前','20分钟前','30分钟前','45分钟前','1小时前'];
  return u[i % u.length];
}

// ===== 时钟 =====
function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = h + ':' + m + ':' + s;
}

// ===== 行情滚动条 =====
function initTicker() {
  var track = document.getElementById('tickerTrack');
  var html = '';
  for (var r = 0; r < 2; r++) {
    for (var i = 0; i < SYMBOLS.length; i++) {
      var s = SYMBOLS[i];
      var cls = s.chg >= 0 ? 'up' : 'down';
      var sign = s.chg >= 0 ? '+' : '';
      html += '<span class="ticker-item">' +
        '<span class="ticker-sym">' + s.sym + '</span>' +
        '<span class="ticker-price">' + formatPrice(s.price) + '</span>' +
        '<span class="ticker-chg ' + cls + '">' + sign + s.chg.toFixed(2) + '%</span></span>';
    }
  }
  track.innerHTML = html;
}

// ===== K线数据 =====
var klineData = [];
function generateKlineData(count) {
  klineData = [];
  var price = 68000;
  for (var i = 0; i < count; i++) {
    var open = price;
    var close = open + randBetween(-400, 400);
    var high = Math.max(open, close) + randBetween(50, 300);
    var low = Math.min(open, close) - randBetween(50, 300);
    var vol = randBetween(800, 3000);
    klineData.push({ o: open, c: close, h: high, l: low, v: vol });
    price = close;
  }
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
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
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

// ===== 团队持仓 =====
function renderPositions() {
  var el = document.getElementById('positionsList');
  if (!el) return;
  var pairs = ['BTC/USDT','ETH/USDT','SOL/USDT','BNB/USDT','XRP/USDT','ADA/USDT'];
  var html = '';
  for (var i = 0; i < TEAM.length; i++) {
    var t = TEAM[i];
    var pair = pairs[i % pairs.length];
    var pnl = randBetween(-500, 2000);
    var isUp = pnl >= 0;
    var size = randBetween(0.01, 5).toFixed(3);
    html += '<div class="member-row">' +
      '<div class="member-left">' +
        '<div class="member-avatar" style="background:' + t.color + '">' + t.init + '</div>' +
        '<div><div class="member-name">' + t.name + '</div>' +
        '<div class="member-pair">' + pair + '</div></div>' +
      '</div>' +
      '<div class="member-right">' +
        '<div class="member-pnl ' + (isUp ? 'up' : 'down') + '">' + (isUp ? '+' : '') + '$' + Math.abs(pnl).toFixed(0) + '</div>' +
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
  el.innerHTML = html;
}

// ===== 买卖盘口 =====
function renderOrderbook() {
  var asks = document.getElementById('obAsks');
  var bids = document.getElementById('obBids');
  if (!asks || !bids) return;
  var base = SYMBOLS[0].price;
  var ahtml = '', bhtml = '';
  for (var i = 7; i >= 0; i--) {
    var ap = base + randBetween(5, 50) * (i + 1);
    var aa = randBetween(0.1, 3).toFixed(4);
    var aw = Math.round(randBetween(20, 100));
    ahtml += '<div class="ob-row"><div class="ob-bg" style="width:' + aw + '%"></div>' +
      '<span class="ob-price">' + formatPrice(ap) + '</span><span class="ob-amount">' + aa + '</span></div>';
  }
  for (var j = 0; j < 8; j++) {
    var bp = base - randBetween(5, 50) * (j + 1);
    var ba = randBetween(0.1, 3).toFixed(4);
    var bw = Math.round(randBetween(20, 100));
    bhtml += '<div class="ob-row"><div class="ob-bg" style="width:' + bw + '%"></div>' +
      '<span class="ob-price">' + formatPrice(bp) + '</span><span class="ob-amount">' + ba + '</span></div>';
  }
  asks.innerHTML = ahtml;
  bids.innerHTML = bhtml;
}

// ===== 价格更新 =====
function updatePrice() {
  var s = SYMBOLS[0];
  var delta = randBetween(-80, 80);
  s.price += delta;
  s.chg += randBetween(-0.3, 0.3);
  var pm = document.getElementById('priceMain');
  var pc = document.getElementById('priceChange');
  var ob = document.getElementById('obMidPrice');
  var tp = document.getElementById('tradePrice');
  if (pm) pm.textContent = formatPrice(s.price);
  if (pc) {
    var sign = s.chg >= 0 ? '+' : '';
    pc.textContent = sign + s.chg.toFixed(2) + '%';
    pc.className = 'price-badge ' + (s.chg >= 0 ? 'up' : 'down');
  }
  if (ob) ob.textContent = formatPrice(s.price);
  if (tp) tp.value = formatPrice(s.price);
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
      generateKlineData(60);
      drawKline();
      drawVolume();
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
      var balance = 10000;
      if (amountInput) amountInput.value = (balance * pct).toFixed(2);
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
      var idx = symSelect.selectedIndex;
      var s = SYMBOLS[idx];
      var pm = document.getElementById('priceMain');
      var pc = document.getElementById('priceChange');
      if (pm) pm.textContent = formatPrice(s.price);
      if (pc) {
        pc.textContent = (s.chg >= 0 ? '+' : '') + s.chg.toFixed(2) + '%';
        pc.className = 'price-badge ' + (s.chg >= 0 ? 'up' : 'down');
      }
      generateKlineData(60);
      drawKline();
      drawVolume();
    });
  }

  // 窗口缩放重绘
  window.addEventListener('resize', function() { drawKline(); });
}

// ===== 初始化 =====
function init() {
  initTicker();
  generateKlineData(60);
  drawKline();
  drawVolume();
  renderPositions();
  renderStrategies();
  renderSignals();
  renderOrderbook();
  initInteractions();

  setInterval(updateClock, 1000);
  updateClock();
  setInterval(function() {
    updatePrice();
    renderOrderbook();
  }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
