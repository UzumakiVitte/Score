(function(){
  const wait=()=>{
    if(typeof state==='undefined'||typeof renderSettings!=='function'||typeof sb==='undefined'){
      setTimeout(wait,100); return;
    }
    async function isAdmin(){ return state.profile?.is_admin===true; }

    async function loadAdminUsers(){
      const {data,error}=await sb.from('profiles').select('id,username,created_at,is_admin').order('created_at',{ascending:false});
      if(error){ toast(error.message); return; }
      const users=data||[], root=document.querySelector('#adminUsers');
      if(!root) return;
      root.innerHTML=users.map(u=>{
        const self=state.session&&u.id===state.session.user.id;
        const date=u.created_at?new Date(u.created_at).toLocaleDateString():'';
        return `<div class="admin-user-row">
          <div class="admin-user-avatar">${esc((u.username||'?').slice(0,1).toUpperCase())}</div>
          <div class="admin-user-info"><b>${esc(u.username||'Unknown')}</b><small>Joined ${esc(date)}${self?' · You':''}</small></div>
          <button class="admin-role ${u.is_admin?'on':''}" ${self?'disabled':''} onclick="toggleAdminUser('${u.id}',${u.is_admin?'false':'true'})">${u.is_admin?'Admin':'User'}</button>
        </div>`;
      }).join('') || '<p class="admin-empty">No registered users.</p>';
      const count=document.querySelector('#adminUserCount');
      if(count) count.textContent=users.length+' registered user'+(users.length===1?'':'s');
    }

    window.toggleAdminUser=async function(id,value){
      if(!(await isAdmin())) return toast('Admin access required.');
      const {error}=await sb.from('profiles').update({is_admin:value}).eq('id',id);
      if(error) return toast(error.message);
      toast(value?'Admin access granted':'Admin access removed');
      loadAdminUsers();
    };

    window.openAdminPanel=async function(){
      if(!(await isAdmin())) return toast('Admin access required.');
      showModal(`<div class="admin-modal">
        <div class="row"><div><h2>User Management</h2><p id="adminUserCount" class="admin-subtitle">Loading...</p></div><button class="icon-btn" onclick="closeModal()">×</button></div>
        <div id="adminUsers" class="admin-users"></div>
      </div>`);
      loadAdminUsers();
    };

    const original=renderSettings;
    renderSettings=function(){
      const result=original.apply(this,arguments);
      setTimeout(async()=>{
        if(!(await isAdmin())) return;
        const content=document.querySelector('#content');
        if(!content||content.querySelector('#adminSettingsCard')) return;
        const card=document.createElement('div');
        card.id='adminSettingsCard';
        card.className='stack';
        card.innerHTML=`<div class="section-title">Administration</div>
          <button class="card admin-settings-card" onclick="openAdminPanel()">
            <span class="admin-shield">♟</span>
            <span><b>User management</b><small>View registered users and manage admin access</small></span>
            <span class="preset-arrow">›</span>
          </button>`;
        content.appendChild(card);
      },0);
      return result;
    };

    const style=document.createElement('style');
    style.textContent=`
      .admin-settings-card{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left;padding:15px 16px!important}
      .admin-shield{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:rgba(78,136,237,.12);color:#4e88ed;font-size:22px}
      .admin-settings-card b,.admin-settings-card small{display:block}.admin-settings-card small{margin-top:3px;color:#8fa4c3}
      .admin-modal{max-height:75vh;overflow:auto}.admin-subtitle{margin:2px 0 0;color:#8fa4c3;font-size:13px}
      .admin-users{margin-top:18px;display:grid;gap:9px}
      .admin-user-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--surface2)}
      .admin-user-avatar{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(78,136,237,.12);color:#78a9e8;font-weight:800;font-size:18px}
      .admin-user-info{min-width:0}.admin-user-info b,.admin-user-info small{display:block}.admin-user-info small{color:#8fa4c3;margin-top:3px;font-size:12px}
      .admin-role{border:1px solid var(--line);border-radius:999px;padding:7px 11px;background:transparent;color:#8fa4c3;font-weight:700}
      .admin-role.on{color:#4e88ed;border-color:#4e88ed;background:rgba(78,136,237,.1)}.admin-role:disabled{opacity:.55}
      .admin-empty{color:#8fa4c3;text-align:center;padding:25px}
    `;
    document.head.appendChild(style);
    window.__scorekeeperVersion='v23-admin';
  };
  wait();
})();