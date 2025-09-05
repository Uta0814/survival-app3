/* 既存スタイルはそのまま。下にマップ関連を追加 */

#map {
  width: 100%;
  height: 60vh;       /* 画面高の6割を地図に */
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #0f121a;
  margin-top: 8px;
}

/* ピン（DivIcon） */
.pin { 
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid rgba(0,0,0,.6);
  box-shadow: 0 1px 4px rgba(0,0,0,.5);
}
.pin-self  { background: #00d1b2; }
.pin-ally  { background: #3da9fc; }
.pin-enemy { background: #ff6b6b; }
.pin-obj   { background: #ffd166; }
.pin-warn  { background: #c084fc; }

.palette { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; }
.chip { padding:8px 10px; border-radius:999px; font-size:14px; }
