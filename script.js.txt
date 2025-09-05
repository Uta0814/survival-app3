/* =========================
   ストレージ管理
========================= */
const LS_KEYS = {
  games: 'sg_games_v1',
  memos: 'sg_memos_v1',
};

function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('loadData error', e);
    return fallback;
  }
}
function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* =========================
   初期化
========================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  games: loadData(LS_KEYS.games),
  memos: loadData(LS_KEYS.memos),
  timer: {
    running: false,
    endAt: 0,
    intervalId: null,
    oneMinBeeped: false,
    audioUnlocked: false,
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // タブ切替
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      $$('.tabpanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.target).classList.add('active');
      // スクリーンリーダー向け
      $$('.tab').forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
    });
  });

  // 日付の初期値 = 今日
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  $('#gameDate').value = `${y}-${m}-${d}`;
  $('#memoDate').value = `${y}-${m}-${d}`;

  // 表示初期化
  renderGames();
  renderMemos();
  updateStats();

  // フォームイベント
  $('#gameForm').addEventListener('submit', onSaveGame);
  $('#memoForm').addEventListener('submit', onSaveMemo);

  // タイマー
  setupBeepAudio();
  $('#startBtn').addEventListener('click', onTimerStart);
  $('#pauseBtn').addEventListener('click', onTimerPause);
  $('#resetBtn').addEventListener('click', onTimerReset);
  $('#minInput').addEventListener('change', onTimerInputsChange);
  $('#secInput').addEventListener('change', onTimerInputsChange);

  // 分析
  $('#runAnalyze').addEventListener('click', runAnalyze);

  // 入力値から初期表示
  onTimerInputsChange();
});

/* =========================
   KD記録
========================= */
function onSaveGame(e) {
  e.preventDefault();
  const date = $('#gameDate').value;
  const title = $('#gameTitle').value.trim();
  const kills = Number($('#kills').value);
  const deaths = Number($('#deaths').value);

  if (!date || Number.isNaN(kills) || Number.isNaN(deaths)) return;

  state.games.unshift({
    id: crypto.randomUUID(),
    date, title,
    kills, deaths,
    createdAt: Date.now(),
  });

  saveData(LS_KEYS.games, state.games);
  e.target.reset();
  $('#gameDate').value = date; // 日付は維持
  renderGames();
  updateStats();
}

function renderGames() {
  const tbody = $('#gamesTable tbody');
  tbody.innerHTML = '';
  $('#gamesEmpty').style.display = state.games.length ? 'none' : 'block';

  for (const g of state.games) {
    const tr = document.createElement('tr');
    const kd = g.deaths === 0 ? (g.kills > 0 ? '∞' : '0') : (g.kills / g.deaths).toFixed(2);
    tr.innerHTML = `
      <td>${g.date}</td>
      <td>${escapeHTML(g.title || '')}</td>
      <td>${g.kills}</td>
      <td>${g.deaths}</td>
      <td>${kd}</td>
      <td><button class="btn danger" data-id="${g.id}" aria-label="削除">削除</button></td>
    `;
    tbody.appendChild(tr);
  }

  // 削除
  $$('#gamesTable .btn.danger').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.games = state.games.filter(g => g.id !== id);
      saveData(LS_KEYS.games, state.games);
      renderGames();
      updateStats();
    });
  });
}

function updateStats() {
  const totalKills = state.games.reduce((a, b) => a + b.kills, 0);
  const totalDeaths = state.games.reduce((a, b) => a + b.deaths, 0);
  const avgKills = state.games.length ? (totalKills / state.games.length) : 0;
  const avgDeaths = state.games.length ? (totalDeaths / state.games.length) : 0;
  const overallKD = totalDeaths === 0 ? (totalKills > 0 ? Infinity : 0) : totalKills / totalDeaths;

  $('#totalKills').textContent = totalKills;
  $('#totalDeaths').textContent = totalDeaths;
  $('#avgKills').textContent = avgKills.toFixed(1);
  $('#avgDeaths').textContent = avgDeaths.toFixed(1);
  $('#overallKD').textContent = Number.isFinite(overallKD) ? overallKD.toFixed(2) : '∞';
}

