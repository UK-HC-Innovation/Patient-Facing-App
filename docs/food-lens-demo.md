# Food Lens — demo runbook

Camera + voice dietary feedback. Point the phone at a food, ask by voice, get
personalized spoken guidance grounded in the patient's care plan, medications,
and readings. This is a proof-of-concept demo. The voice safety gate is active,
and the Food controls disclose the current AI data path before and during use.

Demo device: **Android Galaxy S25, Chrome.** iOS is out of scope.

---

## One-time setup

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

## Run it on the phone

`getUserMedia` needs a secure context (HTTPS). Two tunnel-free ways to get one —
no `cloudflared`, `ngrok`, or any other external tunnel (those create an
externally-routable ingress into the workstation and are not used here):

**Primary — the hosted build (recommended).** Open the Vercel URL on the S25 in
Chrome:

- Typed / mock mode: `https://patient-centered.vercel.app/food`
- Live voice: `https://patient-centered.vercel.app/food?k=<DEMO_PASSCODE>`

Production live voice requires `HEALTH_AI_PROVIDER=openai`, a configured
`HEALTH_AI_API_KEY`, and a configured `DEMO_PASSCODE`. An absent or incorrect
passcode intentionally falls back to typed / mock mode. The passcode appears in
the URL: use a temporary demo secret, never share or screenshot the complete
URL, and rotate the secret after the demo.

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
   dev origin, add that exact `https://<laptop-ip>:3000` to `allowedDevOrigins`
   in `next.config.mjs` for the session (a specific LAN IP — never a tunnel host).
   Remove that temporary entry immediately after the demo.

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

## Seed the patient

Privacy → **Reset demo**. This seeds Jordan Taylor, Lisinopril 10 mg, three
rising morning readings (132/84 → 141/88 → 149/94, all below the 160/100 call
threshold), and an empty meal log.

## Staged products

| Product | Barcode | Beat |
|---|---|---|
| Campbell's Condensed Chicken Noodle Soup | `051000012616` | Sodium 890 mg → 59% of the daily target + rising readings |
| Morton Lite Salt | `024600017008` | Salt substitute → ACE-inhibitor (lisinopril) caution |
| Quaker Old Fashioned Oats | `030000010204` | Low sodium, high fiber → positive beat |

## Script

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

## Contingencies

- WebRTC blocked → phone hotspot.
- Total network loss / no key → the page shows a typed **fallback** with the
  same flags and logging (seeded lookups are local).
- Session error mid-demo → **Try again** re-mints the token and reconnects;
  transcripts are already saved.

---

## What cannot be automated — verify on the real S25

Camera start latency and orientation; native barcode speed and low-light
behavior on real packaging; WebRTC over Wi-Fi and 5G; server-VAD turn-taking
feel and barge-in latency; echo cancellation on speakerphone (the model must not
hear itself); autoplay unlock via the Start tap; Spanish speech quality;
backgrounding the tab releasing camera + mic (OS indicators off); ~10-minute
thermal/battery behavior; self-signed cert acceptance on the hotspot path;
answer quality on real packaging under kitchen lighting.
