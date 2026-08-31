# Food Lens — demo runbook

One product, two doors onto the same lens. Since spec 26 both run the same engine
(`useFoodLensEngine`) inside the same experience (`FoodLensExperience`); everything that
differs between them is a capability the door hands in, never a check on the URL.

| Door | URL | Who it is for |
|---|---|---|
| Personal | `/food` | A patient inside the app. Their store, their plate, their day totals, their meal log. |
| Public | `/food/demo` | Anyone with the link. Stateless, store-free, no text box — the page to send outside the project. `/compass` permanently redirects here, so links already shared keep working. |

`scripts/check-public-door-store-free.mjs` proves the second row at build time: if any import
path from the public door ever reaches the patient store, `npm run check` fails and prints
the chain.

---

## The personal door (`/food`)

Camera + voice dietary feedback. Point the phone at a food, ask by voice, get
personalized spoken guidance grounded in the patient's care plan, medications,
and readings. This is a proof-of-concept demo. The voice safety gate is active,
and the Food controls disclose the current AI data path before and during use.

Demo device: **Android Galaxy S25, Chrome.** iOS is out of scope.

---

### One-time setup

1. Create `.env.local` in the project root:

   ```
   HEALTH_AI_PROVIDER=openai
   HEALTH_AI_API_KEY=sk-...            # OpenAI key with Realtime access
   HEALTH_AI_REALTIME_MODEL=gpt-realtime-2
   USDA_FDC_API_KEY=DEMO_KEY           # optional; only for non-seeded barcodes
   ```

   Leave `HEALTH_AI_PROVIDER=mock` (or omit the key) to run the typed
   on-device fallback with no OpenAI account. In live mode, microphone audio,
   a current camera frame, and relevant food and care-plan context are sent to
   OpenAI while the session is active; the final transcript and answer are saved
   in the browser-stored demo record.

2. Buy the three staged products and confirm each barcode matches
   `src/domain/food-seed.ts` (scan them at world.openfoodfacts.org if unsure).
   The seed guarantees the demo works with zero network for these three.

### Run it on the phone

`getUserMedia` needs a secure context (HTTPS). Two tunnel-free ways to get one —
no `cloudflared`, `ngrok`, or any other external tunnel (those create an
externally-routable ingress into the workstation and are not used here):

**Primary — the hosted build (recommended).** Open the Vercel URL on the S25 in
Chrome:

- `https://patient-centered.vercel.app/food` — live voice, no passcode needed.

**Superseded 2026-08-19.** This page used to read: live voice requires
`HEALTH_AI_PROVIDER=openai`, `HEALTH_AI_API_KEY` *and* `DEMO_PASSCODE`, with `?k=…` in the
URL and the secret rotated after each demo. `DEMO_PASSCODE` has since been removed from the
production environment, so live voice needs only the provider and the key, `?k=…` is
ignored, and there is no demo secret left to leak or rotate. The spend cap now lives in the
OpenAI dashboard instead — see the One Good Choice section at the end of this file.

Real HTTPS (camera works, no cert warning), served over the phone's own cellular
so venue Wi-Fi filtering is irrelevant. When a reviewed release is ready, deploy
only from a clean, reviewed tree with `vercel --prod --archive=tgz`.

**Fallback — phone hotspot + local HTTPS** (local-only; no external hosting):

```
npm run dev:https      # next dev --experimental-https (self-signed mkcert cert)
```

Mock / typed mode and the three seeded lookups can work without Internet. Live
OpenAI / WebRTC requires network access, and browser speech recognition may also
use a network service.

1. Phone: turn on Personal Hotspot; the laptop joins the phone's hotspot.
2. Laptop: `ipconfig` → Wi-Fi IPv4 (Android ≈ 192.168.x.x, iPhone ≈ 172.20.10.x).
3. Phone Chrome: `https://<laptop-hotspot-ip>:3000/food` → **Advanced → Proceed**
   past the self-signed cert warning → grant camera + mic. If Next.js blocks the
   dev origin, add the laptop hostname/IP only (no scheme or port) to
   `allowedDevOrigins` in `next.config.mjs` for the session, for example
   `allowedDevOrigins: ["192.168.x.x"]`. Use the specific LAN IP — never a tunnel
   host — and remove that temporary entry immediately after the demo.

Temporarily allow inbound TCP 3000 through Windows Firewall so the phone can
reach the laptop. In elevated PowerShell, first confirm the active hotspot
connection is the intended private profile, then replace `<PHONE_IP_OR_SUBNET>`
with the phone's actual IP or the smallest hotspot subnet that works:

```
Get-NetConnectionProfile
New-NetFirewallRule -DisplayName "Next dev phone demo" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private -RemoteAddress <PHONE_IP_OR_SUBNET>
Get-NetFirewallRule -DisplayName "Next dev phone demo" | Get-NetFirewallPortFilter
Get-NetFirewallRule -DisplayName "Next dev phone demo" | Get-NetFirewallAddressFilter
```