/* =========================
   メモ
========================= */
function onSaveMemo(e) {
  e.preventDefault();
  const date = $('#memoDate').value;
  const title = $('#memoTitle').value.trim();
  const body = $('#memoBody').value.trim();
  if (!date || !title) return;

  state.memos.unshift({
    id: crypto.randomUUID(),
    date, title, body,
    createdAt: Date.now(),
  });
  saveData(LS_KEYS.memos, state.memos);
  e.target.reset();
  $('#memoDate').value = date;
  renderMemos();
}

function renderMemos() {
  const list = $('#memoList');
  list.innerHTML = '';
  $('#memosEmpty').style.display = state.memos.length ? 'none' : 'block';

  for (const m of state.memos) {
    const li = document.createElement('li');
    li.className = 'memo-item';
    li.innerHTML = `
      <div class="memo-title">${escapeHTML(m.title)}</div>
      <div class="memo-meta">${m.date}</div>
      <div class="memo-body">${escapeHTML(m.body || '')}</div>
      <div style="margin-top:6px;display:flex;gap:8px;justify-content:flex-end">
        <button class="btn danger" data-id="${m.id}">削除</button>
      </div>
    `;
    list.appendChild(li);
  }

  $$('#memoList .btn.danger').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      state.memos = state.memos.filter(m => m.id !== id);
      saveData(LS_KEYS.memos, state.memos);
      renderMemos();
    });
  });
}

/* =========================
   タイマー（iOSでのオーディオ解放対応）
========================= */
// ビープ音のWAVデータを生成して <audio> に設定（外部ファイル不要）
function setupBeepAudio() {
  const beep = $('#beep');
  const url = createBeepWavURL({ durationSec: 0.25, freqHz: 880, volume: 0.4 });
  beep.src = url;
  beep.load();
}

// ユーザー操作で「音を解放」→ 1分前に自動再生可能に
async function unlockAudioOnce() {
  if (state.timer.audioUnlocked) return true;
  const beep = $('#beep');
  try {
    await beep.play();       // 再生
    await waitMs(60);        // iOSで即pauseすると解放されない事があるので微ウェイト
    beep.pause();            // すぐ停止
    beep.currentTime = 0;
    state.timer.audioUnlocked = true;
    return true;
  } catch (e) {
    console.warn('Audio unlock failed:', e);
    return false;
  }
}

function onTimerInputsChange() {
  let m = Math.max(0, parseInt($('#minInput').value || '0', 10));
  let s = Math.max(0, Math.min(59, parseInt($('#secInput').value || '0', 10)));
  $('#timerDisplay').textContent = fmtTime(m * 60 + s);
}

async function onTimerStart() {
  // まず音を解放（iOS Safariは「ユーザー操作直後」のplayのみ許可）
  await unlockAudioOnce();

  let m = Math.max(0, parseInt($('#minInput').value || '0', 10));
  let s = Math.max(0, Math.min(59, parseInt($('#secInput').value || '0', 10)));
  const totalSec = m * 60 + s;
  if (totalSec <= 0) return;

  state.timer.oneMinBeeped = false;
  state.timer.running = true;
  state.timer.endAt = Date.now() + totalSec * 1000;

  tickTimer(); // 即時描画
  clearInterval(state.timer.intervalId);
  state.timer.intervalId = setInterval(tickTimer, 200); // ドリフト少なめに
}

function onTimerPause() {
  if (!state.timer.running) return;
  const remain = Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
  state.timer.running = false;
  clearInterval(state.timer.intervalId);
  // 残りを入力欄へ戻す
  $('#minInput').value = Math.floor(remain / 60);
  $('#secInput').value = remain % 60;
  onTimerInputsChange();
}

