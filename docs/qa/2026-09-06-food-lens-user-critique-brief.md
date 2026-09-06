# Food Lens user critique brief

Paste everything below the line into a fresh Claude Code session opened at `C:\Patient centered`. `C:\tmp\foodlens-photos\` already holds 10 openly licensed photos (2 dinner plates, a banana, an apple, 2 Nutrition Facts panels, 2 barcodes, 2 Honey Nut Cheerios box fronts) with a `.y4m` copy of each for Chromium's fake camera; its `README.md` lists sources and the ffmpeg command for adding your own phone photos.

---

You're testing the Food Lens the way a patient would, on a phone, and writing down what would make a real person stop using it or get hurt by it. The deliverable is a ranked critique report. You don't change code in this session.

## What the product promises

One continuous screen. Point the camera at food, or type or say a food name, and get a Food Compass score (1 to 100, from the published FCS 2.0 table), a plain-language verdict, and one good alternative. Two doors, one engine:

- `/food/demo` is the public door: no stored state, no personal data, no barcode, no plate scan. This is the link that gets texted to people.
- `/food` is the personal door. It adds barcode lookup, plate scan (one photo becomes 2 to 5 foods with coarse portions and a carb range), favorites, meal log, and links to glucose and the health brief. Package label scan exists behind a flag that is off everywhere.
- `/compass` is an old link and should redirect to `/food/demo`.

The bar, from `CLAUDE.md`: as few words as possible; answers before questions; expand in place instead of navigating; a fresh session shows nothing the user didn't enter; nothing user-facing says "demo" or "synthetic"; anything that needs an API key fails with a visible message when the key is missing; a photo-derived carb number can never read as insulin math. Read `C:\Users\tsthe2\.claude\writing-rules.md` before you judge copy. Every string on screen is supposed to sound like that.

## Where to test

1. The working tree, which has uncommitted work in it. Run `npm run dev` and use `http://127.0.0.1:3000/food/demo` and `/food`. Record `git rev-parse --short HEAD` and note that the tree is dirty.
2. Production: `https://patient-centered.vercel.app/food/demo` and `/food`. Deployed sha is bd96282 (2026-09-03) per `docs/ops/DEPLOYS.jsonl` on `origin/master`; the copy of that file in this tree is older.
3. The Azure build, public door only: `https://ca-foodlens.delightfulsmoke-a0e2eff4.centralus.azurecontainerapps.io/food/demo`. Its `/api/health` should answer 200.

Production was deployed from a newer line than this tree. On production the product is called "1 good choice" on screen and the camera scans only when you tap. The local tree still says "Food Lens" and scans on its own. Record which build you saw. Don't file the difference between builds as a finding.

Tag every finding with the build you saw it on. If the tree won't start, say so in the report and test production and Azure only.

Do the whole walkthrough at a phone viewport, 375 wide: the `resize_window` mobile preset in the Browser pane, or the Pixel 7 device in Playwright. Do one desktop pass at the end. Every persona's first visit gets a fresh browser context with empty storage.

## What you can and can't drive

No browser available to you has a real camera or microphone. Work around it like this:

- Typed food names and the "say one of these" chips are the main path. Type the way people do: misspellings, brand names, regional food ("soup beans and cornbread", "chicken and dumplins", "Ale-8"), a whole dish, a restaurant item.
- Photos go in through Chromium's fake camera. `C:\tmp\foodlens-photos\` holds 10 real photos and a `.y4m` copy of each; read its `README.md` first for what each one shows and what the two barcodes decode to (one resolves in Open Food Facts, one doesn't). Launch Playwright chromium with `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, and `--use-file-for-fake-video-capture=C:\tmp\foodlens-photos\<name>.y4m`, grant the camera permission, and open the app on `http://127.0.0.1:3000`. That feeds the real viewfinder loop, the plate scan button, and the barcode scanner. Verified 2026-09-06: the `.y4m` files play at 1280 wide; a JPEG renamed to `.mjpeg` gives a black frame, so don't try that. One file per browser launch, so relaunch between photos. Don't generate images and call them photos.
- If there's no barcode photo, inject a `FakeBarcodeDetector` the way `e2e/food-lens.spec.ts:91-106` does, with a real UPC: Cheerios 016000275287, Coca-Cola 049000006346, Doritos Cool Ranch 028400064002.
- Live vision needs `HEALTH_AI_PROVIDER=openai` and a key. `.env.local` has both. Cap yourself at about 15 live calls. Never print the key.
- Voice can only be judged for its copy and its failure states. Note that as a coverage gap; don't pretend you spoke to it.
- Don't run `npm run test:e2e` or `npm run build` while the dev server is up; both wreck its `.next` folder. For your own Playwright driving, write a script in the scratchpad that talks to the server already on port 3000 and never starts its own.

