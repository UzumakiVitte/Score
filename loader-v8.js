(async function () {
  try {
    const response = await fetch("app-v7.js?loader=8", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the app code.");
    let code = await response.text();

    code = code.replace(
      '    await wait(150);\n    await getFreshSession();',
      '    state.session = result.data.session;\n    if (!state.session?.user?.id) throw new Error("Login succeeded, but no session was returned.");'
    );

    code = code.replace(
      'const session = await runWithTimeout(getFreshSession(), 8000,\n      "Your login session is not ready. Please log in again.");',
      'const session = state.session?.user?.id ? state.session : await runWithTimeout(getFreshSession(), 8000,\n      "Your login session is not ready. Please log in again.");'
    );

    code = code.replace(
      '      await wait(100);\n      await getFreshSession();',
      '      state.session = data.session;'
    );

    code = code.replace(
      '    sb.auth.onAuthStateChange((_event,session)=>{\n      state.session=session;\n      if(!session){',
      '    sb.auth.onAuthStateChange((event,session)=>{\n      state.session=session;\n      if(event==="SIGNED_OUT" || !session){'
    );

    code = code.replace(/\nbootAuth\(\);\s*$/, '');

    const script = document.createElement("script");
    script.textContent = code + '\nwindow.__scorekeeperBooted = true;\nbootAuth();';
    document.head.appendChild(script);
  } catch (err) {
    console.error("Scorekeeper loader error", err);
    const msg = document.querySelector("#toast");
    if (msg) {
      msg.textContent = err.message || "Unable to load Scorekeeper.";
      msg.classList.add("show");
    }
  }
})();