function onTimerReset() {
  state.timer.running = false;
  state.timer.endAt = 0;
  state.timer.oneMinBeeped = false;
  clearInterval(state.timer.intervalId);
  onTimerInputsChange();
}

function tickTimer() {
  if (!state.timer.running) return;
  const remain = Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
  $('#timerDisplay').textContent = fmtTime(remain);

  // 残り1分でビープ
  if ($('#oneMinBeep').checked && !state.timer.oneMinBeeped && remain === 60) {
    playBeep();
    state.timer.oneMinBeeped = true;
  }

  if (remain <= 0) {
    state.timer.running = false;
    clearInterval(state.timer.intervalId);
    // 終了時に軽く2回ビープ（任意）
    playBeep();
    setTimeout(playBeep, 300);
  }
}

function playBeep() {
  const beep = $('#beep');
  // 解放済みなら普通に再生、未解放なら失敗するので何もしない（UIヒントに委ねる）
  beep.currentTime = 0;
  beep.play().catch(() => {});
}

/* =========================
   分析
========================= */
function runAnalyze() {
  const out = $('#analysisOutput');
  const games = state.games.slice().reverse(); // 古→新
  const memos = state.memos;

  if (!games.length && !memos.length) {
    out.innerHTML = `<p>まだデータがありません。まずは「KD記録」や「メモ」を保存してください。</p>`;
    return;
  }

  // --- KDトレンド ---
  const lastN = games.slice(-5);
  const kdArr = lastN.map(g => g.deaths === 0 ? (g.kills > 0 ? Infinity : 0) : g.kills / g.deaths);
  const kdReadable = kdArr.map(k => Number.isFinite(k) ? Number(k.toFixed(2)) : '∞');

  let kdAdvice = '';
  if (kdArr.length >= 2) {
    const first = kdArr[0], last = kdArr[kdArr.length - 1];
    if (Number.isFinite(first) && Number.isFinite(last)) {
      if (last > first + 0.2) kdAdvice = 'KD比が向上しています。今の立ち回りを継続しましょう。';
      else if (last < first - 0.2) kdAdvice = '直近でKD比が低下。無理な前進を控え、射線と遮蔽物の使い方を見直しましょう。';
      else kdAdvice = 'KD比は横ばいです。得意なパターンの再現性を高めると一段伸びます。';
    } else if (!Number.isFinite(last) && first === 0) {
      kdAdvice = 'デスを抑えた立ち回りができています（∞）。無理押しせず連携を意識。';
    }
  } else {
    kdAdvice = 'データが少ないため傾向は不明。3〜5ゲーム分たまると傾向が見えます。';
  }

  // --- メモのキーワード傾向 ---
  const dict = {
    攻め: ['ラッシュ','突撃','前進','無理押し'],
    遮蔽物: ['遮蔽物','カバー','射線','顔出し','チラ見','ピーク'],
    立ち回り: ['裏取り','フランク','角待ち','リスキル','リスポーン','ポジ取り'],
    索敵: ['索敵','クリアリング','足音','音','視界','死角'],
    連携: ['連携','報告','無線','カバーリング','コール'],
    エイム: ['エイム','サイト','リコイル','ブレ','トラッキング','偏差'],
    装備: ['リロード','弾切れ','マガジン','バッテリー','ライト','サイトずれ'],
    メンタル: ['焦り','冷静','判断','集中','疲れ'],
  };

  const textAll = memos.map(m => `${m.title}\n${m.body || ''}`).join('\n').toLowerCase();
  const counts = {};
  for (const [cat, words] of Object.entries(dict)) {
    counts[cat] = words.reduce((acc, w) => {
      const c = countKeyword(textAll, w.toLowerCase());
      return acc + c;
    }, 0);
  }
  const topCats = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).filter(([_,c])=>c>0);

  const adviceByCat = {
    攻め: '「攻め」ワードが多め。序盤の様子見→有利射線からの圧で、無理押しを減らすと安定します。',
    遮蔽物: '遮蔽物・射線の課題が目立ちます。頭1つ出し（ヘッドグリッチ）やチラ見の角度を練習しましょう。',
    立ち回り: '立ち回りワードが多いです。フランクのタイミングをチームの前衛と同期すると成功率が上がります。',
    索敵: '索敵ワード多め。足音・物音の「間」を聞く癖と、角の手前で一拍置く習慣が有効です。',
    連携: '連携が課題。短いコール（方位/距離/人数）に統一して、味方の意思決定を早めましょう。',
    エイム: 'エイム強化が鍵。肩幅ストレイフ→停止→1〜3点での初弾精度を重点練習。',
    装備: '装備起因のロスが見えます。マガジン管理と事前点検（ゼロイン、バッテリー、スリング）で事故を削減。',
    メンタル: '焦りが気になる様子。撃ち合い前の呼吸リセット（4秒吸う→4秒止める→6秒吐く）で判断精度UP。',
  };

  const tagsHTML = topCats.length
    ? `<p>${topCats.map(([k,c])=>`<span class="tag">${k} × ${c}</span>`).join('')}</p>`
    : '<p class="muted">メモから顕著な傾向は見えません。</p>';

  const catAdvices = topCats.map(([k]) => `<li>${adviceByCat[k] || ''}</li>`).join('');

  out.innerHTML = `
    <p><strong>直近KD（古→新）:</strong> ${kdReadable.join(' , ')}</p>
    <p>${kdAdvice}</p>
    <hr>
    <h3>メモのキーワード傾向</h3>
    ${tagsHTML}
    ${catAdvices ? `<ul>${catAdvices}</ul>` : ''}
    <hr>
    <p class="muted">ヒント：各ゲーム後に「状況」「良かった点」「次やること」を短く残すと分析の精度が上がります。</p>
  `;
}

