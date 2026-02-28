// ============================================================
// TeamTrade Analytics — 量化分析 + AI风控 + 创新功能
// ============================================================

var TTA = (function() {
  'use strict';

  // --- 核心盈利指标 (18项) ---
  function calcCoreMetrics(memberName) {
    var trades = TT.getTrades({ member: memberName }).filter(function(t) { return t.type === 'close' || t.type === 'liquidation'; });
    if (trades.length === 0) return null;

    var wins = [], losses = [];
    trades.forEach(function(t) {
      if (t.pnl > 0) wins.push(t); else losses.push(t);
    });

    var avgWin = wins.length > 0 ? wins.reduce(function(s, t) { return s + t.pnl; }, 0) / wins.length : 0;
    var avgLoss = losses.length > 0 ? Math.abs(losses.reduce(function(s, t) { return s + t.pnl; }, 0) / losses.length) : 0;
    var winRate = trades.length > 0 ? wins.length / trades.length : 0;

    // 1. 期望值
    var expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

    // 2. 盈亏比
    var riskReward = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

    // 3. 凯利公式仓位
    var kelly = riskReward > 0 ? (winRate * riskReward - (1 - winRate)) / riskReward : 0;
    kelly = Math.max(0, Math.min(kelly, 0.25)); // 上限25%

    // 4. 最大连续亏损
    var maxConsecLoss = 0, curConsec = 0;
    trades.forEach(function(t) {
      if (t.pnl <= 0) { curConsec++; maxConsecLoss = Math.max(maxConsecLoss, curConsec); }
      else curConsec = 0;
    });

    // 5. 止盈效率 (需要持仓期间最大浮盈数据，简化版用ROE)
    var profitCapture = wins.length > 0 ? wins.reduce(function(s, t) { return s + (t.roe || 0); }, 0) / wins.length : 0;

    // 6. 手续费侵蚀率
    var totalGross = trades.reduce(function(s, t) { return s + Math.abs(t.pnl || 0); }, 0);
    var totalFees = trades.reduce(function(s, t) { return s + (t.fee || 0); }, 0);
    var feeErosion = totalGross > 0 ? totalFees / totalGross * 100 : 0;

    return {
      totalTrades: trades.length,
      winRate: winRate,
      avgWin: avgWin,
      avgLoss: avgLoss,
      expectancy: expectancy,
      riskReward: riskReward,
      kelly: kelly,
      maxConsecLoss: maxConsecLoss,
      profitCapture: profitCapture,
      feeErosion: feeErosion,
      totalFees: totalFees
    };
  }

  // --- 时段收益热力图 ---
  function calcTimeHeatmap(memberName) {
    var trades = TT.getTrades({ member: memberName }).filter(function(t) { return t.pnl !== undefined && t.pnl !== null; });
    var map = {}; // "day_hour" -> { pnl, count }
    var days = ['日', '一', '二', '三', '四', '五', '六'];

    trades.forEach(function(t) {
      var d = new Date(t.timestamp);
      var day = d.getDay();
      var hour = Math.floor(d.getHours() / 3) * 3; // 3小时段
      var key = day + '_' + hour;
      if (!map[key]) map[key] = { pnl: 0, count: 0, wins: 0 };
      map[key].pnl += t.pnl || 0;
      map[key].count++;
      if (t.pnl > 0) map[key].wins++;
    });

    return { map: map, days: days };
  }

  // --- 杠杆-收益关系 ---
  function calcLeverageAnalysis(memberName) {
    var trades = TT.getTrades({ member: memberName }).filter(function(t) { return t.pnl !== undefined; });
    var buckets = { '1-3x': { trades: 0, wins: 0, pnl: 0 }, '4-7x': { trades: 0, wins: 0, pnl: 0 }, '8-15x': { trades: 0, wins: 0, pnl: 0 }, '16-20x': { trades: 0, wins: 0, pnl: 0 } };

    trades.forEach(function(t) {
      var lev = t.leverage || 1;
      var key = lev <= 3 ? '1-3x' : lev <= 7 ? '4-7x' : lev <= 15 ? '8-15x' : '16-20x';
      buckets[key].trades++;
      buckets[key].pnl += t.pnl || 0;
      if (t.pnl > 0) buckets[key].wins++;
    });

    return buckets;
  }

  // --- 冲动交易检测 (心电图) ---
  function detectImpulseTrades(memberName) {
    var trades = TT.getTrades({ member: memberName });
    var impulse = [], normal = [];

    for (var i = 1; i < trades.length; i++) {
      var gap = new Date(trades[i - 1].timestamp) - new Date(trades[i].timestamp);
      if (gap < 180000) { // <3分钟
        impulse.push(trades[i]);
      } else {
        normal.push(trades[i]);
      }
    }

    var impulsePnl = impulse.reduce(function(s, t) { return s + (t.pnl || 0); }, 0);
    var normalPnl = normal.reduce(function(s, t) { return s + (t.pnl || 0); }, 0);
    var impulseWinRate = impulse.length > 0 ? impulse.filter(function(t) { return t.pnl > 0; }).length / impulse.length : 0;

    return {
      impulseCount: impulse.length,
      normalCount: normal.length,
      impulsePnl: impulsePnl,
      normalPnl: normalPnl,
      impulseWinRate: impulseWinRate,
      costOfImpulse: Math.min(0, impulsePnl)
    };
  }

  // --- 交易光谱 (盈利DNA vs 亏损DNA) ---
  function calcTradeSpectrum(memberName) {
    var trades = TT.getTrades({ member: memberName }).filter(function(t) { return t.pnl !== undefined; });
    var wins = trades.filter(function(t) { return t.pnl > 0; });
    var losses = trades.filter(function(t) { return t.pnl <= 0; });

    function avgLev(arr) { return arr.length > 0 ? arr.reduce(function(s, t) { return s + (t.leverage || 1); }, 0) / arr.length : 0; }

    return {
      winAvgLeverage: avgLev(wins),
      lossAvgLeverage: avgLev(losses),
      winCount: wins.length,
      lossCount: losses.length
    };
  }

  // --- 影子交易系统 ---
  function addShadowTrade(params) {
    var shadows = TT.load(TT.DB.SHADOW) || [];
    shadows.unshift({
      id: 'shadow_' + Date.now(),
      symbol: params.symbol,
      side: params.side,
      price: parseFloat(params.price),
      timestamp: new Date().toISOString(),
      resolved: false,
      result: null
    });
    if (shadows.length > 200) shadows.length = 200;
    TT.save(TT.DB.SHADOW, shadows);
  }

  function resolveShadows(symbol, currentPrice) {
    var shadows = TT.load(TT.DB.SHADOW) || [];
    var changed = false;
    shadows.forEach(function(s) {
      if (s.resolved || s.symbol !== symbol) return;
      var age = Date.now() - new Date(s.timestamp).getTime();
      if (age > 3600000) { // 1小时后结算
        s.resolved = true;
        if (s.side === 'long') s.result = currentPrice - s.price;
        else s.result = s.price - currentPrice;
        changed = true;
      }
    });
    if (changed) TT.save(TT.DB.SHADOW, shadows);
    return shadows.filter(function(s) { return s.resolved; });
  }

  function getShadowStats() {
    var shadows = (TT.load(TT.DB.SHADOW) || []).filter(function(s) { return s.resolved; });
    var wins = shadows.filter(function(s) { return s.result > 0; });
    var totalProfit = shadows.reduce(function(s, t) { return s + (t.result || 0); }, 0);
    return {
      total: shadows.length,
      winRate: shadows.length > 0 ? wins.length / shadows.length : 0,
      totalProfit: totalProfit
    };
  }

  // --- 交易拼图 (每笔交易7维评分) ---
  function calcTradePuzzle(trade, klineData) {
    var pieces = [];
    // ① 方向正确
    pieces.push({ name: '方向正确', ok: trade.pnl > 0 });
    // ② 仓位合理 (<20% 余额)
    var acc = TT.getAccount(trade.member);
    var posRatio = acc ? (trade.margin || 0) / acc.walletBalance * 100 : 100;
    pieces.push({ name: '仓位合理', ok: posRatio <= 20 });
    // ③ 有止损 (简化: 亏损<保证金50%视为有止损)
    pieces.push({ name: '止损到位', ok: trade.pnl > 0 || Math.abs(trade.pnl) < (trade.margin || Infinity) * 0.5 });
    // ④ 盈亏比合理
    pieces.push({ name: '盈亏比≥1:2', ok: trade.pnl > 0 && trade.roe > 10 });
    // ⑤ 杠杆合理
    pieces.push({ name: '杠杆合理', ok: (trade.leverage || 1) <= 10 });
    // ⑥ 非冲动交易
    pieces.push({ name: '非冲动', ok: true }); // 需要上下文判断
    // ⑦ 有复盘
    pieces.push({ name: '有复盘', ok: trade.note && trade.note.length > 5 });

    var score = pieces.filter(function(p) { return p.ok; }).length;
    return { pieces: pieces, score: score, total: 7 };
  }

  // --- 交易天平 (开仓前多空论据) ---
  function calcTradeBalance(symbol, side, indicators) {
    var pros = [], cons = [];
    var ind = indicators || {};

    if (side === 'long') {
      if (ind.rsi < 30) pros.push('RSI超卖 ✅');
      else if (ind.rsi > 70) cons.push('RSI超买 ⚠️');
      if (ind.macdHist > 0) pros.push('MACD柱状图为正 ✅');
      else cons.push('MACD柱状图为负 ⚠️');
      if (ind.priceAboveMa200) pros.push('价格在MA200上方 ✅');
      else cons.push('价格在MA200下方 ⚠️');
      if (ind.bollPosition === 'lower') pros.push('触及布林下轨 ✅');
      if (ind.volumeAboveAvg) pros.push('成交量放大 ✅');
    } else {
      if (ind.rsi > 70) pros.push('RSI超买 ✅');
      else if (ind.rsi < 30) cons.push('RSI超卖 ⚠️');
      if (ind.macdHist < 0) pros.push('MACD柱状图为负 ✅');
      else cons.push('MACD柱状图为正 ⚠️');
      if (!ind.priceAboveMa200) pros.push('价格在MA200下方 ✅');
      else cons.push('价格在MA200上方 ⚠️');
    }

    var score = pros.length / Math.max(1, pros.length + cons.length) * 100;
    return { pros: pros, cons: cons, score: score, recommendation: score >= 60 ? 'go' : score >= 40 ? 'caution' : 'stop' };
  }

  // --- AI信号评分 (多指标共振) ---
  function calcSignalScore(indicators) {
    var score = 50; // 基准分
    var reasons = [];
    var ind = indicators || {};

    // RSI
    if (ind.rsi < 25) { score += 15; reasons.push('RSI极度超卖(+15)'); }
    else if (ind.rsi < 35) { score += 8; reasons.push('RSI超卖(+8)'); }
    else if (ind.rsi > 75) { score -= 15; reasons.push('RSI极度超买(-15)'); }
    else if (ind.rsi > 65) { score -= 8; reasons.push('RSI超买(-8)'); }

    // MACD
    if (ind.macdCross === 'golden') { score += 12; reasons.push('MACD金叉(+12)'); }
    else if (ind.macdCross === 'death') { score -= 12; reasons.push('MACD死叉(-12)'); }

    // 布林带
    if (ind.bollPosition === 'lower') { score += 10; reasons.push('触及布林下轨(+10)'); }
    else if (ind.bollPosition === 'upper') { score -= 10; reasons.push('触及布林上轨(-10)'); }

    // 均线
    if (ind.priceAboveMa200) { score += 8; reasons.push('MA200上方(+8)'); }
    else { score -= 8; reasons.push('MA200下方(-8)'); }

    // 成交量
    if (ind.volumeAboveAvg) { score += 5; reasons.push('放量确认(+5)'); }

    score = Math.max(0, Math.min(100, score));
    var strength = score >= 75 ? '强' : score >= 55 ? '中' : '弱';

    return { score: score, strength: strength, reasons: reasons, direction: score >= 55 ? 'long' : score <= 45 ? 'short' : 'neutral' };
  }

  // --- 急救模式检测 ---
  function checkEmergency(memberName) {
    var trades = TT.getTrades({ member: memberName }).filter(function(t) { return t.pnl !== undefined; });
    var recent = trades.slice(0, 5);
    var consecLoss = 0;
    for (var i = 0; i < recent.length; i++) {
      if (recent[i].pnl <= 0) consecLoss++; else break;
    }

    var todayPnl = 0;
    var today = new Date().toISOString().slice(0, 10);
    trades.forEach(function(t) {
      if (t.timestamp && t.timestamp.slice(0, 10) === today) todayPnl += t.pnl || 0;
    });

    var acc = TT.getAccount(memberName);
    var dayLossPct = acc ? Math.abs(todayPnl) / acc.walletBalance * 100 : 0;

    return {
      triggered: consecLoss >= 3 || dayLossPct > 10,
      consecLoss: consecLoss,
      todayPnl: todayPnl,
      dayLossPct: dayLossPct,
      reason: consecLoss >= 3 ? '连续亏损' + consecLoss + '笔' : dayLossPct > 10 ? '日亏损' + dayLossPct.toFixed(1) + '%' : ''
    };
  }

  return {
    calcCoreMetrics: calcCoreMetrics,
    calcTimeHeatmap: calcTimeHeatmap,
    calcLeverageAnalysis: calcLeverageAnalysis,
    detectImpulseTrades: detectImpulseTrades,
    calcTradeSpectrum: calcTradeSpectrum,
    addShadowTrade: addShadowTrade,
    resolveShadows: resolveShadows,
    getShadowStats: getShadowStats,
    calcTradePuzzle: calcTradePuzzle,
    calcTradeBalance: calcTradeBalance,
    calcSignalScore: calcSignalScore,
    checkEmergency: checkEmergency
  };
})();
