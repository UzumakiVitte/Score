(function(){
  const VERSION="20260821-2";
  const KEY="scorekeeper_asset_version";

  async function clearOldCaches(){
    try {
      const previous=localStorage.getItem(KEY);
      if(previous && previous!==VERSION){
        if("caches" in window){
          const keys=await caches.keys();
          await Promise.all(keys.map(k=>caches.delete(k)));
        }
      }
      localStorage.setItem(KEY,VERSION);
    } catch(e) {}
  }

  function addMeta(){
    let m=document.querySelector('meta[name="scorekeeper-version"]');
    if(!m){
      m=document.createElement("meta");
      m.name="scorekeeper-version";
      document.head.appendChild(m);
    }
    m.content=VERSION;
  }

  clearOldCaches();
  addMeta();

  // Make the app refresh itself once after a version change.
  try {
    const shown=localStorage.getItem("scorekeeper_version_loaded");
    if(shown!==VERSION){
      localStorage.setItem("scorekeeper_version_loaded",VERSION);
      setTimeout(()=>location.reload(),150);
    }
  } catch(e) {}
})();
