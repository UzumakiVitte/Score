(function(){
  const s=document.createElement("script");
  s.src="loader-v19-game-icons.js?22";
  s.onload=function(){
    const wait=()=>{
      if(typeof state==="undefined" || typeof render!=="function"){
        setTimeout(wait,50); return;
      }

      const originalAvatar=window.avatar;
      window.avatar=function(p){
        const value=String(p?.avatar_url||"");
        if(/^avatar:\d{1,2}$/.test(value)){
          const n=String(parseInt(value.slice(7),10)).padStart(2,"0");
          return `<img class="avatar avatar-character" src="icons/avatars/avatar-${n}.svg" alt="">`;
        }
        if(value.startsWith("emoji:")){
          return `<div class="avatar">${esc((p?.name||"?").slice(0,1).toUpperCase())}</div>`;
        }
        return originalAvatar ? originalAvatar(p) : `<div class="avatar">${esc((p?.name||"?").slice(0,1).toUpperCase())}</div>`;
      };

      const avatarChoices=Array.from({length:25},(_,i)=>i+1);

      window.choosePlayerAvatar=function(n){
        playerAvatarDraft="avatar:"+String(n);
        const name=$("#playerName")?.value||"Player";
        $("#playerPreview").innerHTML=window.avatar({name,avatar_url:playerAvatarDraft});
        document.querySelectorAll(".character-choice").forEach(b=>{
          b.classList.toggle("selected",b.dataset.avatar===String(n));
        });
      };

      window.showPlayerEditor=function(existing){
        const p=existing||null;
        playerAvatarDraft=p?.avatar_url||"";
        const selected=/^avatar:\d{1,2}$/.test(playerAvatarDraft)
          ? String(parseInt(playerAvatarDraft.slice(7),10))
          : "";

        showModal(`
          <h2>${p?"Edit Player":"Add Player"}</h2>
          <div class="player-preview" id="playerPreview">${window.avatar(p||{name:"Player",avatar_url:playerAvatarDraft})}</div>
          <input id="playerName" class="input" placeholder="Player name" value="${esc(p?.name||"")}">
          <div class="avatar-section-title">Choose character</div>
          <div class="character-grid">
            ${avatarChoices.map(n=>`
              <button type="button" class="character-choice ${selected===String(n)?"selected":""}" data-avatar="${n}" onclick="choosePlayerAvatar(${n})">
                <img src="icons/avatars/avatar-${String(n).padStart(2,"0")}.svg" alt="Character ${n}">
              </button>`).join("")}
          </div>
          <div class="avatar-section-title">Or use your own picture</div>
          <label class="btn avatar-upload"><span>Choose picture</span><input id="playerPhoto" type="file" accept="image/*" onchange="handleAvatarFile(this)"></label>
          <div class="actions" style="margin-top:16px">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn primary" onclick="savePlayer(${p?`'${p.id}'`:"null"})">${p?"Save changes":"Add Player"}</button>
          </div>
        `);
      };

      const style=document.createElement("style");
      style.id="scorekeeper-avatar-nav-v22";
      style.textContent=`
        [data-theme="dark"]{
          --accent:#78a9e8;
          --muted:#8fa4c3;
          --text:#eef4fb;
          --line:#243650;
        }
        [data-theme="dark"] .eyebrow{color:#4e88ed}
        .avatar-character{
          object-fit:cover!important;
          display:block!important;
          overflow:hidden!important;
          background:var(--accent2)!important;
        }
        .character-grid{
          display:grid;
          grid-template-columns:repeat(5,1fr);
          gap:9px;
          max-height:360px;
          overflow:auto;
          padding:2px;
        }
        .character-choice{
          border:1px solid var(--line);
          background:var(--surface2);
          border-radius:15px;
          padding:3px;
          aspect-ratio:1;
          overflow:hidden;
          transition:transform .12s ease,border-color .12s ease;
        }
        .character-choice img{
          width:100%;
          height:100%;
          display:block;
          object-fit:cover;
          border-radius:11px;
        }
        .character-choice.selected{
          border:2px solid var(--accent);
          box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 18%,transparent);
          transform:scale(1.02);
        }
        .bottom-nav{
          padding:8px 8px calc(8px + env(safe-area-inset-bottom));
          background:color-mix(in srgb,var(--surface) 97%, transparent);
        }
        .nav-item{
          min-height:68px;
          gap:5px;
          color:#8fa4c3;
        }
        .nav-item.active{color:#4e88ed}
        .nav-item b{font-size:15px;font-weight:700}
        .nav-icon{width:27px;height:27px;display:grid;place-items:center}
        .nav-icon svg{
          width:27px;height:27px;
          fill:none;
          stroke:currentColor;
          stroke-width:1.8;
          stroke-linecap:round;
          stroke-linejoin:round;
        }
        .nav-item.active .nav-icon svg{stroke-width:2.2}
        @media(max-width:430px){
          .character-grid{gap:7px}
          .character-choice{border-radius:13px}
        }
      `;
      document.head.appendChild(style);

      if(typeof render==="function"){
        const oldRender=render;
        render=function(){
          const r=oldRender.apply(this,arguments);
          setTimeout(()=>document.documentElement.dataset.theme=state.theme,0);
          return r;
        };
      }

      window.__scorekeeperVersion="v22-avatars-nav";
    };
    wait();
  };
  s.onerror=function(){console.error("Could not load loader-v19-game-icons.js");};
  document.head.appendChild(s);
})();