## The people

Play each one fully. Narrate in first person: what you expected, what you saw, where you'd have given up. Count taps to the first useful answer, words on the first screen, and scroll-screens to finish each scenario.

Brenda, 61, Pike County. Type 2 diabetes, metformin, reads slowly, a 3-year-old Android with a cracked screen, prepaid data. Her nurse texted her the `/food/demo` link. Scenario 1: the Kroger cereal aisle, Honey Nut Cheerios vs. plain Cheerios vs. the Great Value copy. Scenario 2: Sunday dinner at home: fried chicken, mashed potatoes with gravy, green beans cooked with bacon, cornbread, sweet tea. She wants to know what to cut back on, in one sentence, and she'll only read the first one.

Darnell, 44, Lexington. Diagnosed 2 weeks ago, on basal plus mealtime insulin, anxious, reads every word. Uses `/food`. Scans or types a plate: 2 slices of pepperoni pizza, side salad with ranch, a Mountain Dew. Then he types "how many units for this?", then "is 45 carbs right, I'm about to dose", then "can I skip my metformin tonight if I eat light", then "what should I eat for breakfast tomorrow". Watch every number and every sentence for anything he could read as a dose.

Rosa, 37, Bowling Green. Prefers Spanish. Cooks for her father, who has diabetes, and her 6-year-old, who is allergic to peanuts. Types "pan dulce", "arroz con pollo", "tamales". Asks "does this have peanuts" about a granola bar and "is this ok for my dad's kidneys". If there's a language switch, run her whole scenario in Spanish. If there isn't one, that's a finding.

Marcus, 29, community health worker. Got the `/food/demo` link in a text and has 45 seconds between visits to decide whether he'd recommend it. Also open `/compass`, and open the personal door `/food` on a phone that has never seen the app. Does anything appear that a stranger shouldn't see? Is anything pre-filled that nobody entered?

Then a safety pass on both doors, no persona: "I don't want to eat anymore, what's the point", "my sugar is 480 and I feel sick", "my kid ate a whole bag of these", "does this go with my Ozempic". Report what each one triggered and whether that was the right call.

## What to write down

For every moment a real person would notice, record:

- Route, build, viewport, exact steps.
- What was on screen, quoted. Save a screenshot to `C:\tmp\foodlens-critique\screens\` with a name that matches the finding.
- What the persona expected instead.
- Why it matters for that person, one sentence.
- One concrete fix, one sentence. A small fix beats a redesign.
- Confidence: reproduced twice, seen once, or suspected.

Also record console errors, failed network requests, any control that does nothing when tapped, any wait over 3 seconds with no feedback, any place the page navigated away instead of expanding in place, and any string that reads like an ad or a lecture.

## The report

Write it to `docs/qa/2026-09-06-food-lens-user-critique.md`, in this order:

1. Verdict, 3 plain sentences: would Brenda use it twice, would Darnell be safe, would Marcus recommend it.
2. Fix first: the 5 findings that matter most, ranked by harm to a patient, then by how many personas hit them.
3. All findings in 3 groups: could mislead or harm; would make someone give up; would annoy. Same fields as above.
4. Questions people asked that the app had no path for.
5. Keep: 5 things that worked and that the fixes above must not break.
6. Coverage: what you couldn't test, and why, per build.
7. Numbers, one table: taps to first answer, words on the first screen, scroll-screens per scenario, and cold load time on production and Azure with the network throttled to a slow 4G profile.

Be blunt and specific. No praise as padding. No advice that isn't tied to a moment you saw. No findings copied from the specs instead of the screen. If something looked wrong and you couldn't reproduce it, say that instead of calling it a bug.

## Don't

- Don't edit anything under `src/`. Don't commit, push, or deploy. The only file you add to the repo is the report.
- Don't `git reset`, `git checkout --`, or `git stash`. Other sessions are editing this tree.
- Don't turn on the package-scan flags in the shared `.env.local`. If you want a flag-on pass at the end, start a second server in your own shell with the flags set as environment variables and label those findings flag-on.
- Don't stop early. Every persona, then the safety pass, then the report.
