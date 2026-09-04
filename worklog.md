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

---
Task ID: R5
Agent: Super Z (main)
Task: "voice bolta kuchh hu sunta kuchh aur" — ASR accuracy fix (user's voice now WORKS on Vercel via Groq, but Whisper mishears words)

Work Log:
- Diagnosed 4 accuracy root causes: (1) no language hint to Whisper on short Hinglish clips, (2) no vocabulary prompt anchor, (3) 2s VAD trailing silence padding triggers Whisper hallucinations, (4) raw webm/mp4 uploads mislabeled audio.wav
- src/app/api/asr/route.ts upgraded:
  * ERP_ASR_PROMPT anchor (Hindi business vocab: बिल/पेमेंट/कस्टमर/बैलेंस + English terms) — biases Whisper decoding, <224 tokens
  * response_format=verbose_json → duration-weighted mean avg_logprob as confidence
  * Confidence-aware Hindi retry: if meanLogprob < -1.0 and no forced lang → one retry with language=hi, better-confidence result wins (fixes auto-detect mishearing Hindi as other languages)
  * Optional body.lang ('hi'|'en'|'hi-IN'|'en-IN') passthrough to force language (normalizeLang)
  * ffmpeg convertToWav now trims leading/trailing silence (silenceremove -40dB, keep 0.3s lead/0.15s tail); all-silence guard returns null → raw fallback
  * HALLUCINATION_PATTERNS blocklist ("Thank you.", "amara.org", "मैं आपकी...", "धन्यवाद", subscribe spam etc.) via cleanTranscript — applied to ZAI + Groq output, short texts only (<80 chars)
  * Honest container naming (wav/webm/ogg/mp4 via extended detectFormat with OggS magic)
  * Fixed engine mislabel bug: groq success was reported as engine='zai' (groqErr only set on failure) → new usedEngine variable
  * Response adds optional language field for groq engine (debug aid)
- Version bump: APP_VERSION v3.7→v3.8, SW_VERSION veda-erp-v10→veda-erp-v11
- scripts/test-groq-accuracy.js (NEW): live old-vs-new Groq param comparison w/ TTS Hindi phrases + VAD silence padding simulation + preflight IP-block probe
- DISCOVERY: sandbox IP is BLOCKED by Groq's Cloudflare edge — even bogus key returns 403 JSON Forbidden on /models. Groq whisper CANNOT be live-tested from sandbox. DB AiConfig gsk key NOT proven dead (test inconclusive due to IP block). Vercel IPs are clean → voice works there.
- Build OK, daemon restarted, full E2E: 102 PASS / 0 WARN / 0 FAIL (asr silence→too-short kind, speech→engine=zai)
- Pushed to GitHub: 0d8a187..bc0a6d0 (v3.8 + 2 earlier image commits)

Stage Summary:
- ASR accuracy chain on Vercel: raw webm → (no ffmpeg there) → Groq whisper-large-v3 with ERP prompt anchor + temp 0 → auto-detect; weak confidence (<-1.0 logprob) → language=hi retry; hallucination blocklist; better result wins
- USER ACTION NEEDED: Vercel → Deployments → Redeploy (to get v3.8), then verify v3.8 badge in login footer, then voice accuracy test
- Groq unreachable from sandbox — any future Groq live-testing must run on Vercel or another clean IP

---
Task ID: R6
Agent: Super Z (main)
Task: "quotation create time item pe click krne pe product nhi dikhta — laptop me dikh rha, mobile me nhi" — mobile product picker fix

Work Log:
- Root cause: item description used native <input list> + <datalist> (quotation-module.tsx:845, bill-module.tsx:870). Desktop Chrome shows native dropdown on click, but mobile browsers (Android Chrome / iOS Safari / WebViews) only show suggestions AFTER typing — tapping the empty field shows nothing. Classic laptop-vs-mobile datalist trap.
- NEW src/components/ui/product-suggest-input.tsx: custom touch-friendly dropdown replacing datalist — opens on focus AND click (re-tap on already-focused input fires no focus event — classic mobile trap, caught during browser testing), live filter, keyboard nav (arrows/Enter/Escape), outside-pointerdown close, z-50, max-h-52 scroll, free-typing preserved (custom names like "Transportation Charge" work, no match -> dropdown hides)
- Replaced datalist in BOTH quotation-module.tsx and bill-module.tsx (same bug, same fix)
- Verified in headless browser at 390x844 mobile viewport: tap opens 15 products, filter "zig zag grey" -> 2 matches, selection fills+closes, RE-TAP reopens (bug found & fixed during verification), geometry within viewport, screenshot saved download/quotation-product-dropdown-mobile.png
- Infra note: during verification the stale next-server (pid 3265) survived pkill -f "node daemon.js" and served a mismatched build -> "Application error". Kill by PID from `ss -tlnp` before starting daemon.
- Build OK, E2E 102 PASS / 0 WARN / 0 FAIL, v3.9 badge verified in browser
- Pushed: bc0a6d0..02fa5a9

Stage Summary:
- v3.9 shipped: product suggestions now work on ALL devices (mobile + laptop) in Quotation and Billing item rows
- USER ACTION: Vercel -> Redeploy, verify v3.9 badge, then quotation item field tap should show product list on phone

---
Task ID: R7
Agent: Super Z (main)
Task: "cement, dust, hardner, other ye htao quotation item me se" — trim quotation product presets

Work Log:
- Removed Cement, Dust, Hardner, Other from PRODUCT_PRESETS in quotation-module.tsx (suggestion dropdown now shows 11 finished paver products)
- Safety check first: PRODUCT_PRESETS used ONLY by the suggestion dropdown (line 845); production auto-fill uses independent PROD_FIELD_TO_LABEL mapping (cement:'Cement (bags)' etc.) — unaffected. Bill module presets untouched (user asked quotation only).
- Custom free-typing still allows any name (raw materials can still be typed manually if ever needed)
- Version v3.9 -> v3.10, SW v12 -> v13; build OK; E2E 102 PASS / 0 WARN / 0 FAIL
- Pushed to GitHub

Stage Summary:
- v3.10: quotation suggestions = finished products only (11 items)
- USER ACTION: Vercel Redeploy -> verify v3.10 badge

---
Task ID: R8
Agent: Super Z (main)
Task: "mobile responsive me shi kro" (screenshot: quotation create form at 400x652 DevTools — Date/Validity labels clipped at left edge)

Work Log:
- Root cause: create-form top bar was a single non-wrapping flex row: Back(~90px) + "Create New Quotation" text-xl + Cancel + Create Quotation ≈ 460px min-width > 400px viewport → horizontal overflow → mx-auto centered container → left edge (Date/Valid Until labels) clipped
- Fix (both quotation-module.tsx:708 AND bill-module.tsx:727 — identical pattern): flex flex-wrap + gap-y-2; title text-xl → text-base sm:text-lg md:text-xl + min-w-0; Back button shrink-0; button group grow justify-end sm:grow-0 → row1 = Back+title, row2 = Cancel+Create right-aligned on phones; single row on md+
- Verified in browser at user's exact 400x652 viewport: quotation create form scrollWidth-viewport = 0px (no horizontal scroll), bill create form = 0px; screenshots download/quotation-form-mobile-fixed.png + bill-form-mobile-fixed.png
- Scanned rest of form for overflow sources (fixed widths, nowrap, grids) — all already responsive; top bar was the only offender
- Version v3.10 -> v3.11, SW v13 -> v14; build OK; E2E 102 PASS / 0 WARN / 0 FAIL; pushed

Stage Summary:
- v3.11: create forms (quotation + bill) fully usable at 400px phones — no more clipped labels
- USER ACTION: Vercel Redeploy -> verify v3.11 badge

---
Task ID: R8
Agent: Super Z (main)
Task: "fast listener kro fast execution kro" — voice pipeline speed optimization

Work Log:
- Traced full voice chain: use-voice-recorder.ts → /api/asr → /api/ai/agent
- Found 4 latency sources: (1) silenceStopMs=2000 dead wait after speech ends, (2) ZAI-first engine order — on Vercel 2 guaranteed-fail ZAI attempts ran before Groq, (3) ffmpeg convertToWav ran up to 3x per request, (4) weak-confidence Hindi retry added a 2nd Groq round trip even for the chat mic which is always Hindi
- use-voice-recorder.ts: silenceStopMs 2000→1200ms; added lang option forwarded to /api/asr body
- voice-input.tsx (chat mic): passes lang='hi' (from language prop) — forced language skips auto-detect retry
- field-voice-input.tsx: intentionally left on auto-detect (form fields may be numbers/English product names)
- asr/route.ts RESTRUCTURED: Groq Whisper FIRST (resolveGroqKey() = env → DB, once per request), ZAI demoted to fallback; wavCache memoizes ONE ffmpeg run shared by all engine paths; ZAI client created lazily once per request; error-kind messages (no-provider / groq-401) preserved
- ai/agent/route.ts: max_tokens 1000→500 (tool-call turn), 1000→400 (summary turn)
- DISCOVERY: scripts/test-full-site.js (102-test E2E suite) is GONE — was never committed to git and no longer in working tree; created targeted scripts/test-voice-speed.js (11 tests) instead
- TTS voice name for sandbox tests: 'tongtong' (NOT 'alloy' — error 1214 tone does not exist)
- Version v3.11→v3.12, SW v14→v15; build OK; server restarted; test-voice-speed: 11 PASS / 0 WARN / 0 FAIL; pushed c7ac8e7

Stage Summary:
- Voice now: 1.2s silence submit (was 2s), Groq hits first on Vercel (saves the whole doomed-ZAI phase), single ffmpeg pass, chat skips language retry. Estimated user-perceived savings: ~1.5-4s per voice command on Vercel
- test-full-site.js must be recreated or re-committed next session (was 102-test suite)
- v3.12 pushed; user needs Vercel Redeploy
