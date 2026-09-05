(() => {
  'use strict';

  const STORAGE_KEY = 'familyFinanceSimulator.v1';
  const DEFAULT_STATE = {
    profile: {
      monthlyIncome: 60,
      monthlyExpenses: 40,
      emergencyMonths: 6,
      cash: 800,
      investments: 1200,
      otherAssets: 0,
      otherDebt: 0,
      policyMemo: '現金は生活防衛資金と近い将来の支出を優先して確保する。'
    },
    members: [
      { id: 'father', role: '父', age: null, attribute: '', annualGrossIncome: 0, annualNetIncome: 0, retirementAge: null },
      { id: 'mother', role: '母', age: null, attribute: '', annualGrossIncome: 0, annualNetIncome: 0, retirementAge: null },
      { id: 'son', role: '息子', age: null, attribute: '', annualGrossIncome: 0, annualNetIncome: 0, retirementAge: null }
    ],
    events: [
      { id: uid(), category: 'education', name: '教育費', yearsFromNow: 3, amount: 300, frequency: 'once', durationYears: 1, flow: 'expense' },
      { id: uid(), category: 'vehicle', name: '車の買い替え', yearsFromNow: 5, amount: 250, frequency: 'once', durationYears: 1, flow: 'expense' }
    ],
    mortgage: {
      balance: 3200,
      rate: 0.85,
      years: 22,
      compareAmount: 500,
      investReturn: 4,
      investYears: 20
    },
    allocation: {
      investReturn: 4,
      reserveYears: 5,
      extraCashReserve: 0
    },
    history: []
  };

  let state = loadState();

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function deepMerge(base, incoming) {
    if (Array.isArray(base)) return Array.isArray(incoming) ? incoming : base;
    if (typeof base !== 'object' || base === null) return incoming ?? base;
    const out = { ...base };
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(incoming).forEach(k => {
      out[k] = k in base ? deepMerge(base[k], incoming[k]) : incoming[k];
    });
    return out;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneSafe(DEFAULT_STATE);
      return deepMerge(structuredCloneSafe(DEFAULT_STATE), JSON.parse(raw));
    } catch {
      return structuredCloneSafe(DEFAULT_STATE);
    }
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  const $ = id => document.getElementById(id);
  const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const yen10k = v => `${formatNum(v, 0)}万円`;
  const formatNum = (v, digits = 1) => Number(v || 0).toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  const pct = v => `${formatNum(v, 2)}%`;

  function bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $(`page-${btn.dataset.page}`).classList.add('active');
        renderAll();
      });
    });
  }

  function showPage(page) {
    document.querySelector(`.tab[data-page="${page}"]`)?.click();
  }

  const profileFields = ['monthlyExpenses','emergencyMonths','cash','investments','otherAssets','otherDebt','policyMemo'];
  const mortgageFields = {
    mortgageBalance:'balance', mortgageRate:'rate', mortgageYears:'years', compareAmount:'compareAmount', investReturn:'investReturn', investYears:'investYears'
  };
  const allocationFields = {
    allocationReturn:'investReturn', reserveYears:'reserveYears', extraCashReserve:'extraCashReserve'
  };

  const EVENT_CATEGORIES = [
    ['education','教育'],['care','親の介護'],['medical','医療'],['housing','住宅修繕・リフォーム'],
    ['vehicle','車'],['support','仕送り・家族支援'],['travel','旅行'],['retirement','退職関連'],['other','その他']
  ];
  const EVENT_FREQUENCIES = [['once','一時'],['yearly','毎年'],['monthly','毎月']];

  function householdAnnualNet() {
    return (state.members || []).reduce((sum, m) => sum + num(m.annualNetIncome), 0);
  }

  function householdMonthlyNet() {
    return householdAnnualNet() / 12;
  }

  function syncLegacyMonthlyIncome() {
    state.profile.monthlyIncome = householdMonthlyNet();
  }

  function renderMembers() {
    const root = $('membersGrid');
    if (!root) return;
    root.innerHTML = '';
    (state.members || []).forEach(member => {
      const card = document.createElement('div');
      card.className = 'member-card';
      card.innerHTML = `
        <h3>${escapeHtml(member.role)}</h3>
        <div class="member-fields">
          <label>年齢<input data-field="age" type="number" min="0" max="120" step="1" value="${member.age ?? ''}"></label>
          <label class="attribute">属性・職業<input data-field="attribute" type="text" value="${escapeHtml(member.attribute || '')}" placeholder="例：会社員、中学生"></label>
          <label>年収（税込・万円/年）<input data-field="annualGrossIncome" type="number" min="0" step="1" value="${num(member.annualGrossIncome)}"></label>
          <label>手取り（万円/年）<input data-field="annualNetIncome" type="number" min="0" step="1" value="${num(member.annualNetIncome)}"></label>
          <label>退職予定年齢（任意）<input data-field="retirementAge" type="number" min="0" max="100" step="1" value="${member.retirementAge ?? ''}" placeholder="未定"></label>
        </div>`;
      card.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
          const field = input.dataset.field;
          if (field === 'attribute') member[field] = input.value;
          else if (field === 'retirementAge') member[field] = input.value === '' ? null : num(input.value);
          else member[field] = num(input.value);
          syncLegacyMonthlyIncome();
          saveState();
          renderMemberSummary();
          renderHome(); renderMortgage(); renderAllocation();
        });
      });
      root.appendChild(card);
    });
    renderMemberSummary();
  }

  function renderMemberSummary() {
    if ($('householdAnnualNet')) $('householdAnnualNet').textContent = yen10k(householdAnnualNet());
    if ($('householdMonthlyNet')) $('householdMonthlyNet').textContent = `${yen10k(householdMonthlyNet())} / 月`;
  }

  function populateInputs() {
    profileFields.forEach(id => { if ($(id)) $(id).value = state.profile[id] ?? ''; });
    Object.entries(mortgageFields).forEach(([id,key]) => { $(id).value = state.mortgage[key]; });
    Object.entries(allocationFields).forEach(([id,key]) => { $(id).value = state.allocation[key]; });
    renderMembers();
    renderEvents();
  }

  function bindInputs() {
    profileFields.forEach(id => {
      const el = $(id);
      el.addEventListener('input', () => {
        state.profile[id] = el.tagName === 'TEXTAREA' ? el.value : num(el.value);
        saveState(); renderAll();
      });
    });
    Object.entries(mortgageFields).forEach(([id,key]) => {
      $(id).addEventListener('input', e => {
        state.mortgage[key] = num(e.target.value);
        saveState(); renderMortgage(); renderHome();
      });
    });
    Object.entries(allocationFields).forEach(([id,key]) => {
      $(id).addEventListener('input', e => {
        state.allocation[key] = num(e.target.value);
        saveState(); renderAllocation(); renderHome();
      });
    });
  }

  function normalizeEvent(ev) {
    if (!ev.category) ev.category = 'other';
    if (!ev.flow) ev.flow = 'expense';
    if (!ev.frequency) ev.frequency = 'once';
    if (!Number.isFinite(Number(ev.durationYears))) ev.durationYears = 1;
    return ev;
  }

  function eventAmountWithinYears(ev, horizonYears) {
    normalizeEvent(ev);
    if (ev.flow !== 'expense') return 0;
    const start = Math.max(0, num(ev.yearsFromNow));
    const horizon = Math.max(0, num(horizonYears));
    if (start > horizon) return 0;
    const amount = Math.max(0, num(ev.amount));
    if (ev.frequency === 'once') return amount;
    const duration = Math.max(1, Math.round(num(ev.durationYears, 1)));
    const activeYears = Math.max(0, Math.min(duration, Math.floor(horizon - start) + 1));
    if (ev.frequency === 'monthly') return amount * 12 * activeYears;
    return amount * activeYears;
  }

  function eventTotalDisplay(ev) {
    normalizeEvent(ev);
    if (ev.frequency === 'once') return '一時費用';
    const total = ev.frequency === 'monthly'
      ? num(ev.amount) * 12 * Math.max(1, num(ev.durationYears, 1))
      : num(ev.amount) * Math.max(1, num(ev.durationYears, 1));
    return `総額目安 ${yen10k(total)}`;
  }

  function renderEvents() {
    const root = $('eventsList');
    root.innerHTML = '';
    if (!state.events.length) {
      root.innerHTML = '<div class="sub">まだイベントはありません。</div>';
      return;
    }
    state.events.forEach(normalizeEvent);
    state.events.sort((a,b) => num(a.yearsFromNow) - num(b.yearsFromNow)).forEach(ev => {
      const row = document.createElement('div');
      row.className = 'event-row';
      const categoryOptions = EVENT_CATEGORIES.map(([v,l]) => `<option value="${v}" ${ev.category===v?'selected':''}>${l}</option>`).join('');
      const freqOptions = EVENT_FREQUENCIES.map(([v,l]) => `<option value="${v}" ${ev.frequency===v?'selected':''}>${l}</option>`).join('');
      row.innerHTML = `
        <label>種類<select data-field="category">${categoryOptions}</select></label>
        <label class="wide">予定・内容<input data-field="name" type="text" value="${escapeHtml(ev.name)}"></label>
        <label>何年後<input data-field="yearsFromNow" type="number" min="0" max="80" step="1" value="${num(ev.yearsFromNow)}"></label>
        <label>金額（万円）<input data-field="amount" type="number" min="0" step="1" value="${num(ev.amount)}"><span class="sub event-total">${escapeHtml(eventTotalDisplay(ev))}</span></label>
        <label>費用頻度<select data-field="frequency">${freqOptions}</select></label>
        <label>期間（年）<input data-field="durationYears" type="number" min="1" max="50" step="1" value="${Math.max(1,num(ev.durationYears,1))}" ${ev.frequency==='once'?'disabled':''}></label>
        <button type="button" class="btn danger">削除</button>`;
      row.querySelectorAll('input,select').forEach(input => {
        input.addEventListener('input', () => {
          const field = input.dataset.field;
          ev[field] = ['name','category','frequency','flow'].includes(field) ? input.value : num(input.value);
          if (field === 'frequency' && ev.frequency === 'once') ev.durationYears = 1;
          saveState();
          renderHome(); renderAllocation();
          if (field === 'frequency') renderEvents();
          else if (field === 'amount' || field === 'durationYears') { const note=row.querySelector('.event-total'); if(note) note.textContent=eventTotalDisplay(ev); }
        });
      });
      row.querySelector('button').addEventListener('click', () => {
        state.events = state.events.filter(x => x.id !== ev.id);
        saveState(); renderEvents(); renderHome(); renderAllocation();
      });
      root.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function addEvent() {
    state.events.push({ id: uid(), category: 'other', name: '新しい予定', yearsFromNow: 1, amount: 0, frequency: 'once', durationYears: 1, flow: 'expense' });
    saveState(); renderEvents(); renderHome(); renderAllocation();
  }

  function profileMetrics() {
    const p = state.profile;
    const netFinancial = num(p.cash) + num(p.investments) + num(p.otherAssets) - num(p.otherDebt);
    const cashMonths = p.monthlyExpenses > 0 ? p.cash / p.monthlyExpenses : 0;
    return { netFinancial, cashMonths };
  }

  function renderHome() {
    const p = state.profile;
    const m = state.mortgage;
    const metrics = profileMetrics();
    $('homeNetFinancial').textContent = yen10k(metrics.netFinancial);
    $('homeCash').textContent = yen10k(p.cash);
    $('homeCashMonths').textContent = p.monthlyExpenses > 0 ? `生活費 約${formatNum(metrics.cashMonths,1)}か月分` : '生活費未入力';
    $('homeMortgage').textContent = yen10k(m.balance);
    $('homeMortgageRate').textContent = `金利 ${pct(m.rate)} / 残り ${formatNum(m.years,0)}年`;

    const totalAssets = Math.max(1, num(p.cash)+num(p.investments)+num(p.otherAssets));
    $('assetBars').innerHTML = [
      ['現預金', p.cash, 'accent'], ['投資資産', p.investments, 'alt'], ['その他', p.otherAssets, '']
    ].map(([label,value,cls]) => barHtml(label, value, totalAssets, cls)).join('');

    const emergency = p.monthlyExpenses * p.emergencyMonths;
    const fiveYear = state.events.reduce((sum,e)=>sum+eventAmountWithinYears(e,5),0);
    const reserve = emergency + fiveYear;
    $('cashNeedSummary').innerHTML = `
      <div class="summary-item"><span>生活防衛資金</span><strong>${yen10k(emergency)}</strong></div>
      <div class="summary-item"><span>5年以内の支出予定</span><strong>${yen10k(fiveYear)}</strong></div>
      <div class="summary-item"><span>合計の現金需要目安</span><strong>${yen10k(reserve)}</strong></div>
      <div class="summary-item"><span>現在現金との差</span><strong>${yen10k(p.cash-reserve)}</strong></div>`;
  }

  function barHtml(label, value, total, cls='') {
    const width = clamp((num(value)/Math.max(total,1))*100,0,100);
    return `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div><span class="bar-value">${yen10k(value)}</span></div>`;
  }

  function monthlyPayment(principal, annualRatePct, years) {
    principal = Math.max(0, principal);
    years = Math.max(0.01, years);
    const n = Math.max(1, Math.round(years*12));
    const r = Math.max(0, annualRatePct/100/12);
    if (r === 0) return principal/n;
    return principal * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1);
  }

  function amortize(principal, annualRatePct, years, fixedPayment = null) {
    principal = Math.max(0, principal);
    const r = Math.max(0, annualRatePct/100/12);
    let payment = fixedPayment ?? monthlyPayment(principal, annualRatePct, years);
    if (principal === 0) return { totalInterest:0, months:0, payment:0 };
    let bal = principal, totalInterest = 0, months = 0;
    const cap = Math.max(6000, Math.round(years*12)+12);
    while (bal > 0.000001 && months < cap) {
      const interest = bal*r;
      let principalPart = payment-interest;
      if (r === 0) principalPart = payment;
      if (principalPart <= 0) break;
      if (principalPart > bal) principalPart = bal;
      totalInterest += interest;
      bal -= principalPart;
      months++;
    }
    return { totalInterest, months, payment };
  }

  function mortgageResult() {
    const m = state.mortgage;
    const balance = Math.max(0, num(m.balance));
    const amount = clamp(num(m.compareAmount), 0, balance);
    const years = Math.max(1, num(m.years));
    const baseline = amortize(balance, m.rate, years);
    const after = amortize(balance-amount, m.rate, years, baseline.payment);
    const interestSaved = Math.max(0, baseline.totalInterest-after.totalInterest);
    const investYears = Math.max(1, num(m.investYears));
    const investFuture = amount * Math.pow(1+num(m.investReturn)/100, investYears);
    const investmentGain = investFuture - amount;
    const breakEven = amount > 0 ? (Math.pow((amount+interestSaved)/amount,1/investYears)-1)*100 : 0;
    return { balance, amount, years, baseline, after, interestSaved, investFuture, investmentGain, breakEven };
  }

  function renderMortgage() {
    const r = mortgageResult();
    $('interestSaved').textContent = yen10k(r.interestSaved);
    $('investmentFuture').textContent = yen10k(r.investFuture);
    $('investmentGain').textContent = `運用益 ${yen10k(r.investmentGain)}`;
    $('breakEvenRate').textContent = pct(r.breakEven);

    const diff = r.investmentGain - r.interestSaved;
    const cashAfterPrepay = state.profile.cash - r.amount;
    const emergency = state.profile.monthlyExpenses * state.profile.emergencyMonths;
    let headline = '';
    if (r.amount <= 0) headline = '比較金額を入力してください。';
    else if (diff > 0) headline = `入力した想定利回りでは、運用益が繰り上げ返済の概算利息削減を約${yen10k(diff)}上回ります。`;
    else headline = `入力した想定利回りでは、繰り上げ返済の概算利息削減が運用益を約${yen10k(-diff)}上回ります。`;

    const liquidityWarning = cashAfterPrepay < emergency
      ? `<br><strong>注意：</strong>繰り上げ返済後の現金は${yen10k(cashAfterPrepay)}で、設定した生活防衛資金${yen10k(emergency)}を下回ります。`
      : `<br>繰り上げ返済後の現金は${yen10k(cashAfterPrepay)}です。`;

    $('mortgageVerdict').innerHTML = `<strong>${escapeHtml(headline)}</strong>${liquidityWarning}<br>元本保証・流動性・金利変動・住宅ローン控除・税金等は別途ChatGPTで検討してください。`;
    drawMortgageChart(r);
  }

  function drawMortgageChart(r) {
    const years = Math.max(1, Math.round(state.mortgage.investYears));
    const rows = [];
    for (let y=0;y<=years;y++) {
      const invest = r.amount*Math.pow(1+state.mortgage.investReturn/100,y);
      const benchmark = r.amount + r.interestSaved*(y/years);
      rows.push({x:y,a:invest,b:benchmark});
    }
    drawLineChart($('mortgageChart'), rows, {
      a:'運用資産価値', b:'繰り上げ返済の経済効果目安', xLabel:'年後', valueFormatter:v=>`${formatNum(v,0)}万`
    });
  }

  function allocationResult() {
    const p = state.profile, a = state.allocation;
    const emergency = num(p.monthlyExpenses)*num(p.emergencyMonths);
    const nearTerm = state.events.reduce((sum,e)=>sum+eventAmountWithinYears(e,num(a.reserveYears)),0);
    const required = emergency + nearTerm + num(a.extraCashReserve);
    const surplus = Math.max(0, num(p.cash)-required);
    const shortfall = Math.max(0, required-num(p.cash));
    const proposedCash = Math.min(num(p.cash), required);
    const proposedInvestments = num(p.investments)+surplus;
    return { emergency, nearTerm, required, surplus, shortfall, proposedCash, proposedInvestments };
  }

  function renderAllocation() {
    const r = allocationResult();
    $('emergencyFund').textContent = yen10k(r.emergency);
    $('nearTermNeeds').textContent = yen10k(r.nearTerm);
    $('investableSurplus').textContent = yen10k(r.surplus);

    let text = '';
    if (r.shortfall > 0) {
      text = `<strong>設定条件では現金が約${yen10k(r.shortfall)}不足しています。</strong><br>まず生活防衛資金と${formatNum(state.allocation.reserveYears,0)}年以内の予定資金をどう確保するかを検討するケースです。`;
    } else if (r.surplus > 0) {
      text = `<strong>設定条件を満たした後も、現金に約${yen10k(r.surplus)}の余力があります。</strong><br>この金額を運用へ回すか、さらに現金で持つかをChatGPTで相談できます。`;
    } else {
      text = `<strong>現在の現金は、設定した必要額とほぼ同水準です。</strong><br>追加運用の前に将来支出の確度を確認するのがよさそうです。`;
    }
    $('allocationAdvice').innerHTML = text;

    const total = Math.max(1, state.profile.cash+state.profile.investments+state.profile.otherAssets);
    $('allocationBars').innerHTML = [
      ['現在の現金', state.profile.cash, 'accent'],
      ['現在の投資', state.profile.investments, 'alt'],
      ['確保現金目安', r.required, ''],
      ['試算上の運用余力', r.surplus, 'accent']
    ].map(([l,v,c])=>barHtml(l,v,total,c)).join('');

    const rows=[];
    for(let y=0;y<=10;y++){
      const currentInvestFuture = state.profile.investments*Math.pow(1+state.allocation.investReturn/100,y);
      const shiftedInvestFuture = (state.profile.investments+r.surplus)*Math.pow(1+state.allocation.investReturn/100,y);
      rows.push({x:y,a:state.profile.cash+currentInvestFuture,b:r.required+shiftedInvestFuture});
    }
    drawLineChart($('allocationChart'),rows,{a:'現状維持',b:'余力を運用した試算',xLabel:'年後',valueFormatter:v=>`${formatNum(v,0)}万`});
  }

  function drawLineChart(canvas, rows, cfg) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const W=canvas.width,H=canvas.height,pad={l:72,r:24,t:34,b:54};
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
    const values=rows.flatMap(r=>[r.a,r.b]).filter(Number.isFinite);
    let min=Math.min(...values,0),max=Math.max(...values,1);
    if(max===min)max=min+1;
    const x=i=>pad.l+(i/(rows.length-1||1))*(W-pad.l-pad.r);
    const y=v=>H-pad.b-((v-min)/(max-min))*(H-pad.t-pad.b);

    ctx.strokeStyle='#e2e8f0';ctx.lineWidth=1;ctx.fillStyle='#64748b';ctx.font='13px system-ui';
    for(let i=0;i<=4;i++){
      const yy=pad.t+i*(H-pad.t-pad.b)/4;
      ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke();
      const val=max-(max-min)*i/4;ctx.fillText(cfg.valueFormatter(val),8,yy+4);
    }
    const tickEvery=Math.max(1,Math.ceil((rows.length-1)/5));
    rows.forEach((r,i)=>{if(i%tickEvery===0||i===rows.length-1){ctx.fillText(`${r.x}${cfg.xLabel}`,x(i)-10,H-22);}});

    const series=[['a','#0f766e',cfg.a],['b','#6366f1',cfg.b]];
    series.forEach(([key,color])=>{
      ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();
      rows.forEach((r,i)=>{const xx=x(i),yy=y(r[key]);i===0?ctx.moveTo(xx,yy):ctx.lineTo(xx,yy);});ctx.stroke();
    });
    let lx=pad.l;
    series.forEach(([,color,label])=>{ctx.fillStyle=color;ctx.fillRect(lx,pad.t-22,14,4);ctx.fillStyle='#334155';ctx.fillText(label,lx+20,pad.t-14);lx+=ctx.measureText(label).width+62;});
  }

  function renderHistory() {
    const root=$('historyList');
    if(!state.history.length){root.innerHTML='<div class="sub">保存したケースはまだありません。</div>';return;}
    root.innerHTML='';
    [...state.history].reverse().forEach(item=>{
      const box=document.createElement('div');box.className='history-item';
      const d=new Date(item.savedAt);
      box.innerHTML=`<div class="meta">${d.toLocaleString('ja-JP')}</div><div class="title">${escapeHtml(item.title)}</div><div class="sub">${escapeHtml(item.summary)}</div><div class="history-actions"><button class="btn load">この条件を開く</button><button class="btn danger del">削除</button></div>`;
      box.querySelector('.load').addEventListener('click',()=>{
        if(item.type==='mortgage_vs_investment'){state.mortgage={...state.mortgage,...item.inputs};saveState();populateInputs();renderAll();showPage('mortgage');}
      });
      box.querySelector('.del').addEventListener('click',()=>{state.history=state.history.filter(h=>h.id!==item.id);saveState();renderHistory();});
      root.appendChild(box);
    });
  }

  function saveMortgageCase() {
    const r=mortgageResult();
    state.history.push({
      id:uid(),type:'mortgage_vs_investment',savedAt:new Date().toISOString(),title:'住宅ローン繰り上げ返済 vs 運用',inputs:{...state.mortgage},
      summary:`${yen10k(r.amount)}を比較 / 利息削減 ${yen10k(r.interestSaved)} / 運用益 ${yen10k(r.investmentGain)} / 想定年率 ${pct(state.mortgage.investReturn)}`
    });
    saveState();renderHistory();notify('ケースを履歴に保存しました。');
  }

  function buildHomePrompt() {
    const p=state.profile,m=state.mortgage;
    const members=(state.members||[]).map(x=>`・${x.role}：${x.age}歳 / ${x.attribute||'属性未入力'} / 年収 ${yen10k(x.annualGrossIncome)} / 手取り ${yen10k(x.annualNetIncome)}${x.retirementAge?` / 退職予定 ${x.retirementAge}歳`:''}`).join('\n');
    const events=state.events.map(e=>`・${e.name}（${EVENT_CATEGORIES.find(x=>x[0]===e.category)?.[1]||'その他'}）：${e.yearsFromNow}年後 / ${e.frequency==='once'?'一時':e.frequency==='monthly'?'毎月':'毎年'} ${yen10k(e.amount)}${e.frequency==='once'?'':` × ${e.durationYears}年`}`).join('\n')||'・なし';
    return `我が家の今後の資産形成について相談したいです。\n\n【家族】\n${members}\n\n【現在の家計】\n世帯月手取り：約${yen10k(householdMonthlyNet())}\n月生活費：${yen10k(p.monthlyExpenses)}\n現預金：${yen10k(p.cash)}\n投資資産：${yen10k(p.investments)}\nその他金融資産：${yen10k(p.otherAssets)}\nその他金融負債：${yen10k(p.otherDebt)}\n住宅ローン残高：${yen10k(m.balance)}\n住宅ローン金利：${pct(m.rate)}\n残期間：${m.years}年\n\n【今後の予定】\n${events}\n\n【方針・価値観】\n${p.policyMemo||'未入力'}\n\nこの家庭環境を踏まえて、現預金・安全資産・投資資産を今後どのような考え方で持つとよいか、短期・中期・長期に分けて助言してください。追加で確認すべき情報があれば指摘してください。`;
  }

  function buildMortgagePrompt() {
    const r=mortgageResult(),p=state.profile,m=state.mortgage;
    const members=(state.members||[]).map(x=>`${x.role}${x.age==null?'（年齢未入力）':x.age+'歳'}（${x.attribute||'属性未入力'}）`).join('、');
    return `住宅ローンの繰り上げ返済と運用を比較したいです。\n\n【家族】\n${members}\n世帯月手取り：約${yen10k(householdMonthlyNet())}\n\n【家計】\n現預金：${yen10k(p.cash)}\n投資資産：${yen10k(p.investments)}\n月生活費：${yen10k(p.monthlyExpenses)}\n生活防衛資金設定：${p.emergencyMonths}か月\n\n【ローン・比較条件】\nローン残高：${yen10k(m.balance)}\n金利：${pct(m.rate)}\n残期間：${m.years}年\n比較する金額：${yen10k(m.compareAmount)}\n運用想定年率：${pct(m.investReturn)}\n運用期間：${m.investYears}年\n\n【アプリの概算結果】\n繰り上げ返済による利息削減：約${yen10k(r.interestSaved)}\n投資した場合の将来価値：約${yen10k(r.investFuture)}\n投資による増加分：約${yen10k(r.investmentGain)}\n損益分岐年率の単純目安：約${pct(r.breakEven)}\n繰り上げ返済後の現金：約${yen10k(p.cash-r.amount)}\n\n期待値だけでなく、流動性、住宅ローン金利上昇、投資リスク、今後の支出、住宅ローン控除や税務上の確認事項も含めて、どちらを優先する考え方が妥当か整理してください。現在の最新金利や制度が判断に影響する場合は確認してください。`;
  }

  function buildAllocationPrompt() {
    const p=state.profile,a=state.allocation,r=allocationResult();
    const events=state.events.map(e=>`・${e.name}：${e.yearsFromNow}年後 / ${e.frequency==='once'?'一時':e.frequency==='monthly'?'毎月':'毎年'} ${yen10k(e.amount)}${e.frequency==='once'?'':` × ${e.durationYears}年`}`).join('\n')||'・なし';
    return `我が家の資産の持ち方について相談したいです。\n\n【現在】\n現預金：${yen10k(p.cash)}\n投資資産：${yen10k(p.investments)}\n世帯月手取り：約${yen10k(householdMonthlyNet())}\n月生活費：${yen10k(p.monthlyExpenses)}\n\n【将来予定】\n${events}\n\n【アプリ設定】\n生活防衛資金：${p.emergencyMonths}か月\n${a.reserveYears}年以内の予定資金を現金確保\n追加現金バッファ：${yen10k(a.extraCashReserve)}\n想定運用年率：${pct(a.investReturn)}\n\n【アプリ試算】\n生活防衛資金：約${yen10k(r.emergency)}\n近い将来の予定：約${yen10k(r.nearTerm)}\n必要現金合計：約${yen10k(r.required)}\n現金から運用へ回せる試算上の余力：約${yen10k(r.surplus)}\n\nこれは機械的な試算なので、この家庭環境では実際にどの程度を現金・安全資産・リスク資産として持つのが合理的か、複数シナリオで助言してください。`;
  }

  async function copyText(text, success='コピーしました。') {
    try {
      if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(text);} else {
        const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      }
      notify(success);
    } catch { notify('コピーできませんでした。テキストを手動で選択してください。', true); }
  }

  function notify(msg,isError=false){const t=$('globalToast');t.textContent=msg;t.style.color=isError?'#b91c1c':'#0f766e';clearTimeout(notify._t);notify._t=setTimeout(()=>{t.textContent='';},3500);}

  function exportBackup(){
    const data={app:'family-finance-simulator',version:1,exportedAt:new Date().toISOString(),state};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`family-finance-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('バックアップを書き出しました。');
  }

  async function restoreBackup(file){
    try{
      const text=await file.text();const data=JSON.parse(text);const incoming=data.state??data;
      state=deepMerge(structuredCloneSafe(DEFAULT_STATE),incoming);saveState();populateInputs();renderAll();notify('バックアップを復元しました。');
    }catch{notify('JSONバックアップを読み込めませんでした。',true);}
  }

  function importedMoneyToManYen(value, key='') {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    // GPT連携JSONでは *_income / *_balance / amount 等を円で受け取ることがある。
    // アプリ内部は万円単位なので、100,000以上は円とみなして万円へ換算する。
    // 例: 10,000,000円 -> 1,000万円。既に 1000 と渡された場合はそのまま。
    return Math.abs(n) >= 100000 ? n / 10000 : n;
  }

  function normalizeImportedMember(member) {
    if (!member || typeof member !== 'object') return null;
    const out = {};
    if (member.age !== undefined) out.age = member.age === null ? null : num(member.age);
    if (member.attribute !== undefined) out.attribute = String(member.attribute ?? '');
    if (member.occupation !== undefined && member.attribute === undefined) out.attribute = String(member.occupation ?? '');
    if (member.school_grade !== undefined && member.attribute === undefined && member.occupation === undefined) out.attribute = String(member.school_grade ?? '');
    if (member.annual_gross_income !== undefined) out.annualGrossIncome = importedMoneyToManYen(member.annual_gross_income, 'annual_gross_income');
    if (member.annualGrossIncome !== undefined) out.annualGrossIncome = importedMoneyToManYen(member.annualGrossIncome, 'annualGrossIncome');
    if (member.annual_net_income !== undefined) out.annualNetIncome = importedMoneyToManYen(member.annual_net_income, 'annual_net_income');
    if (member.annualNetIncome !== undefined) out.annualNetIncome = importedMoneyToManYen(member.annualNetIncome, 'annualNetIncome');
    if (member.retirement_age !== undefined) out.retirementAge = member.retirement_age === null ? null : num(member.retirement_age);
    if (member.retirementAge !== undefined) out.retirementAge = member.retirementAge === null ? null : num(member.retirementAge);
    return out;
  }

  function normalizeImportedEvent(ev) {
    if (!ev || typeof ev !== 'object') return null;
    const catMap = {
      parent_care:'care', care:'care', education:'education', medical:'medical', housing:'housing',
      vehicle:'vehicle', car:'vehicle', support:'support', travel:'travel', retirement:'retirement', other:'other'
    };
    const freqMap = {once:'once', one_time:'once', yearly:'yearly', annual:'yearly', monthly:'monthly'};
    const category = catMap[ev.category] || 'other';
    const frequency = freqMap[ev.frequency] || 'once';
    const amount = importedMoneyToManYen(ev.amount, 'event_amount');
    return normalizeEvent({
      id: uid(),
      category,
      name: String(ev.title ?? ev.name ?? (EVENT_CATEGORIES.find(x=>x[0]===category)?.[1] || 'その他')),
      yearsFromNow: num(ev.start_after_years ?? ev.years_from_now ?? ev.yearsFromNow, 0),
      amount: amount ?? 0,
      frequency,
      durationYears: Math.max(1, Math.round(num(ev.duration_years ?? ev.durationYears, 1))),
      flow: ev.flow === 'income' ? 'income' : 'expense'
    });
  }

  function applyAppUpdate(obj) {
    let changed = 0;
    const household = obj.household || {};
    const byId = { father:0, mother:1, son:2 };
    Object.entries(byId).forEach(([key, idx]) => {
      const upd = normalizeImportedMember(household[key]);
      if (!upd) return;
      Object.entries(upd).forEach(([field, value]) => {
        if (value !== undefined) { state.members[idx][field] = value; changed++; }
      });
    });

    const profile = obj.profile || obj.assets || {};
    const profileMap = {
      monthly_expenses:'monthlyExpenses', monthlyExpenses:'monthlyExpenses',
      emergency_months:'emergencyMonths', emergencyMonths:'emergencyMonths',
      cash:'cash', investments:'investments', other_assets:'otherAssets', otherAssets:'otherAssets',
      other_debt:'otherDebt', otherDebt:'otherDebt', policy_memo:'policyMemo', policyMemo:'policyMemo'
    };
    Object.entries(profileMap).forEach(([srcKey, dstKey]) => {
      if (profile[srcKey] === undefined) return;
      if (dstKey === 'policyMemo') state.profile[dstKey] = String(profile[srcKey] ?? '');
      else if (['cash','investments','otherAssets','otherDebt','monthlyExpenses'].includes(dstKey)) state.profile[dstKey] = importedMoneyToManYen(profile[srcKey], srcKey) ?? state.profile[dstKey];
      else state.profile[dstKey] = num(profile[srcKey]);
      changed++;
    });

    const mortgage = obj.mortgage || {};
    const mortgageMap = [
      ['mortgage_balance','balance',true],['balance','balance',true],
      ['mortgage_rate','rate',false],['rate','rate',false],
      ['remaining_years','years',false],['years','years',false],
      ['comparison_amount','compareAmount',true],['compare_amount','compareAmount',true],['compareAmount','compareAmount',true],
      ['investment_return','investReturn',false],['investReturn','investReturn',false],
      ['investment_years','investYears',false],['investYears','investYears',false]
    ];
    mortgageMap.forEach(([srcKey,dstKey,isMoney])=>{
      if(mortgage[srcKey]===undefined) return;
      state.mortgage[dstKey] = isMoney ? (importedMoneyToManYen(mortgage[srcKey],srcKey) ?? state.mortgage[dstKey]) : num(mortgage[srcKey]);
      changed++;
    });

    if (Array.isArray(obj.events)) {
      obj.events.forEach(raw => {
        const ev = normalizeImportedEvent(raw);
        if (ev) { state.events.push(ev); changed++; }
      });
    }
    syncLegacyMonthlyIncome();
    return changed;
  }

  function normalizeImported(obj){
    // app_update は家計プロフィールの差分更新用。未指定項目は上書きしない。
    if (obj && obj.type === 'app_update') return {type:'app_update',data:obj};

    const src=obj.inputs??obj;
    const type=obj.type??obj.simulation??'';
    const get=(...keys)=>{for(const k of keys){if(src[k]!==undefined)return num(src[k]);}return undefined;};
    const getMoney=(...keys)=>{for(const k of keys){if(src[k]!==undefined)return importedMoneyToManYen(src[k], k);}return undefined;};
    if(type.includes('mortgage') || src.mortgage_balance!==undefined || src.mortgageBalance!==undefined){
      return {type:'mortgage',data:{
        balance:getMoney('mortgage_balance','mortgageBalance','balance'),
        rate:get('mortgage_rate','mortgageRate','rate'),
        years:get('remaining_years','remainingYears','mortgageYears','years'),
        compareAmount:getMoney('comparison_amount','compareAmount','available_cash','amount'),
        investReturn:get('investment_return','investReturn','expected_return'),
        investYears:get('investment_years','investYears')
      }};
    }
    if(type.includes('allocation') || type.includes('asset')){
      return {type:'allocation',data:{
        investReturn:get('investment_return','investReturn'),reserveYears:get('reserve_years','reserveYears'),extraCashReserve:getMoney('extra_cash_reserve','extraCashReserve')
      }};
    }
    if(type.includes('profile') || src.cash!==undefined || src.investments!==undefined){
      return {type:'profile',data:src};
    }
    return null;
  }

  function extractJsonObject(text){
    // ChatGPTからコードブロック・前後説明付きで貼られても、最初の完全なJSONオブジェクトだけを取り出す。
    let cleaned=String(text??'')
      .replace(/^\uFEFF/,'')
      .replace(/[“”]/g,'"')
      .replace(/[‘’]/g,"'")
      .replace(/：/g,':')
      .replace(/，/g,',')
      .replace(/｛/g,'{')
      .replace(/｝/g,'}')
      .trim();
    cleaned=cleaned.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();

    const start=cleaned.indexOf('{');
    if(start<0) throw new Error('JSONの開始 { が見つかりません');
    let depth=0,inString=false,escape=false;
    for(let i=start;i<cleaned.length;i++){
      const ch=cleaned[i];
      if(inString){
        if(escape){escape=false;continue;}
        if(ch==='\\'){escape=true;continue;}
        if(ch==='"')inString=false;
        continue;
      }
      if(ch==='"'){inString=true;continue;}
      if(ch==='{')depth++;
      if(ch==='}')depth--;
      if(depth===0) return cleaned.slice(start,i+1);
    }
    throw new Error('JSONの閉じ } が見つかりません');
  }

  function applyImport(){
    const text=$('importText').value.trim();const msg=$('importMessage');msg.textContent='';
    if(!text){msg.textContent='貼り付けるデータがありません。';return;}
    try{
      const cleaned=extractJsonObject(text);
      const obj=JSON.parse(cleaned);const norm=normalizeImported(obj);if(!norm)throw new Error('対応していないJSON形式です');
      if(norm.type==='app_update'){
        const changed=applyAppUpdate(norm.data);
        if(!changed) throw new Error('empty update');
        saveState();populateInputs();renderAll();$('importDialog').close();showPage('profile');notify(`家計情報を${changed}項目反映しました。`);
      }else if(norm.type==='mortgage'){
        Object.entries(norm.data).forEach(([k,v])=>{if(v!==undefined)state.mortgage[k]=v;});
        saveState();populateInputs();renderAll();$('importDialog').close();showPage('mortgage');notify('住宅ローン比較データを読み込みました。');
      }else if(norm.type==='allocation'){
        Object.entries(norm.data).forEach(([k,v])=>{if(v!==undefined)state.allocation[k]=v;});
        saveState();populateInputs();renderAll();$('importDialog').close();showPage('allocation');notify('資産配分データを読み込みました。');
      }else{
        ['monthlyExpenses','emergencyMonths','cash','investments','otherAssets','otherDebt','policyMemo'].forEach(k=>{
          if(norm.data[k]===undefined) return;
          if(k==='policyMemo') state.profile[k]=String(norm.data[k]??'');
          else if(['cash','investments','otherAssets','otherDebt','monthlyExpenses'].includes(k)) state.profile[k]=importedMoneyToManYen(norm.data[k],k) ?? state.profile[k];
          else state.profile[k]=num(norm.data[k]);
        });
        if(Array.isArray(norm.data.members) && norm.data.members.length===3) state.members=norm.data.members.map((m,i)=>({...state.members[i],...m,id:state.members[i].id,role:state.members[i].role}));
        syncLegacyMonthlyIncome();
        saveState();populateInputs();renderAll();$('importDialog').close();showPage('profile');notify('家計データを読み込みました。');
      }
    }catch(err){
      console.warn('Import failed',err);
      const detail=err && err.message ? `（${err.message}）` : '';
      msg.textContent=`JSONを読み取れませんでした${detail}。ChatGPTの回答全体を貼っても構いません。アプリがJSON部分を自動抽出します。`;
    }
  }

  function clearHistory(){
    if(!state.history.length)return;
    if(confirm('保存したシミュレーション履歴をすべて削除しますか？')){state.history=[];saveState();renderHistory();notify('履歴を削除しました。');}
  }

  function bindActions(){
    $('addEventBtn').addEventListener('click',addEvent);
    $('copyHomePromptBtn').addEventListener('click',()=>copyText(buildHomePrompt(),'家計相談用テキストをコピーしました。'));
    $('copyMortgagePromptBtn').addEventListener('click',()=>copyText(buildMortgagePrompt(),'住宅ローン相談用テキストをコピーしました。'));
    $('copyAllocationPromptBtn').addEventListener('click',()=>copyText(buildAllocationPrompt(),'資産配分相談用テキストをコピーしました。'));
    $('saveMortgageCaseBtn').addEventListener('click',saveMortgageCase);
    $('exportBtn').addEventListener('click',exportBackup);
    $('restoreFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)restoreBackup(f);e.target.value='';});
    $('clearHistoryBtn').addEventListener('click',clearHistory);
    $('openImportBtn').addEventListener('click',()=>{$('importText').value='';$('importMessage').textContent='';$('importDialog').showModal();});
    $('importApplyBtn').addEventListener('click',applyImport);
  }

  function renderAll(){renderHome();renderMortgage();renderAllocation();renderHistory();}

  function init(){
    if(!Array.isArray(state.members) || state.members.length!==3) state.members=structuredCloneSafe(DEFAULT_STATE.members);
    state.events=(state.events||[]).map(normalizeEvent);
    syncLegacyMonthlyIncome(); saveState();
    bindTabs();populateInputs();bindInputs();bindActions();renderAll();
    if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
      navigator.serviceWorker.register('./sw.js?v=20260905-4').then(reg=>reg.update()).catch(()=>{});
    }
  }

  init();
})();
