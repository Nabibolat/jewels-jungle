(() => {
  const tg = window.Telegram?.WebApp;
  try { tg?.ready(); tg?.expand(); } catch (_) {}
  const $ = (id) => document.getElementById(id);
  const SIZE = 8, TYPES = ["💎","🍀","🍊","💜","🌺","🟡"];
  let board = [], selected = -1, score = 0, moves = 25, busy = false, best = 0;
  const key = "jewels-jungle-best-v1";
  try { best = Number(localStorage.getItem(key) || 0); } catch (_) {}
  const player = tg?.initDataUnsafe?.user;
  $("profile").textContent = player?.first_name || "Гость джунглей";
  function updateStats(){ $("score").textContent=score; $("best").textContent=best; $("moves").textContent=moves; }
  function randomTile(){ return Math.floor(Math.random()*TYPES.length); }
  function hasMatchAt(i){
    const x=i%SIZE,y=Math.floor(i/SIZE),v=board[i]; if(v==null)return false;
    let n=1; for(let a=x-1;a>=0&&board[y*SIZE+a]===v;a--)n++; for(let a=x+1;a<SIZE&&board[y*SIZE+a]===v;a++)n++; if(n>=3)return true;
    n=1; for(let a=y-1;a>=0&&board[a*SIZE+x]===v;a--)n++; for(let a=y+1;a<SIZE&&board[a*SIZE+x]===v;a++)n++; return n>=3;
  }
  function makeBoard(){
    board=Array(SIZE*SIZE).fill(0).map((_,i)=>{let v;do{v=randomTile();}while((i%SIZE>=2&&board[i-1]===v&&board[i-2]===v)||(i>=SIZE*2&&board[i-SIZE]===v&&board[i-SIZE*2]===v));return v;});
  }
  function render(){
    const root=$("board"); root.innerHTML="";
    board.forEach((v,i)=>{const b=document.createElement("button");b.className="tile"+(selected===i?" selected":"");b.type="button";b.textContent=v==null?"":TYPES[v];b.setAttribute("role","gridcell");b.setAttribute("aria-label",TYPES[v]||"Пусто");b.addEventListener("click",()=>tap(i));root.appendChild(b);});
    updateStats();
  }
  const neighbors=(a,b)=>Math.abs(a%SIZE-b%SIZE)+Math.abs(Math.floor(a/SIZE)-Math.floor(b/SIZE))===1;
  async function tap(i){
    if(busy||moves<=0)return;
    if(selected===-1){selected=i;render();return;}
    if(selected===i){selected=-1;render();return;}
    if(!neighbors(selected,i)){selected=i;render();return;}
    const a=selected;selected=-1;[board[a],board[i]]=[board[i],board[a]];
    if(!board.some((_,j)=>hasMatchAt(j))){[board[a],board[i]]=[board[i],board[a]];$("hint").textContent="Такой ход не создаёт комбинацию. Попробуй ещё!";render();return;}
    moves--;busy=true;await resolveMatches();busy=false;render();
    if(moves===0)$("hint").textContent="Ходы закончились! Нажми «Заново», чтобы сыграть ещё.";
  }
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  async function resolveMatches(){
    let chain=0;
    while(true){
      const matched=new Set();
      for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const i=y*SIZE+x,v=board[i];if(v==null)continue;
        let run=[i];for(let xx=x+1;xx<SIZE&&board[y*SIZE+xx]===v;xx++)run.push(y*SIZE+xx);if(run.length>=3)run.forEach(k=>matched.add(k));
        run=[i];for(let yy=y+1;yy<SIZE&&board[yy*SIZE+x]===v;yy++)run.push(yy*SIZE+x);if(run.length>=3)run.forEach(k=>matched.add(k));
      }
      if(!matched.size)break;
      chain++;score+=matched.size*10*(chain>1?chain:1);
      if(score>best){best=score;try{localStorage.setItem(key,String(best));}catch(_){}}
      matched.forEach(i=>board[i]=null);render();await sleep(130);
      for(let x=0;x<SIZE;x++){let vals=[];for(let y=SIZE-1;y>=0;y--)if(board[y*SIZE+x]!=null)vals.push(board[y*SIZE+x]);for(let y=SIZE-1;y>=0;y--)board[y*SIZE+x]=vals[SIZE-1-y]??randomTile();}
      render();await sleep(130);
    }
    if(chain>1)$("hint").textContent="Комбо x"+chain+"! Отличная серия! ✨";
    else $("hint").textContent="Отличный ход! Продолжай собирать камни.";
  }
  function restart(){score=0;moves=25;selected=-1;busy=false;makeBoard();$("hint").textContent="Выбери камень, затем соседний, чтобы поменять их местами";render();}
  $("restart").addEventListener("click",restart);
  $("shuffle").addEventListener("click",()=>{if(busy)return;makeBoard();selected=-1;$("hint").textContent="Поле перемешано. Найди новые комбинации!";render();});
  restart();
})();