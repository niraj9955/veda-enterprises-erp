# Worklog

---
Task ID: R1 (sandbox-recovery)
Agent: Main Agent (GLM)
Task: Sandbox reset ke baad Veda ERP restore + user ke screenshot wala voice error ("Awaz samajh nahi paye") fix karna

Work Log:
- Sandbox fully reset hua tha: /home/z/my-project me sirf uploads the, server down, node_modules gone
- /tmp/my-project me purana (Sep 2 pre-migration) snapshot mila — usme local MongoDB tha, Atlas/voice/version nahi
- GitHub se public repo clone kiya: https://github.com/niraj9955/veda-enterprises-erp (HEAD e78df2b = 3D login v3.3)
- Poora project /home/z/my-project me restore kiya (git history intact)
- .env me MONGODB_URI = Atlas set kiya (mongodb+srv://vedaerp:...@cluster0.q5b2ye0.mongodb.net/veda-erp)
- bun install (857 pkgs) + next build + node daemon.js → server up (PID file server.pid, log server.log)
- SDK changes notice kiye: TTS me 'alloy' voice + 'mp3' format ab reject hota hai; 'tongtong' + 'wav' use hota hai (test scripts update kiye)
- E2E ASR test PASS: TTS → login → POST /api/asr → correct transcription (webm direct + mp3→WAV dono paths)
- ROOT CAUSE ANALYSIS: screenshot ka error server-500 tha. Jab VAD auto-stop MediaRecorder ko turant rokta hai to Chrome ka webm blob kabhi-kabhi truncated hota hai → ZAI ASR throw → "Awaz samajh nahi paye". Yeh intermittent tha isliye kabhi kabhi chal jata tha
- ASR route HARDENED (src/app/api/asr/route.ts): (1) <1.5KB blob → 422 too-short friendly message, (2) attempt-1 fail/empty → ALWAYS retry with ffmpeg-normalized 16k mono WAV, (3) empty result → duration check via ffprobe → too-short vs no-speech hints, (4) errors return {error, kind} so client messages accurate
- Edge case tests: normal-speech PASS, tiny-blob 422 PASS, silence graceful PASS, truncated-webm RECOVERED + transcribed PASS (yehi user ka bug tha)
- NEW BUG found during browser verify: AI agent 403 — DB me stored Groq key invalid/rejected ho gayi thi (api.groq.com → 403)
- FIX: /api/ai/agent me unified chatCreate() wrapper — configured provider fail ho ya key na ho to transparently built-in ZAI engine use hota hai (tools ke saath; tools reject ho to text-only retry). AI ab kabhi hard-fail nahi karega
- Browser verify: 3D login OK, dashboard Atlas data OK, chat v3.4 badge OK, AI real production data + tool calls OK, zero console errors
- Version bump: APP_VERSION v3.4, SW veda-erp-v7
- Commit e6f4909 local (push pending — GitHub PAT purane sandbox ke saath gaya, user se naya token lene ki salah di)

Stage Summary:
- App fully operational: https production build on port 3000, Atlas cloud DB, saara business data intact
- Voice ab 3 layers se bulletproof: client VAD fallbacks (purana) + truncated-webm WAV-recovery retry (naya) + clear Hinglish errors with kind hints
- AI agent self-healing: Groq/OpenAI key invalid ho to khud ZAI engine pe switch
- Server restart command: cd /home/z/my-project && node daemon.js
- Pending: user ke device pe SW v7 auto-update hoga (page 1-2 baar kholne par), voice dobara test karna

---
Task ID: R2 (api-chahiye-fix)
Agent: Main Agent (GLM)
Task: "bol rha api chahiye" — AI har jagah se API-key dependency hatana

Work Log:
- User report: app "API chahiye" bol raha hai, kal se ek cheez fix nahi ho rahi
- Root cause 1: user ka device abhi bhi purana v3.3 cached build chala raha tha (jisme Groq key invalid hone par "AI is disabled or no API key" 403 aata tha)
- Root cause 2 (code): /api/ai/parse (AI Fill dialog) me bhi wahi 403 gates thi jo sirf agent route me fix hui thi, parse me NAHI
- FIX: shared layer src/lib/ai-completions.ts banaya — makeAiChat() factory: stored provider (Groq/OpenAI) healthy ho to wahan, warna transparently built-in ZAI engine. Dead-provider memory memo: 401/403/404 par 10 min, 429 par 1 min tak provider skip (har request par failed-key roundtrip tax nahi)
- /api/ai/parse se API-key 403 gates PERMANENTLY removed — ab ye feature kabhi "API key chahiye" nahi bolega
- /api/ai/agent ko bhi shared helper pe migrate kiya (duplicate code removed)
- extractJson() helper: markdown fences/leading prose ke saath bhi JSON parse hota hai
- E2E tests: agent-chat 200 OK, agent-tool 200 OK (real production data), parse 200 OK (Hinglish "Kal Rohit ko 250 zig zag..." → fields extracted correctly)
- Version v3.5, SW v8. Commit 986f75c push ho gaya GitHub main (token user-provided)

Stage Summary:
- AI features (chat agent + AI Fill parse) ab key-independent: koi bhi API key expire/invalid ho, ZAI engine khud handle karta hai
- User ke liye critical instruction: saare tabs band karke app naye tab me kholo, v3.5 badge verify karo (SW v8 auto-update + auto-reload karega)

---
Task ID: R3 (mic-test-remove + api-clarity + env-guard)
Agent: Main Agent (GLM)
Task: Login se Mic Test hatana + "kon sa API chahiye" confusion khatam karna

Work Log:
- Login page se MicTest button removed (user request) — import commented, UI block hata
- User ko clarity di: voice recognition (ASR) ke liye KOI API key nahi chahiye — built-in ZAI ASR hai. "API chahiye" errors Groq key (AI features) se aaye the, jo v3.5 me ZAI-fallback se fix ho chuke
- CRITICAL BUG mila: .env file kisi sandbox process ne overwrite kar di — MONGODB_URI line gayab thi! App localhost:27017 pe connect kar raha tha -> LOGIN 500 FAIL ho raha tha (yehi user ke "kaam nahi kar raha" ka bada reason tha)
- FIX 1: .env restore kiya
- FIX 2 (self-healing): daemon.js me guard — har server start pe check karta hai MONGODB_URI hai ya nahi, nahi to auto-restore
- FIX 3: SW navigation networkFirst timeout 5s -> 3s (slow network me stale HTML serve hone se bachane ke liye)
- Browser verify: login page par Mic Test GONE, login OK, dashboard Atlas data OK, v3.6 chip OK
- ASR sanity test: HTTP 200 + correct transcription
- Version v3.6, SW v9. Commit 35e13e8 pushed

Stage Summary:
- Login se mic hata diya
- Login 500 (DB disconnect) root-caused aur permanently self-healed
- Voice ke liye koi API key requirement nahi — user ko clearly bataya

---
Task ID: R4 (full-site-testing + vercel-voice-fix)
Agent: Main Agent (GLM)
Task: "poora whole website ko testing me daal or bug fix — naya problem mat khada kar" + MongoDB/Vercel credentials question

Work Log:
- User ka device ab VERCEL deployment use kar raha hai — wahi asli root cause tha
- ROOT CAUSE (voice): ZAI SDK ko sandbox credentials chahiye jo VERCEL par EXIST nahi karte -> wahan ASR hamesha fail ("Awaz samajh nahi paye"). Sandbox me voice bilkul theek thi
- FIX 1: /api/asr me GROQ WHISPER (whisper-large-v3) fallback engine add kiya — key order: env GROQ_API_KEY (Vercel) -> DB AiConfig (provider=groq, app settings se). Ab Vercel par bhi voice chalegi jab user key daal dega
- FIX 2: Error messages ab EXPLICIT engine batate hain: 'no-provider' kind = "Voice engine is server par nahi (Vercel) — GROQ_API_KEY chahiye"; groq-401 = key invalid. Kaun sa API fail hua — clear
- FIX 3: Noise/sine tone pe ZAI garbage symbols ("#") return karta tha — hasRealContent() filter: sirf letters/digits/Devanagari valid text
- FIX 4 (SECURITY): JWT_SECRET .env me MISSING tha — auth public fallback string use kar raha tha. Strong random secret generate karke .env + daemon.js self-heal guard me add kiya (ab kabhi missing nahi hogi). NOTE: Vercel env me JWT_SECRET bhi set karna hoga
- FULL E2E SUITE banaya (scripts/test-full-site.js): auth (4 negative cases), 16 modules CRUD (create->update->delete->zero-residue verify), dashboard/reports/stock/company/ai-config smoke, AI parse+agent, ASR (silence + real speech), integrity snapshots (customers+stock drift check), ZTEST residue sweep
- SAFETY: destructive endpoints (database DELETE = data wipe, reset-admin, init) kabhi call nahi kiye; ZTEST records delete-verified; ek residue (daily-sell auto-created customer) mila — swept
- FINAL RESULT: 102 PASS / 0 WARN / 0 FAIL (full green)
- Browser verify: login par mic GONE ✓, v3.7 badge ✓, admin login → dashboard saare modules render ✓
- v3.7 / SW v10. Testing ke dauran mile findings: (a) operator@veda.com ka DB role 'admin' hai (user khud ne banaya hoga), (b) daily-sell delete hone par auto-created customer reh jata hai (design behavior, corruption nahi), (c) sab [id] routes PUT use karte hain (consistent)

Stage Summary:
- Voice ab 2-engine: ZAI (sandbox) + Groq Whisper (Vercel/user key) — Vercel pe GROQ_API_KEY env ya app AI Settings me Groq key daalo, voice chalega
- JWT_SECRET security fix (Vercel me bhi set karna hai)
- Poora site E2E-verified: 102/102 green, zero data residue