Grant camera + microphone the first time you press **Start**. This sidesteps
venue Wi-Fi entirely because you never join the venue network.

Before pressing **Start**, verify the AI data-use box is visible. After the
transport resolves, it must change to either on-device mode or live voice mode.
Privacy shows the same configured data path without minting a voice secret.

Immediately after the demo, remove the temporary firewall rule in elevated
PowerShell and remove any temporary `allowedDevOrigins` entry:

```
Remove-NetFirewallRule -DisplayName "Next dev phone demo"
```

### Seed the patient

Privacy → **Reset demo**. This seeds Jordan Taylor, Lisinopril 10 mg, three
rising morning readings (132/84 → 141/88 → 149/94, all below the 160/100 call
threshold), and an empty meal log.

### Staged products

| Product | Barcode | Beat |
|---|---|---|
| Campbell's Condensed Chicken Noodle Soup | `051000012616` | Sodium 890 mg → 59% of the daily target + rising readings |
| Morton Lite Salt | `024600017008` | Salt substitute → ACE-inhibitor (lisinopril) caution |
| Quaker Old Fashioned Oats | `030000010204` | Low sodium, high fiber → positive beat |

### Script

1. **Sodium + personalization** — point at the soup; the barcode chip, facts
   card, and a red sodium flag appear. Ask "Can I have this for lunch?" The
   spoken answer cites 890 mg, the 1,500 mg target, and the rising readings.
   Follow up "What's a better pick?" → a generic same-category swap. Tap
   **Log this** → it appears under Recent meals.
2. **Med-diet moment** — point at Lite Salt; ask "Is this healthier than
   regular salt?" The answer flags potassium and lisinopril and says to check
   with the care team.
3. **Spanish moment** — point at the oats; ask "¿Puedo comer esto en el
   desayuno?" The reply comes back in Spanish (the model mirrors the speaker —
   no settings change).
4. **Barge-in** — ask a broad question ("Tell me everything about this label"),
   then interrupt mid-answer with "Shorter, please." The model stops instantly
   and gives the short version.
5. **Close the loop** — show Recent meals on Food, the transcript on Coach, and
   the audit trail on Privacy.

### Contingencies

- WebRTC blocked → phone hotspot.
- Total network loss / no key → the page shows a typed **fallback** with the
  same flags and logging (seeded lookups are local).
- Session error mid-demo → **Try again** re-mints the token and reconnects;
  transcripts are already saved.

### Package-label prototype (local evaluation only)

Package scanning is implemented but deliberately disabled in production. To exercise it
against fictional/test packaging on a local reviewed build, add all of the following:

```
NEXT_PUBLIC_FOOD_PACKAGE_SCAN=1
FOOD_PACKAGE_SCAN_ENABLED=1
FOOD_PACKAGE_SESSION_SECRET=<at least 32 random bytes>
DEMO_PASSCODE=<local invite>
HEALTH_AI_PROVIDER=openai
HEALTH_AI_API_KEY=<local evaluation key>
HEALTH_AI_PACKAGE_MODEL=gpt-5.6-luna
```

The flow is confirmation-first: the low-detail camera proposes a food without showing a
score; a barcode proposes a database product without showing a score; and a package-front
photo proposes only brand/product/flavor. Nutrition Facts is captured separately, every
score-changing row is read back, and a label-derived score appears only after identity and
nutrition are both confirmed. A package-front name is never sent into fuzzy FNDDS matching.

Run `npm run eval:package-label -- --self-test` for the harness check. A release evaluation
requires a private, adjudicated image manifest copied from
`docs/qa/package-label-eval/manifest.example.json` and
`npm run eval:package-label -- --manifest <private manifest> --release`. Images and the
local manifest are gitignored; its reviewed opaque corpus ID is copied into each report, while
generated reports contain neither images, image-source or manifest hashes, nor OCR text. Release mode rejects `--base-url`, validates that the corpus can satisfy every structural
gate, builds this checkout into an isolated ignored directory, starts that exact attested build
on loopback, verifies its artifact ID before and after the run, and confirms shutdown before
removing it and publishing PASS. A session-renewal failure aborts the run rather than turning
into a retryable case result.

The flags must remain off in production even after a local quality run: the current rate and
concurrency controls are process-local and cannot enforce one deployment-wide spend ceiling.
Production also requires the adjudicated corpus and legal, privacy, clinical, regulatory, and
provider approvals described in spec 28.

---

### What cannot be automated — verify on the real S25

Camera start latency and orientation; native barcode speed and low-light
behavior on real packaging; WebRTC over Wi-Fi and 5G; server-VAD turn-taking
feel and barge-in latency; echo cancellation on speakerphone (the model must not
hear itself); autoplay unlock via the Start tap; Spanish speech quality;
backgrounding the tab releasing camera + mic (OS indicators off); ~10-minute
thermal/battery behavior; self-signed cert acceptance on the hotspot path;
answer quality on real packaging under kitchen lighting.

