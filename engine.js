// ============================================================
// TeamTrade Engine v2 — 交易所级核心引擎
// ============================================================

var TT = (function() {
  'use strict';

  // --- 常量 ---
  var DB = {
    ACCOUNTS: 'tt_accounts',
    POSITIONS: 'tt_positions',
    TRADES: 'tt_trades',
    AUDIT: 'tt_audit',
    CONFIG: 'tt_config',
    SHADOW: 'tt_shadow',
    ANALYTICS: 'tt_analytics'
  };

  var FEE_RATE = { maker: 0.0002, taker: 0.0004, liquidation: 0.005 };
  var MAINT_MARGIN_RATE = 0.02; // 维持保证金率 2%
  var MIN_ORDER_VALUE = 10; // 最小下单名义价值 $10
  var MAX_POSITIONS = 10; // 最大同时持仓数
  var COOLDOWN_MS = 5000; // 下单冷却 5秒

  // --- 存储层 ---
  function load(key) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch(e) { return null; }
  }
  function save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  }

  // --- 账户系统 ---
  function initAccounts(team) {
    var accounts = load(DB.ACCOUNTS);
    if (accounts && Object.keys(accounts).length === team.length) return accounts;
    accounts = accounts || {};
    team.forEach(function(m) {
      if (!accounts[m.name]) {
        accounts[m.name] = {
          walletBalance: m.capital || 1000,
          usedMargin: 0,
          realizedPnl: 0,
          totalFees: 0,
          totalDeposit: m.capital || 1000,
          tradeCount: 0,
          winCount: 0,
          lossCount: 0,
          maxDrawdown: 0,
          peakBalance: m.capital || 1000,
          lastTradeTime: 0,
          createdAt: new Date().toISOString()
        };
      }
    });
    save(DB.ACCOUNTS, accounts);
    return accounts;
  }

  function getAccount(name) {
    var accounts = load(DB.ACCOUNTS) || {};
    return accounts[name] || null;
  }

  function updateAccount(name, updates) {
    var accounts = load(DB.ACCOUNTS) || {};
    if (!accounts[name]) return null;
    Object.keys(updates).forEach(function(k) { accounts[name][k] = updates[k]; });
    save(DB.ACCOUNTS, accounts);
    return accounts[name];
  }

  function getAvailableBalance(name) {
    var acc = getAccount(name);
    if (!acc) return 0;
    var unrealized = calcUnrealizedPnl(name);
    return Math.max(0, acc.walletBalance + unrealized - acc.usedMargin);
  }

  function getMarginBalance(name) {
    var acc = getAccount(name);
    if (!acc) return 0;
    return acc.walletBalance + calcUnrealizedPnl(name);
  }

  // --- 持仓系统 ---
  function getPositions(filter) {
    var positions = load(DB.POSITIONS) || [];
    if (!filter) return positions;
    return positions.filter(function(p) {
      if (filter.member && p.member !== filter.member) return false;
      if (filter.symbol && p.symbol !== filter.symbol) return false;
      if (filter.side && p.side !== filter.side) return false;
      return true;
    });
  }

  function calcUnrealizedPnl(name) {
    var positions = getPositions({ member: name });
    var total = 0;
    positions.forEach(function(p) {
      var mark = getMarkPrice(p.symbol);
      if (!mark) return;
      if (p.side === 'long') total += (mark - p.entryPrice) * p.quantity;
      else total += (p.entryPrice - mark) * p.quantity;
    });
    return total;
  }

  // 标记价格缓存
  var _markPrices = {};
  function setMarkPrice(symbol, price) { _markPrices[symbol] = parseFloat(price); }
  function getMarkPrice(symbol) { return _markPrices[symbol] || 0; }

  // --- 开仓核心 ---
  function openPosition(params) {
    // params: { member, symbol, side, price, quantity, leverage, strategy, source, note }
    var errors = [];
    var price = parseFloat(params.price);
    var qty = parseFloat(params.quantity);
    var lev = parseInt(params.leverage) || 1;

    // 1. 参数校验
    if (isNaN(price) || price <= 0) errors.push('价格必须大于0');
    if (isNaN(qty) || qty <= 0) errors.push('数量必须大于0');
    if (lev < 1 || lev > 20) errors.push('杠杆必须在1-20之间');
    if (!params.member) errors.push('必须指定成员');

    var notionalValue = price * qty;
    if (notionalValue < MIN_ORDER_VALUE) errors.push('最小下单价值$' + MIN_ORDER_VALUE);

    // 2. 账户检查
    var acc = getAccount(params.member);
    if (!acc) { errors.push('账户不存在'); return { ok: false, errors: errors }; }

    // 3. 冷却检查
    if (Date.now() - acc.lastTradeTime < COOLDOWN_MS) errors.push('操作过快，请等待' + Math.ceil((COOLDOWN_MS - (Date.now() - acc.lastTradeTime)) / 1000) + '秒');

    // 4. 保证金计算
    var requiredMargin = notionalValue / lev;
    var fee = notionalValue * FEE_RATE.taker;
    var available = getAvailableBalance(params.member);
    if (requiredMargin + fee > available) errors.push('可用余额不足 (需要$' + (requiredMargin + fee).toFixed(2) + ', 可用$' + available.toFixed(2) + ')');

    // 5. 持仓数检查
    var currentPositions = getPositions({ member: params.member });
    if (currentPositions.length >= MAX_POSITIONS) errors.push('持仓数已达上限(' + MAX_POSITIONS + ')');

    if (errors.length > 0) return { ok: false, errors: errors };

    // 6. 计算强平价格
    var liqPrice;
    if (params.side === 'long') {
      liqPrice = price * (1 - 1/lev + MAINT_MARGIN_RATE);
    } else {
      liqPrice = price * (1 + 1/lev - MAINT_MARGIN_RATE);
    }

    // 7. 创建仓位
    var position = {
      id: 'pos_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      member: params.member,
      symbol: params.symbol,
      side: params.side,
      entryPrice: price,
      quantity: qty,
      leverage: lev,
      isolatedMargin: requiredMargin,
      maintenanceMargin: notionalValue * MAINT_MARGIN_RATE,
      liquidationPrice: liqPrice,
      fee: fee,
      strategy: params.strategy || '手动交易',
      source: params.source || 'manual',
      note: params.note || '',
      openedAt: new Date().toISOString(),
      // 快照 (用于交易时间线/黑匣子)
      snapshot: {
        markPrice: getMarkPrice(params.symbol),
        indicators: params.indicators || {}
      }
    };

    // 8. 原子操作: 扣保证金 + 扣手续费 + 创建仓位 + 记录成交
    var positions = load(DB.POSITIONS) || [];
    positions.push(position);
    save(DB.POSITIONS, positions);

    updateAccount(params.member, {
      usedMargin: acc.usedMargin + requiredMargin,
      walletBalance: acc.walletBalance - fee,
      totalFees: acc.totalFees + fee,
      tradeCount: acc.tradeCount + 1,
      lastTradeTime: Date.now()
    });

    // 9. 记录成交
    addTrade({
      positionId: position.id,
      member: params.member,
      symbol: params.symbol,
      side: params.side,
      type: 'open',
      price: price,
      quantity: qty,
      leverage: lev,
      margin: requiredMargin,
      fee: fee,
      strategy: position.strategy,
      source: position.source,
      note: position.note
    });

    // 10. 审计日志
    addAudit(params.member, 'open_position', '开仓 ' + params.side + ' ' + params.symbol + ' ' + qty + ' @ $' + price.toFixed(2) + ' ' + lev + 'x', acc.walletBalance, acc.walletBalance - fee);

    return { ok: true, position: position, fee: fee, margin: requiredMargin };
  }

  // --- 平仓核心 ---
  function closePosition(positionId, closePrice, closeNote) {
    var positions = load(DB.POSITIONS) || [];
    var idx = -1;
    for (var i = 0; i < positions.length; i++) {
      if (positions[i].id === positionId) { idx = i; break; }
    }
    if (idx === -1) return { ok: false, errors: ['仓位不存在'] };

    var pos = positions[idx];
    var price = parseFloat(closePrice);
    var notional = price * pos.quantity;
    var fee = notional * FEE_RATE.taker;

    // 计算盈亏
    var pnl;
    if (pos.side === 'long') pnl = (price - pos.entryPrice) * pos.quantity;
    else pnl = (pos.entryPrice - price) * pos.quantity;

    var roe = pos.isolatedMargin > 0 ? (pnl / pos.isolatedMargin * 100) : 0;

    // 更新账户: 回收保证金 + 结算盈亏 + 扣手续费
    var acc = getAccount(pos.member);
    var newBalance = acc.walletBalance + pnl - fee;
    var newUsedMargin = Math.max(0, acc.usedMargin - pos.isolatedMargin);
    var isWin = pnl > 0;

    // 回撤计算
    var peak = Math.max(acc.peakBalance, newBalance);
    var dd = peak > 0 ? ((peak - newBalance) / peak * 100) : 0;
    var maxDd = Math.max(acc.maxDrawdown, dd);

    updateAccount(pos.member, {
      walletBalance: newBalance,
      usedMargin: newUsedMargin,
      realizedPnl: acc.realizedPnl + pnl,
      totalFees: acc.totalFees + fee,
      winCount: acc.winCount + (isWin ? 1 : 0),
      lossCount: acc.lossCount + (isWin ? 0 : 1),
      peakBalance: peak,
      maxDrawdown: maxDd,
      lastTradeTime: Date.now()
    });

    // 删除仓位
    positions.splice(idx, 1);
    save(DB.POSITIONS, positions);

    // 记录成交
    addTrade({
      positionId: pos.id,
      member: pos.member,
      symbol: pos.symbol,
      side: pos.side,
      type: 'close',
      price: price,
      quantity: pos.quantity,
      leverage: pos.leverage,
      margin: pos.isolatedMargin,
      fee: fee,
      pnl: pnl,
      roe: roe,
      strategy: pos.strategy,
      source: pos.source,
      note: closeNote || ''
    });

    addAudit(pos.member, 'close_position', '平仓 ' + pos.symbol + ' PnL: ' + (pnl >= 0 ? '+' : '') + '$' + pnl.toFixed(2) + ' ROE: ' + roe.toFixed(1) + '%', acc.walletBalance, newBalance);

    return { ok: true, pnl: pnl, roe: roe, fee: fee };
  }

  // --- 强平引擎 ---
  function checkLiquidations() {
    var positions = load(DB.POSITIONS) || [];
    var liquidated = [];
    positions.forEach(function(pos) {
      var mark = getMarkPrice(pos.symbol);
      if (!mark) return;
      var unrealized;
      if (pos.side === 'long') unrealized = (mark - pos.entryPrice) * pos.quantity;
      else unrealized = (pos.entryPrice - mark) * pos.quantity;

      // 强平条件: 未实现亏损 >= 保证金的90%
      if (unrealized <= -(pos.isolatedMargin * 0.9)) {
        liquidated.push({ positionId: pos.id, markPrice: mark, unrealized: unrealized });
      }
    });

    liquidated.forEach(function(liq) {
      var result = liquidatePosition(liq.positionId, liq.markPrice);
      if (result.ok) liq.result = result;
    });

    return liquidated;
  }

  function liquidatePosition(positionId, markPrice) {
    var positions = load(DB.POSITIONS) || [];
    var idx = -1;
    for (var i = 0; i < positions.length; i++) {
      if (positions[i].id === positionId) { idx = i; break; }
    }
    if (idx === -1) return { ok: false };

    var pos = positions[idx];
    var fee = markPrice * pos.quantity * FEE_RATE.liquidation;
    var pnl = -pos.isolatedMargin; // 强平亏损 = 全部保证金

    var acc = getAccount(pos.member);
    var newBalance = acc.walletBalance + pnl - fee;

    updateAccount(pos.member, {
      walletBalance: Math.max(0, newBalance),
      usedMargin: Math.max(0, acc.usedMargin - pos.isolatedMargin),
      realizedPnl: acc.realizedPnl + pnl,
      totalFees: acc.totalFees + fee,
      lossCount: acc.lossCount + 1,
      peakBalance: acc.peakBalance,
      maxDrawdown: Math.max(acc.maxDrawdown, acc.peakBalance > 0 ? ((acc.peakBalance - Math.max(0, newBalance)) / acc.peakBalance * 100) : 0),
      lastTradeTime: Date.now()
    });

    positions.splice(idx, 1);
    save(DB.POSITIONS, positions);

    addTrade({
      positionId: pos.id, member: pos.member, symbol: pos.symbol,
      side: pos.side, type: 'liquidation', price: markPrice,
      quantity: pos.quantity, leverage: pos.leverage,
      margin: pos.isolatedMargin, fee: fee, pnl: pnl, roe: -100,
      strategy: pos.strategy, source: 'system', note: '强制平仓'
    });

    addAudit(pos.member, 'liquidation', '⚠️ 强平 ' + pos.symbol + ' 亏损$' + Math.abs(pnl).toFixed(2), acc.walletBalance, Math.max(0, newBalance));

    return { ok: true, pnl: pnl, fee: fee };
  }

  // --- 成交记录 ---
  function addTrade(trade) {
    var trades = load(DB.TRADES) || [];
    trade.id = 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    trade.timestamp = new Date().toISOString();
    trades.unshift(trade);
    if (trades.length > 500) trades.length = 500;
    save(DB.TRADES, trades);
    return trade;
  }

  function getTrades(filter) {
    var trades = load(DB.TRADES) || [];
    if (!filter) return trades;
    return trades.filter(function(t) {
      if (filter.member && t.member !== filter.member) return false;
      if (filter.symbol && t.symbol !== filter.symbol) return false;
      if (filter.type && t.type !== filter.type) return false;
      return true;
    });
  }

  // --- 审计日志 ---
  function addAudit(member, action, detail, balBefore, balAfter) {
    var audit = load(DB.AUDIT) || [];
    audit.unshift({
      timestamp: new Date().toISOString(),
      member: member, action: action, detail: detail,
      balanceBefore: balBefore, balanceAfter: balAfter
    });
    if (audit.length > 1000) audit.length = 1000;
    save(DB.AUDIT, audit);
  }

  // --- 公开API ---
  return {
    DB: DB, FEE_RATE: FEE_RATE, MAINT_MARGIN_RATE: MAINT_MARGIN_RATE,
    initAccounts: initAccounts, getAccount: getAccount, updateAccount: updateAccount,
    getAvailableBalance: getAvailableBalance, getMarginBalance: getMarginBalance,
    getPositions: getPositions, calcUnrealizedPnl: calcUnrealizedPnl,
    setMarkPrice: setMarkPrice, getMarkPrice: getMarkPrice,
    openPosition: openPosition, closePosition: closePosition,
    checkLiquidations: checkLiquidations,
    getTrades: getTrades, load: load, save: save
  };
})();
