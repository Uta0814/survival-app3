/* =======================
   Sabage Logger (v5)
   - KD管理 / タイマー / 分析
   - 戦術マップ：画像、矢印マーカー（回転）、線描画、保存/読込
   ======================= */

const STORAGE_KEY = "sg_logs_v1";
const MAP_STORE_KEY = "sg_tactics_v1";
const PLAN_INDEX_KEY = "sg_tactics_plans";

/* ---------- タブ ---------- */
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if(btn.dataset.tab==="analysis") renderAnalysis();
    if(btn.dataset.tab==="tactics")  setTimeout(initMapIfNeeded, 0);
  });
});

/* ---------- KD管理 ---------- */
function calcKD(k,d){ k=+k||0; d=+d||0; return d? (k/d) : (k>0? k:0); }
function fmt(x, n=2){ return Number(x).toFixed(n); }
function loadLogs(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); }catch{ return []; } }
function saveLogs(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr||[])); }

function renderStats(){
  const logs = loadLogs();
  let sumK=0,sumD=0,sumKD=0;
  logs.forEach(g=>{ sumK+=g.kills; sumD+=g.deaths; sumKD+=calcKD(g.kills,g.deaths); });
  const n = logs.length;

  document.getElementById("sumKills").textContent = sumK;
  document.getElementById("sumDeaths").textContent = sumD;
  document.getElementById("overallKD").textContent = fmt(calcKD(sumK,sumD));
  document.getElementById("avgKills").textContent = fmt(n?sumK/n:0,1);
  document.getElementById("avgDeaths").textContent = fmt(n?sumD/n:0,1);
  document.getElementById("avgKD").textContent = fmt(n?sumKD/n:0);

  const tbody = document.getElementById("logsTableBody");
  tbody.innerHTML = "";
  logs.forEach((g,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${g.date||""}</td><td>${escapeHTML(g.title||"")}</td>
       <td>${g.kills}</td><td>${g.deaths}</td><td>${fmt(calcKD(g.kills,g.deaths))}</td>
       <td>${escapeHTML(g.memo||"")}</td>
       <td><button class="danger" data-i="${i}">削除</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("button[data-i]").forEach(btn=>{
    btn.onclick=()=>{
      const logs2 = loadLogs();
      logs2.splice(+btn.dataset.i,1);
      saveLogs(logs2);
      renderStats(); renderAnalysis();
    };
  });
}
function escapeHTML(s){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

renderStats();

document.getElementById("logForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const d = new FormData(e.target);
  const entry = {
    date: d.get("date")||"",
    title: (d.get("title")||"").trim(),
    kills: +d.get("kills")||0,
    deaths: +d.get("deaths")||0,
    memo: (d.get("memo")||"").trim(),
    createdAt: Date.now()
  };
  const logs = loadLogs(); logs.push(entry); saveLogs(logs);
  renderStats(); renderAnalysis();
  alert("保存しました");
});

document.getElementById("clearAll").onclick = ()=>{
  if(confirm("全データを削除します。よろしいですか？")){
    localStorage.removeItem(STORAGE_KEY);
    renderStats(); renderAnalysis();
  }
};

/* ライブアドバイス */
["kills","deaths","memo"].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener("input",()=>{
    const kd = calcKD(document.getElementById("kills").value, document.getElementById("deaths").value);
    document.getElementById("liveAdvice").textContent = generateAdvice(kd, document.getElementById("memo").value);
  });
});
function generateAdvice(kd, memoText){
  let base = kd>=1.5 ? "とても良いペース。前線維持と無理突の区別が効いています。"
           : kd>=1.0 ? "安定しています。終盤の被弾を抑えられるとさらに良し。"
           : kd>0.0  ? "改善余地あり。射線管理とカバー範囲を意識。"
                      : "まずは確実に1キル。被弾原因をメモに残すと伸びます。";
  const extra = keywordAdvice((memoText||"").toLowerCase());
  return base + (extra[0]? "／" + extra[0] : "");
}

/* ---------- タイマー（iOS音対策） ---------- */
let audioCtx=null, soundUnlocked=false, timerInt=null, pausedRemain=null;
function ensureAudio(){ if(!audioCtx){ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); } if(audioCtx.state==="suspended"){ audioCtx.resume(); } soundUnlocked=(audioCtx.state==="running"); if(soundUnlocked){ try{ beep(880,0.04); }catch{} } document.getElementById("soundStatus").textContent="音声：" + (soundUnlocked?"有効":"未有効"); }
function beep(freq=880, dur=0.15){ if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type="sine"; o.frequency.setValueAtTime(freq,audioCtx.currentTime); g.gain.setValueAtTime(0.0001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.2,audioCtx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+dur); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+dur+0.02); }
function fmtMMSS(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }

document.getElementById("startTimer").onclick = ()=>{
  ensureAudio();
  let m=+document.getElementById("minutes").value||0, s=+document.getElementById("seconds").value||0;
  let remain = pausedRemain!=null ? pausedRemain : (m*60+s);
  if(remain<=0){ alert("1秒以上を設定してください"); return; }
  clearInterval(timerInt);
  timerInt=setInterval(()=>{
    document.getElementById("timeLeft").textContent = fmtMMSS(remain);
    if(remain===60 && soundUnlocked) beep(1000,0.12);
    if(remain<=0){ clearInterval(timerInt); if(soundUnlocked){ beep(1200); setTimeout(()=>beep(1200),200); setTimeout(()=>beep(900,0.2),400); } if(navigator.vibrate) navigator.vibrate([150,80,150]); pausedRemain=null; toggleTimerBtns(false); return; }
    remain--;
    pausedRemain=remain;
  },1000);
  toggleTimerBtns(true);
};
document.getElementById("pauseTimer").onclick = ()=>{ clearInterval(timerInt); toggleTimerBtns(false); };
document.getElementById("resetTimer").onclick = ()=>{ clearInterval(timerInt); pausedRemain=null; document.getElementById("timeLeft").textContent = fmtMMSS((+minutes.value||0)*60+(+seconds.value||0)); toggleTimerBtns(false); };
function toggleTimerBtns(running){ document.getElementById("pauseTimer").disabled=!running; document.getElementById("resetTimer").disabled=!running; }

/* ---------- 分析 ---------- */
function renderAnalysis(){
  const logs=loadLogs(), recent=logs.slice(0,5), previous=logs.slice(5,10);
  const rl=document.getElementById("recentList"), pl=document.getElementById("previousList");
  rl.innerHTML=""; pl.innerHTML="";
  recent.forEach(g=>{ const li=document.createElement("li"); li.textContent=`${g.date||"—"}  KD:${fmt(calcKD(g.kills,g.deaths))} (${g.title||""})`; rl.appendChild(li); });
  previous.forEach(g=>{ const li=document.createElement("li"); li.textContent=`${g.date||"—"}  KD:${fmt(calcKD(g.kills,g.deaths))} (${g.title||""})`; pl.appendChild(li); });
  let txt="";
  if(!recent.length) txt="データがありません。まずは記録を追加しましょう。";
  else if(!previous.length) txt=`直近平均KD: ${fmt(avgKD(recent))}（比較不足）`;
  else {
    const diff=avgKD(recent)-avgKD(previous);
    if(diff>0.05) txt=`KD比が向上（直近:${fmt(avgKD(recent))} / 過去:${fmt(avgKD(previous))}）`;
    else if(diff<-0.05) txt=`デス増加傾向。立ち回り/カバー見直し（直近:${fmt(avgKD(recent))} / 過去:${fmt(avgKD(previous))}）`;
    else txt=`大きな変化なし（直近:${fmt(avgKD(recent))} / 過去:${fmt(avgKD(previous))}）`;
  }
  document.getElementById("trendSummary").textContent=txt;

  const adv = keywordAdvice(logs.map(g=>(g.memo||"").toLowerCase()).join("\n"));
  const ul = document.getElementById("keywordAdvice"); ul.innerHTML="";
  (adv.length?adv:["傾向はまだ不十分。短いキーワードでもメモに残すと分析精度UP。"]).forEach(t=>{ const li=document.createElement("li"); li.textContent=t; ul.appendChild(li); });
}
function avgKD(arr){ if(!arr.length) return 0; let s=0; arr.forEach(g=>s+=calcKD(g.kills,g.deaths)); return s/arr.length; }
function keywordAdvice(text){
  const tips=[], has = ws=>ws.some(w=>text.includes(w));
  if(!text) return tips;
  if(has(["右","right"])) tips.push("右展開が多い。左カウンターに注意しつつサイド交替を。");
  if(has(["左","left"])) tips.push("左展開傾向。中央の圧力を維持しクロス射線を。");
  if(has(["ラッシュ","rush","凸"])) tips.push("ラッシュ多め。2段目カバー位置の事前決めで被弾減。");
  if(has(["待ち","芋","camp"])) tips.push("待ち中心。1名前進の“釣り”でリズム変化を。");
  if(has(["連携","報告","コール"])) tips.push("コール表現の固定化で安定感UP。");
  if(has(["リロード","弾切れ"])) tips.push("前リロード習慣化＆遮蔽物裏の角度作りを。");
  if(has(["裏取り","flank"])) tips.push("退路確保とタイミング共有で成功率UP。");
  if(has(["視界","ライト"])) tips.push("ライトは“一瞬点灯→オフ”。ピークは浅めに。");
  if(has(["屋外","森林"])) tips.push("屋外は射程管理と一射入魂を。");
  if(has(["cqb","屋内","インドア"])) tips.push("CQBは“手前確保→段階前進”で被弾減。");
  return Array.from(new Set(tips));
}

