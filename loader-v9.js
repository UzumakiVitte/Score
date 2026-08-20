(async function () {
  try {
    const response = await fetch("app-v7.js?v=9", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the app code.");
    let code = await response.text();

    const authSubmit = `async function authSubmit(){
  const u=$("#authUsername").value.trim().toLowerCase(), p=$("#authPassword").value;
  if(!/^[a-z0-9_]{3,24}$/.test(u)){ $("#authMessage").textContent="Use 3 to 24 letters, numbers, or underscores."; return; }
  if(p.length<6){ $("#authMessage").textContent="Password must be at least 6 characters."; return; }
  const email=usernameEmail(u);
  const action=$("#authAction"), message=$("#authMessage");
  action.disabled=true;
  message.textContent="Please wait…";
  try {
    let result;
    if(window.authSignup){
      const { data: existingProfile, error: profileError } = await runWithTimeout(
        sb.from("profiles").select("id").eq("username", u).maybeSingle(), 10000,
        "The database took too long to respond. Please try again."
      );
      if(profileError && !/row|permission|policy/i.test(profileError.message || "")) throw profileError;
      if(existingProfile) throw new Error("That username is already in use.");
      result=await runWithTimeout(
        sb.auth.signUp({email,password:p,options:{data:{username:u}}}), 15000,
        "Account creation timed out. Please try again."
      );
    } else {
      result=await runWithTimeout(
        sb.auth.signInWithPassword({email,password:p}), 15000,
        "Login timed out. Please try again."
      );
    }
    if(result.error) throw result.error;
    if(!result.data.session){
      if(window.authSignup) message.textContent="Account created. Please check your email to confirm the account.";
      else throw new Error("Login succeeded, but Supabase did not return a session.");
      return;
    }

    state.session = result.data.session;
    await runWithTimeout(
      ensureProfile(u || state.session.user.user_metadata?.username), 10000,
      "Your account loaded, but the profile request timed out."
    );
    await runWithTimeout(
      loadAll(), 15000,
      "Login succeeded, but loading your games timed out."
    );
  } catch(err) {
    console.error("Authentication error", err);
    state.session=null;
    message.textContent=err?.message || "Unable to sign in. Please try again.";
  } finally {
    action.disabled=false;
    if(state.session && !message.textContent.includes("timed out")) message.textContent="";
  }
}`;

    const bootAuth = `async function bootAuth(){
  try {
    sb.auth.onAuthStateChange((_event,session)=>{
      state.session=session;
      if(!session){
        state.profile=null; state.games=[]; state.completedGames=[]; state.players=[];
        renderAuth();
      }
    });

    const {data,error}=await runWithTimeout(
      sb.auth.getSession(), 10000,
      "The login service took too long to respond. Please refresh and try again."
    );
    if(error) throw error;

    state.session=data.session;
    if(state.session){
      await ensureProfile(state.session.user.user_metadata?.username);
      await runWithTimeout(
        loadAll(), 15000,
        "Your account loaded, but your games could not be loaded in time."
      );
    } else {
      renderAuth();
    }
  } catch(err) {
    console.error("Boot auth error", err);
    state.session=null;
    renderAuth();
    $("#authMessage").textContent=err?.message || "Unable to connect to the account service.";
  }
}`;

    const createGame = `async function createGame() {
  const name = $("#gameName").value.trim() || "Card Game";
  const selected = [...document.querySelectorAll("#playerChoices input:checked")].map(x => x.value);
  if (!selected.length) { toast("Choose at least one player"); return; }

  const createButton = document.querySelector("#modalRoot .btn.primary:last-child");
  if (createButton) { createButton.disabled=true; createButton.textContent="Creating…"; }

  try {
    if (!state.session?.user?.id) throw new Error("Your login session is not ready. Please log in again.");
    const ownerId = state.session.user.id;

    const { data: g, error } = await runWithTimeout(
      sb.from("games")
        .insert({ name, sort_mode: "custom", owner_id: ownerId })
        .select("id,name,round,status,sort_mode,owner_id")
        .single(),
      12000,
      "Creating the game timed out. Please try again."
    );
    if (error) throw error;
    if (!g?.id) throw new Error("The game was created without an ID. Please try again.");

    const rows = selected.map((pid, i) => ({
      game_id: g.id, player_id: pid, score: 0, player_order: i, owner_id: ownerId
    }));

    const { error: e } = await runWithTimeout(
      sb.from("game_players").insert(rows), 12000,
      "The game was created, but adding its players timed out."
    );
    if (e) {
      await sb.from("games").delete().eq("id", g.id);
      throw e;
    }

    closeModal();
    await runWithTimeout(loadAll(), 15000, "Game created, but refreshing your games timed out.");
    await runWithTimeout(openGame(g.id), 15000, "Game created, but opening it timed out.");
  } catch(err) {
    console.error("Create game error", err);
    toast(err?.message || "Could not create game");
    if (createButton) { createButton.disabled=false; createButton.textContent="Create Game"; }
  }
}`;

    code = code.replace(/async function authSubmit\(\)\{[\s\S]*?\n\}\n\nasync function ensureProfile/, authSubmit + "\n\nasync function ensureProfile");
    code = code.replace(/async function bootAuth\(\)\{[\s\S]*?\n\}\n\nasync function logout/, bootAuth + "\n\nasync function logout");
    code = code.replace(/async function createGame\(\)\{[\s\S]*?\n\}\n\nasync function openGame/, createGame + "\n\nasync function openGame");
    code = code.replace(/\nbootAuth\(\);\s*$/, "");

    const script = document.createElement("script");
    script.textContent = code + "\nwindow.__scorekeeperVersion='v9';\nbootAuth();";
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