---


---

## The public door (`/food/demo`)

A standalone, shareable page that scores a food 1–100 with the published Food Compass 2.0
system and suggests better options in the same food group. No patient chrome, no patient
data — it is the page to send to someone outside the project.

**Link:** `https://patient-centered.vercel.app/food/demo` — everything works, no passcode.
The old `/compass` link redirects here permanently and carries its query string, so anything
already shared (including `?lang=es`) still lands in the right place.

### The passcode gate is off (2026-08-19)

`DEMO_PASSCODE` was removed from the Vercel production environment, so every AI route
answers without a passcode: realtime voice, the live camera scoring loop, vision Q&A, the
coach, the router and screening extract. The `?k=…` parameter is now ignored; old links
still work, they just do not need it.

**What that costs.** Realtime voice is billed per minute of audio in and out and is by far
the most expensive path here. The camera loop is about $0.50 per hour per active viewer
(one low-detail frame every 2.5 s, skipped when the scene has not moved, off after three
idle minutes). Both are open to anyone who has the URL, so the spend cap belongs in the
OpenAI dashboard under Settings → Limits, not in the app.

**What did NOT open.** Ladder's family AI uses `DEMO_PASSCODE` as its invite code and
requires it to be *present*, so removing it keeps that surface fully on-device —
`/api/family/session` returns `{"authorized":false}` and `/api/family/consent` returns
`{"capability":null}` in production. Safety is unaffected either way: the crisis gate, the
voice output guard and grounding all run regardless of the passcode.

To put the gate back: `vercel env add DEMO_PASSCODE production`, then redeploy.

### The five-minute script

**This door has no text box.** Everything below is spoken or pointed at. The camera starts on
load and the page is one scroll, so there is nothing to click through first.

1. **Let it open on its own.** The camera comes up and starts reading; the status strip says
   so. Without camera permission the viewfinder shows a sample-food still with a scan
   animation instead of a black panel. The persistent chip says this route uses Food Compass
   only — no patient profile or recent readings.
2. **Say the Papa John's line:** *"I am ordering a pepperoni and sausage pizza from Papa
   John's."* The demo extracts the restaurant, food and toppings, then scores the closest
   published restaurant category at 23. It says plainly that Papa John's and the
   sausage-specific topping are not represented; pick a correction chip to show that the
   user, not the model, controls the database match.
3. **Say `pizza`.** Score in the low 20s, red band, and three better pizzas — vegetable,
   whole-wheat thin crust, gluten-free — each with a recipe search link.
4. **Choose "Lowest calorie density first".** It is a radio choice, so the two sort modes
   cannot be active together. The alternatives heading repeats the active ordering.
5. **Say `water`.** No number and no chart at all: *"Water is the best choice there is — it's
   outside this score's range."* Food Compass excludes anything under 5 kcal per 100 g by
   definition, and running the formula on water anyway is exactly what made the original
   prototype produce nonsense.
6. **Point the camera at a banana.** 83, green. That number is the published Table S5 value
   for `63107010`, not a recomputation — the point being that the model never calculates.
7. **Scroll the camera off screen.** The strip switches to carrying the food name and score,
   and frames stop going out entirely. Scroll back and the last result is still there, with no
   re-scan and nothing new spent.
8. **Ask a question out loud:** *"what about peanut butter?"* The spoken number comes from the
   `lookup_food_score` tool, a table lookup, not from the model's memory.

### Known rough edges, so they do not surprise you live

- **Restaurant orders use a closest published category, not chain nutrition.** The local
  Table S5 asset has no Papa John's row and no combined pepperoni-and-sausage row. The UI
  preserves those details and labels what the selected score does not represent; it never
  calls 23 a Papa John's-specific score.
- **Bare `doritos` lands on the cool-ranch row (12), not nacho cheese (19).** Both rows
  score identically for that query and both are red; say `nacho cheese doritos` for the
  19. Nothing in the published data prefers one flavour over the other.
- **Barcode scores are estimates and read low.** A Nutrition Facts panel carries none of
  the vitamin, food-group or phytochemical domains, so a label-derived score is biased
  downward by roughly 17 points and is badged accordingly. Published scores have no such bias,
  however the food was named.
- **About a third of the published foods have no nutrient panel.** Table S5 spans FNDDS
  2001–2018 while the joined nutrient workbook covers 2017–18 only, so those foods show a
  score with no panel underneath it. That is stated on screen, not hidden.

### What the numbers are

Scores come from Table S5 of the Food Compass 2.0 supplement (9,273 published rows) or from
a deterministic TypeScript engine for label-only foods. The engine agrees with the published
scores at r = 0.966 on a subset where the comparison is clean; see
`docs/qa/2026-08-18-fcs-validation.md` for the full validation, including the three domains
that have no input data and what that costs.