/* =========================
   ユーティリティ
========================= */
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtTime(sec) {
  const m = Math.floor(sec/60);
  const s = sec%60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function countKeyword(textLower, keywordLower) {
  if (!keywordLower) return 0;
  // 日本語は単語境界が曖昧なので単純出現回数をカウント
  let count = 0, idx = 0;
  while (true) {
    idx = textLower.indexOf(keywordLower, idx);
    if (idx === -1) break;
    count++; idx += keywordLower.length;
  }
  return count;
}
function waitMs(ms){ return new Promise(r => setTimeout(r, ms)); }

/* WAVを生成してdata URLを返す */
function createBeepWavURL({ durationSec=0.25, freqHz=880, volume=0.4, sampleRate=44100 } = {}) {
  const samples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(44 + samples * 2); // 16-bit mono
  const view = new DataView(buffer);

  // ヘッダ（RIFF/WAVE/fmt /data）
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples*2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);   // PCM fmt chunk size
  view.setUint16(20, 1, true);    // audio format = PCM
  view.setUint16(22, 1, true);    // channels = 1
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);    // block align
  view.setUint16(34, 16, true);   // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples*2, true);

  // 波形（軽くフェードイン/アウト）
  const fade = Math.min(0.02, durationSec/4);
  const fadeSamples = Math.floor(fade * sampleRate);
  for (let i=0; i<samples; i++){
    const t = i / sampleRate;
    let amp = Math.sin(2*Math.PI*freqHz*t);

    // 短フェード
    if (i < fadeSamples) amp *= i / fadeSamples;
    if (i > samples - fadeSamples) amp *= (samples - i) / fadeSamples;

    const s = Math.max(-1, Math.min(1, amp * volume));
    view.setInt16(44 + i*2, s * 0x7FFF, true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}
function writeString(view, offset, str){
  for (let i=0; i<str.length; i++) view.setUint8(offset+i, str.charCodeAt(i));
}
