(() => {
 const $=id=>document.getElementById(id), tg=window.Telegram?.WebApp;
 try{tg?.ready();tg?.expand();}catch(_){}
 const api=window.JJ_API_BASE||"";
 async function load(){
   if(!api){$("status").textContent="API ещё не настроен. Сначала разверните backend и укажите его адрес в config.js.";return;}
   if(!tg?.initData){$("status").textContent="Откройте эту страницу внутри Telegram Mini App. В браузере Telegram initData недоступен.";return;}
   $("status").textContent="Проверяем права владельца…";
   try{
     const r=await fetch(api.replace(/\/$/,"")+"/api/admin/stats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({initData:tg.initData})});
     if(r.status===403)throw new Error("Доступ запрещён: этот Telegram-аккаунт не является владельцем.");
     if(r.status===401)throw new Error("Не удалось проверить Telegram. Откройте панель через Mini App.");
     if(!r.ok)throw new Error("Ошибка API: "+r.status);
     const d=await r.json();
     $("total").textContent=d.total_players;$("today").textContent=d.unique_today;$("online").textContent=d.online_5m;$("launches").textContent=d.launches_today;$("returning").textContent=d.returning_players;$("health").textContent="OK";
     $("recent").innerHTML="";
     if(!d.recent_players.length){$("recent").textContent="Пока нет игроков.";}
     else{const ul=document.createElement("div");ul.style.textAlign="left";d.recent_players.forEach(p=>{const row=document.createElement("p");row.textContent=(p.first_name||"Игрок")+(p.username?" (@"+p.username+")":"")+" · запусков: "+p.launches;ul.appendChild(row);});$("recent").appendChild(ul);}
     $("status").textContent="Статистика обновлена. Проверка доступа выполнена сервером.";
   }catch(e){$("status").textContent=e.message;$("health").textContent="—";}
 }
 $("refresh").addEventListener("click",load);load();setInterval(load,60000);
})();