/* ---------- 戦術マップ ---------- */
let map, imageLayer, currentImageSize=[1000,1000];
let currentMarkers = [];        // {m:L.Marker, type, label, angle}
let currentPolylines = [];      // {l:L.Polyline, type, points:[{lat,lng}]}
let currentType="self";         // marker type
let drawType=null;              // "route"|"push"|"danger"|null
let drawing=null;               // {type, points:[], layer}

function initMapIfNeeded(){
  if(map) return;
  const el = document.getElementById("map");
  map = L.map(el, { crs:L.CRS.Simple, attributionControl:false });
  const b = [[0,0],[currentImageSize[1], currentImageSize[0]]];
  imageLayer = L.imageOverlay("", b).addTo(map);
  map.fitBounds(b);
  map.setMaxBounds(b);

  // クリック：描画 or マーカー
  map.on("click", (e)=>{
    if(drawType){  // 線モード
      if(!drawing){
        drawing = { type: drawType, points: [ [e.latlng.lat, e.latlng.lng] ] };
        drawing.layer = L.polyline(drawing.points, { color: lineColor(drawType), weight: 3 }).addTo(map);
      }else{
        drawing.points.push([e.latlng.lat, e.latlng.lng]);
        drawing.layer.setLatLngs(drawing.points);
      }
      saveMapState();
      return;
    }
    // マーカー配置（矢印アイコン）
    addArrowMarker(e.latlng.lat, e.latlng.lng, currentType, "", 0);
    saveMapState();
  });

  // パレット
  document.querySelectorAll(".chip[data-type]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ currentType = btn.getAttribute("data-type"); if(navigator.vibrate) navigator.vibrate(8); });
  });
  document.querySelectorAll(".chip[data-line]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const t = btn.getAttribute("data-line");
      drawType = (drawType===t) ? null : t;   // 同じボタンでオン/オフ
      document.querySelectorAll(".chip[data-line]").forEach(b=>b.classList.remove("active"));
      if(drawType) btn.classList.add("active");
    });
  });

  // 線操作
  document.getElementById("finishLine").addEventListener("click", ()=>{
    if(!drawing || drawing.points.length<2){ alert("点を2つ以上打ってください"); return; }
    currentPolylines.push({ l:drawing.layer, type:drawing.type, points: drawing.points.map(p=>({lat:p[0],lng:p[1]})) });
    drawing=null; saveMapState();
  });
  document.getElementById("undoPoint").addEventListener("click", ()=>{
    if(drawing && drawing.points.length>0){
      drawing.points.pop(); drawing.layer.setLatLngs(drawing.points);
      if(drawing.points.length===0){ map.removeLayer(drawing.layer); drawing=null; }
      saveMapState();
    }
  });
  document.getElementById("clearLines").addEventListener("click", ()=>{
    if(confirm("線を全て消去しますか？")){
      if(drawing){ map.removeLayer(drawing.layer); drawing=null; }
      currentPolylines.forEach(o=>map.removeLayer(o.l));
      currentPolylines=[]; saveMapState();
    }
  });

  // 画像読み込み
  document.getElementById("mapImage").addEventListener("change",(ev)=>{
    const f = ev.target.files && ev.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        currentImageSize = [img.width, img.height];
        const b2 = [[0,0],[img.height,img.width]];
        if(imageLayer) map.removeLayer(imageLayer);
        imageLayer = L.imageOverlay(reader.result, b2).addTo(map);
        map.setMaxBounds(b2);
        map.fitBounds(b2);
        saveMapState(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  // プラン保存/読込
  document.getElementById("savePlan").addEventListener("click", ()=>{
    const name = (document.getElementById("planName").value||"").trim();
    if(!name){ alert("プラン名を入力してください"); return; }
    const all = loadPlanIndex(); all[name] = exportPlan(); localStorage.setItem(PLAN_INDEX_KEY, JSON.stringify(all));
    alert("保存しました（"+name+"）");
  });
  document.getElementById("loadPlan").addEventListener("click", ()=>{
    const all = loadPlanIndex(); const names = Object.keys(all);
    if(!names.length){ alert("保存済みプランがありません"); return; }
    const pick = prompt("読込むプラン名を入力\n\n"+names.join("\n"));
    if(!pick || !all[pick]) return;
    importPlan(all[pick]); document.getElementById("planName").value = pick;
  });
  document.getElementById("clearPlan").addEventListener("click", ()=>{
    if(confirm("マーカー・線・画像を全て消去しますか？")){
      clearMarkers(); clearAllLines();
      if(imageLayer) map.removeLayer(imageLayer);
      const b0 = [[0,0],[currentImageSize[1], currentImageSize[0]]];
      imageLayer = L.imageOverlay("", b0).addTo(map);
      map.fitBounds(b0);
      saveMapState(null);
    }
  });

  // 復元
  restoreMapState();
}

function lineColor(t){ return t==="route" ? "#3da9fc" : t==="push" ? "#00d1b2" : "#ff6b6b"; }

/* 矢印マーカー（角度deg） */
function addArrowMarker(lat,lng,type,label,angle){
  const html = `<div class="arrow arrow-${type||"self"}" style="transform:rotate(${(angle||0)}deg)"></div>`;
  const icon = L.divIcon({ className:"", html, iconSize:[20,20], iconAnchor:[10,14] });
  const m = L.marker([lat,lng], { draggable:true, icon }).addTo(map);
  m._type = type||"self"; m._label = label||""; m._angle = angle||0;

  // ツールチップ（ラベル）
  if(label) m.bindTooltip(label, {permanent:true, direction:"top", offset:[0,-10]}).openTooltip();

  // タップ：ラベル・向き編集
  m.on("click", ()=>{
    const text = prompt("ラベル（空欄OK）", m._label||"");
    if(text===null) return;  // キャンセル
    m._label = (text||"").trim();
    if(m._label) m.bindTooltip(m._label,{permanent:true,direction:"top",offset:[0,-10]}).openTooltip();
    else m.unbindTooltip();

    const a = prompt("向き（度数：0が上、右回り）", String(m._angle||0));
    if(a!==null){
      const ang = Number(a)||0;
      m._angle = ang;
      // アイコンを差し替え（回転更新）
      const html2 = `<div class="arrow arrow-${m._type}" style="transform:rotate(${ang}deg)"></div>`;
      m.setIcon(L.divIcon({className:"", html:html2, iconSize:[20,20], iconAnchor:[10,14]}));
    }
    saveMapState();
  });

  // 長押し削除
  let hold=null;
  m.on("mousedown touchstart", ()=>{ hold=setTimeout(()=>{ map.removeLayer(m); currentMarkers=currentMarkers.filter(x=>x.m!==m); saveMapState(); },700); });
  m.on("mouseup mouseleave touchend dragstart", ()=>{ if(hold){ clearTimeout(hold); hold=null; }});

  m.on("dragend", saveMapState);

  currentMarkers.push({ m, type:m._type, label:m._label, angle:m._angle });
  return m;
}
function clearMarkers(){ currentMarkers.forEach(x=>map.removeLayer(x.m)); currentMarkers=[]; }
function clearAllLines(){ currentPolylines.forEach(o=>map.removeLayer(o.l)); currentPolylines=[]; }

/* プラン入出力 & 永続化 */
function exportPlan(){
  const img = imageLayer && imageLayer._url ? imageLayer._url : null;
  return {
    image: img,
    size: currentImageSize,
    markers: currentMarkers.map(x=>{ const ll=x.m.getLatLng(); return {lat:ll.lat,lng:ll.lng,type:x.type,label:x.label,angle:x.angle||0}; }),
    lines: currentPolylines.map(o=>({ type:o.type, points:o.points }))
  };
}
function importPlan(data){
  clearMarkers(); clearAllLines();
  if(!data) return;
  currentImageSize = data.size || currentImageSize;
  const b = [[0,0],[currentImageSize[1], currentImageSize[0]]];
  if(imageLayer) map.removeLayer(imageLayer);
  imageLayer = L.imageOverlay(data.image||"", b).addTo(map);
  map.setMaxBounds(b); map.fitBounds(b);

  (data.markers||[]).forEach(it=> addArrowMarker(it.lat,it.lng,it.type,it.label,it.angle||0));
  (data.lines||[]).forEach(it=>{
    const latlngs = it.points.map(p=>[p.lat,p.lng]);
    const l = L.polyline(latlngs, {color:lineColor(it.type), weight:3}).addTo(map);
    currentPolylines.push({ l, type:it.type, points: it.points });
  });
}
function saveMapState(optImg){ const d = exportPlan(); if(optImg!==undefined) d.image=optImg; localStorage.setItem(MAP_STORE_KEY, JSON.stringify(d)); }
function restoreMapState(){ try{ const raw=localStorage.getItem(MAP_STORE_KEY); if(!raw) return; importPlan(JSON.parse(raw)); }catch{} }
function loadPlanIndex(){ try{ return JSON.parse(localStorage.getItem(PLAN_INDEX_KEY)||"{}"); }catch{ return {}; } }

/* ---------- 初期描画 ---------- */
renderAnalysis();
document.getElementById("timeLeft").textContent = "10:00";
