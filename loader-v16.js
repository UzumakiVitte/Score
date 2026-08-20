(function(){
  const s=document.createElement("script");
  s.src="loader-v15.js?16";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof renderGame!=="function"){
        setTimeout(waitForApp,50);
        return;
      }

      const nameMap={
        "Lavaa":"ލަވާ",
        "Dingu":"ޑިންގު",
        "Hukun kaalaa":"ހުކުން ކާލާ"
      };

      function replaceNames(root=document.body){
        if(!root) return;
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        const nodes=[];
        let node;
        while(node=walker.nextNode()) nodes.push(node);

        nodes.forEach(n=>{
          let text=n.nodeValue;
          let changed=false;
          Object.keys(nameMap).forEach(name=>{
            if(text.includes(name)){
              text=text.split(name).join(nameMap[name]);
              changed=true;
            }
          });
          if(changed) n.nodeValue=text;
        });

        root.querySelectorAll("*").forEach(el=>{
          if(/[\u0780-\u07BF]/.test(el.textContent||"")){
            el.classList.add("dhivehi-name");
          }
        });
      }

      function installDhivehiFont(){
        if(!document.querySelector("#faruma-v16-font")){
          const link=document.createElement("link");
          link.id="faruma-v16-font";
          link.rel="stylesheet";
          link.href="https://dvfonts.maldicore.com/css?family=Web_Faruma&api=1234";
          document.head.appendChild(link);
        }

        if(!document.querySelector("#dhivehi-v16-style")){
          const style=document.createElement("style");
          style.id="dhivehi-v16-style";
          style.textContent=`
            .dhivehi-name{
              font-family:"Faruma","Web Faruma",sans-serif !important;
              direction:rtl;
              unicode-bidi:plaintext;
            }
          `;
          document.head.appendChild(style);
        }
      }

      installDhivehiFont();

      const originalRenderGame=renderGame;
      renderGame=function(){
        const result=originalRenderGame.apply(this,arguments);
        setTimeout(replaceNames,0);
        return result;
      };

      if(typeof renderGames==="function"){
        const originalRenderGames=renderGames;
        renderGames=function(){
          const result=originalRenderGames.apply(this,arguments);
          setTimeout(replaceNames,0);
          return result;
        };
      }

      const observer=new MutationObserver(()=>replaceNames());
      observer.observe(document.body,{childList:true,subtree:true});

      replaceNames();
      window.__scorekeeperVersion="v16";
    };
    waitForApp();
  };
  s.onerror=function(){
    console.error("Scorekeeper v16 localization loader could not load loader-v15.js");
  };
  document.head.appendChild(s);
})();