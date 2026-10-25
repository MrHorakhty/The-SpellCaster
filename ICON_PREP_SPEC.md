# ICON_PREP_SPEC.md — preparing icons inside the app

**Status: `planned`. NOT authorised for implementation.** Registered in `e2e/coverage.manifest.json` under
`features` as `planned`, so the coverage checker knows a feature exists without coverage and says so on every run.

This replaces `scripts/Image Pipeline/image_pipeline.py` for anyone who does not already have Python. The script
itself is not retired: it still works, it is still the fastest way to batch a whole folder, and **this is a second
door, not a removal of the first.**

---

## 0. The short version

The app already recolours sound icons, but **only well when the source icon is a grey/neutral tone**. That is not
something the app can fix on its own, because a coloured or photographic icon has no clean luminance structure to
threshold against, and an icon with an opaque background produces a solid rectangle of colour instead of a shape.

The user has been working around this with a Python script that manufactures an alpha channel from luminance, crops,
resizes, and outputs a flat grey silhouette. Two things must be installed to run it, so for anyone else it does not
exist.

**Three opt-in choices at upload, never automatic, in two steps** — choose, then preview, then confirm or cancel:

1. **Use as-is** — store the file untouched, so the feature never *removes* a capability.
2. **Crop to square** — interactive crop, original colours.
3. **Make silhouette** — remove the background, crop, resize, output flat grey so it tints cleanly. Carries two
   example images and *"it will work best with images like these."*

The chosen result replaces the stored icon **on confirm**, with a warning saying so. **Nothing is blocked for looking
bad** — the disclaimer plus the preview is the safeguard, and the user keeps their agency.

---

## 1. What already exists, and exactly what it cannot do

`recolorImageToColor` (`src/App.jsx:536`) recolours an icon by preserving each pixel's **lightness** and replacing
its hue/saturation with the sound's colour.

🔴 **It is applied at RENDER time, not at upload.** `src/App.jsx:1616-1643` walks sounds and tints
`loadedIcons[sound.icon]` into `tintedIcons`, keyed `icon|color|brightness`. Consequences that shape this whole spec:

- **Changing a sound's colour re-tints instantly**, and nothing is baked into the stored file.
- The tint **skipped entirely** when `sound.color === '#84cc16'` (App.jsx:1622), which is the *untinted* sentinel.
  A sound with no colour set shows the **stored image raw**. So whatever colour the stored icon has **is** what an
  untinted sound displays. This is why the output must be neutral grey: grey is what tints cleanly *and* what looks
  intentional when nothing tints it.
- It **preserves the existing alpha channel and never creates one** (`if (data[i + 3] === 0) continue`,
  App.jsx:577). **It cannot remove a background.** A white-background icon arrives opaque, and every one of those
  pixels is lightness 1.0, so it becomes a solid block of the target colour.

**This feature fills that gap. It does not replace the tint.** Silhouette output is flat grey precisely so the
existing per-sound tint has something good to work with.

## 2. Scope: sound icons only

`handleIconUpload` (`src/App.jsx:2963`) has exactly **one** call site: `src/App.jsx:6348`, inside the sound modal.
Characters, categories and groups use emoji or Lucide names via `renderIcon` (`src/App.jsx:115`), never uploaded
images.

So this is **not** a cross-container feature, and it does not touch the five-container-shape problem.

⚠️ **A consequence worth stating: the tint only covers two of the five shapes either.** The effect at
`src/App.jsx:1619` collects `characters[].sounds` and `environmentSounds[].sounds` only, so group-nested sounds are
never tinted. That is a **pre-existing gap, out of scope here**, and this spec must not silently widen into fixing it.

## 3. Why the script cannot ship as-is (measured)

| | needs | notes |
|---|---|---|
| `image_pipeline.py` | Python + `pip install Pillow` | one pip package |
| `normalize_sounds.py` | Python + `pip install ffmpeg-normalize` + **FFmpeg binaries on PATH** | three installs; ffmpeg is a C program, not a pip package |

The author's machine has all of it (Python 3.14.6, Pillow 12.3.0, `C:\ffmpeg\bin\ffmpeg.exe`), which is why the cost
is invisible there and fatal for anyone else.

**Both wrappers call bare `python`**, which is `py` on many Windows installs and absent on plenty of others.

---

## 4. Ground truth exists

🔴 **The 19 shipped icons in `public/assets` are already this pipeline's output.** Measured, not inferred:

- **17 of 19** have opaque colour exactly **`(106, 106, 106)`** — the script's `target_color`
- all are **512x512 RGBA**, transparent corners `(0,0,0,0)`, and a **20px** margin, i.e. art constrained to
  `512-40 = 472` then centred, exactly as the script does
- `Hail_of_Thorns` is `(113,113,113)`, one near-miss

Two uses:
1. **Regression ground truth.** The pipeline is near-idempotent on its own output, so a reimplementation can be fed
   the shipped icons and compared numerically.
2. **A worked example of the target look**, which is the answer to "what should this produce".

⚠️ **`public/assets/Icon.png` is NOT pipeline output** (dark navy `(29,17,53)`, no padding). It is the app icon.
Any future bulk operation over `public/assets` must exclude it explicitly or it will be destroyed.

## 5. Output contract

| | value | why |
|---|---|---|
| canvas | **256 x 256** | icons render at `48 * boxSize` px, `boxSize` clamped `0.5-2` (`src/App.jsx:1498-1501`), so **24-96px**. 256 is ~2.7x the largest render and supersamples retina. 512 (the script's value) is ~5x and wastes bytes |
| padding | **20px**, art max **216** | the script's 40px @ 512 scaled to the smaller canvas |
| silhouette colour | **`(106,106,106)`** | matches the shipped icons and the existing tints |
| fit-to-square colour | **unchanged** | that is the whole point of the second operation |
| format | PNG | alpha |

---

## 6. The algorithm — chosen by measurement, not by argument

⚠️ **Read the measurement basis before reading any number here.** Coverage is **the opaque pixel fraction of the
finished 256x256 canvas**, which includes the 20px transparent margin. An earlier draft of this table was measured on
the **intermediate 512x512 silhouette, before crop and letterbox** — a different quantity by a constant factor: for a
square image `finished = intermediate x (216/256)^2 = intermediate x 0.711`. Both bases are internally consistent;
quoting one as the other is how the first draft claimed an *"80% slab"* where the canvas figure is **57%**. Measured
directly on `_OLD_Murloc`: intermediate **82.1%**, finished **57.1%**, and the two code paths producing them yield
**byte-identical alpha**. 💡 **The takeaway is not a number — it is that a metric is only meaningful next to the
stage it was taken at.**

The corpus is **51 real icons** (`scripts/Test Images/`) plus the two examples, not the 11 files first drafted
against.

| input class | n | script's method | **chosen method** |
|---|---|---|---|
| line art, light background | **40** | **9.8-31.9%** | **6.7-34.4%** — agrees within ~6 points |
| **light art, dark background** | **11** | 🔴 **41.3-63.2%** | ✅ **4.7-30.7%** |

**The chosen method costs nothing on the happy path and is decisive on the dark-background one.** On a light
background the two are interchangeable, so no accuracy is traded away for the polarity fix. The dark-background result
is what the author saw as *"a couple with darker bg that I did not implement"*, and it is now **n=11, not n=3**.

### 6.0 Inputs the chosen method does not serve

Two classes were tested and are **not** handled by silhouette mode, which is why *Crop to square* and *Use as-is*
exist:

| input | n | script | chosen | verdict |
|---|---|---|---|---|
| golden armour renders (colour/photo) | 3 | 25.0-26.8% | **15.6-28.3%** | **not servable** — an unreadable mottled mass; the detail *is* the colour |
| desktop screenshots | 2 | 18.4-21.7% | **11.4-12.1%** | **incoherent shapes** — shown in a cancellable preview |

⚠️ **These files were removed from `scripts/Test Images/` during this work and existed only in backups.** They were
**preserved to `Masaüstü\output\preserved-test-images\`** before a prune, and `06_unserved_inputs.png` there shows
input beside result. They are the **only remaining copies on this machine**, and both methods fail on all five.

🔴 **An earlier draft quoted these as *60-62%* and *38-57%*** — the wrong measurement basis again, on the
intermediate rather than the finished canvas (see the basis note at the top of §6). **The verdict never changed;
the figures did.** That is twice the same mistake in one document, which is why the basis is now stated once at the
top of §6 rather than left implicit per table.

### 6.1 The script's method, and the two failures it has

```python
Image.open(p).convert("L")          # 1 greyscale
ImageEnhance.Contrast(g).enhance(3.0)  # 2 contrast x3 about the image mean
ImageOps.invert(...)                # 3 invert -> use as the alpha channel
silhouette.putalpha(alpha)          # 4 background becomes transparent
silhouette.crop(silhouette.getbbox())   # 5 crop empty space
silhouette.thumbnail((472, 472))    # 6 resize
```

**Failure A — dark background, near-solid.** Black background (luma ~1) inverts to ~254, so it stays **opaque**; the
light icon inverts to ~115, also opaque. Nothing is removed and the output is a solid grey rectangle. Measured across
**all 11** dark-background files in the corpus: **41.3-63.2%** opaque on the finished canvas, against **4.7-30.7%**
for the chosen method. This is exactly the "a couple with darker bg that I did not implement" case, and it is a
**polarity** failure: the method hardcodes "background is light".

**Failure B — colour / photographic art.** Flattening to one colour destroys an image whose detail *is* its colour.
A golden armour render has no luminance silhouette worth having. Three methods were tried and all three fail, so
**this is not a tuning problem and must not be presented as one.** It is why operation 2 exists.

### 6.2 The chosen method

Per pixel, in order:

1. **Downscale to a working size** (max side 512) before any of this. The corpus is up to 2048x2912; doing this at
   full size in a browser would be needlessly slow, and 256 is the output anyway.
2. **Border median colour.** Sample a ring at 2% of the smaller side, take the per-channel median.
3. **Distance from that colour**, max-channel: `d = max(|px - borderMedian|)`.
4. **Otsu threshold on `d`.** A histogram split, not a constant. This is what makes the method **polarity-agnostic**:
   it asks "does this pixel differ from the background", and it does not care whether the background is bright or
   dark. No light/dark special case exists anywhere in the algorithm.
5. **Smoothstep across the threshold** (`t-0.06` to `t+0.10`) rather than a hard cut, so anti-aliased edges survive
   as partial alpha instead of being crushed to 0 or 255.
6. **Component cleanup.** Keep every opaque blob **≥2% of the largest**, dropping the rest. Speckle goes, and a
   multi-part illustration survives — see §6.4, where "keep only the largest" deleted 110 of 111 real parts.
7. Crop to content, resize to 216, centre on the 256 transparent canvas.

⚠️ **Known limitation, measured:** a **gradient** background defeats step 3, because the far end of the gradient no
longer matches the border median and is retained as foreground (the armour rows, 38-57%). A post-pass that deletes
any opaque region **touching the image border** was identified as a likely improvement but **was never tested** — so
it is not part of this spec, and nobody should describe the silhouette mode as handling gradients.

### 6.3 Two discarded methods, and the bugs that killed them

Recorded because both produced convincing-looking wrong output, and both are easy to re-attempt by mistake.

- **Contiguous magic-wand flood fill — bug 1, tolerance drift.** Comparing each candidate to *the pixel that
  reached it* lets tolerance accumulate along the path, so the fill random-walks across the entire image. Coverage
  collapsed to 0-5% on everything. A correct magic wand compares against **one fixed seed colour**.
- **The same flood, fixed — bug 2, and this one is a real design flaw.** Taking the *median* of the border ring
  breaks when the artwork touches the border: `Spike_Growth_1`'s spikes reach the top edge, so the border median
  becomes **navy**, the algorithm deletes the artwork and keeps the background. Coverage went *up* and the result got
  *worse*. Not a tuning problem either.

💡 **Both bugs produced plausible-looking images.** Only the coverage number gave them away. Measure the output,
do not trust the thumbnail.

### 6.4 A third failure, found later and this one the metric missed

The step above kept **only the largest connected component**, to kill JPEG speckle. Run against the two images chosen
as in-app examples, it **destroyed one of them**:

| example | components found | keep-largest | keep ≥2% of largest |
|---|---|---|---|
| `Light Background Example.jpeg` | **111** | 🔴 **16.0% — reduced to a single blob** | ✅ **12.6% — the whole creature, with tentacles and wisps** |
| `Dark Background Example.png` | 5 | 25.3% | 25.8% (unchanged) |

**Cause:** the coral is a *composed* illustration. Its shell/body is one component and each tentacle and wisp is
another, so "keep only the largest" deleted 110 legitimate parts. That is not an edge case — **most illustrations are
multi-part**, so this was a general defect, not a bad example.

**Fix:** keep every component **≥2% of the largest**, rather than only the largest. Speckle still goes, real parts stay.

✅ **VALIDATED ACROSS THE FULL 51-IMAGE CORPUS, 2026-10-18.** The corpus grew from 11 files to **51 real icons**,
which is enough to answer the question rather than guess at it:

- **3334 connected components** found across the corpus; the `≥2%` rule keeps **552** of them.
- Mean coverage **18.3% → 19.5%**; **25 of 51** images gain with `≥2%`, and **no image loses real content**.
- A visual pass over **13** images chosen to span the range — the highest-component files, the lowest, and both
  examples — found **keep-largest wrong on 8, dramatically wrong on 4, and never better**:

| image | components | keep-largest | keep ≥2% |
|---|---|---|---|
| `_OLD_They Came From BEHIND` | 99 | 🔴 an amorphous blob | ✅ the full emblem |
| `Soothe` | 44 | 🔴 a blob | ✅ hands cradling the swirl |
| `Light Background Example` | 111 | 🔴 the shell only | ✅ the whole coral |
| `Hail_of_Thorns_1` | 141 | partial swirl | ✅ full flourish |
| `Wind` | 23 | partial swirl | ✅ full swirl and trails |
| `Forest`, `Fire_Crackling`, `Daze`, `Dark Background Example` | 4-54 | complete | complete — **no difference** |

- 💡 **The pattern is exact: keep-largest fails precisely when the artwork is multi-part**, and is identical when the
  art is one connected mass. That is why it looked fine on the first examples tried and broke later.
- ⚠️ **What is *not* proven: that 2% is the optimal value**, only that it beats largest-only decisively. `≥5%` and
  `≥10%` produce near-identical numbers across the corpus, so the decision that matters is **largest-only versus any
  threshold at all**, and 2% is the safer side of it.

🔴 **And note the coverage numbers, because they are the lesson.** Keep-largest scored **16.0%** on the coral —
comfortably inside the plausible band — because the surviving blob was tiny and got **magnified** to fill the canvas.
The good output scored a **lower 12.6%** while containing far more of the image. **The metric rated the broken output
as healthier than the good one, and only looking at it caught the bug.** 💡 **A coverage number can be satisfied by
scaling a remnant. Never let it stand in for looking.** ⚠️ The same artefact makes coverage **non-monotonic in the
threshold** — keeping more components widens the bbox, which scales everything down — so the corpus table cannot
rank thresholds, only the visual pass can.

### 6.5 Why I did not just ship the Python algorithm

Because it fails the dark-background case, and the author's own corpus contains three images that prove it.

---

## 7. The upload flow — three options, two steps, by choice

🔴 **Nothing runs automatically, and nothing is removed.** The user's own reasoning, 2026-10-18: icons are square and
an uploaded image will usually be fitted inside one, so *crop* is the operation most people want — but defaulting to
it would **override the user's agency**, which is the one thing the flow exists to protect. So there are **three**
options and no default:

- **Use as-is** — store the file untouched. Without this, uploading a colour icon unmodified would become
  **impossible**, which would be a regression on what works today.
- **Crop to square** — interactive crop, original colours.
- **Make silhouette** — background removal, flat grey, tints cleanly.

### 7.1 Step 1 — choose, and read what each does

Clicking **Upload Icon File** (`src/App.jsx:6345-6350`) and picking a file opens a **dialog listing the three
options**. Each states plainly what it does. The **Make silhouette** entry additionally shows **two example images**
and the line:

> It will work best with images like these.

### 7.2 Step 2 — preview, then confirm or cancel

Choosing an option shows **what it will actually produce for that file**. Only then can the user **confirm or
cancel**.

- **Confirm** stores the result. **Cancel discards the file**, leaving the sound exactly as it was.
- 🔴 **No error is raised for a poor result.** The disclaimer plus the preview *is* the safeguard. Someone can
  silhouette a screenshot on purpose, see what comes out, and go through with it — see §11.

Afterwards, the existing **Icon Preview** panel (`src/App.jsx:6357-6371`) does its job exactly as it does today, and
the per-sound tint applies as before. **The dialog is an extra step, not a replacement for that panel.**

### 7.3 Crop to square — interactive

The user chooses what is cropped, like a profile-picture uploader:

- **fixed square** viewport with a crop frame; only pan and scale, no free-form rectangle
- **drag to pan**; **wheel to zoom** on desktop; **one-finger drag to pan, pinch to zoom** on Android
- ⚠️ `touch-action: none` is required on the crop surface, or a drag pans the modal instead. The app already has a
  pointer-event drag (edit-mode reorder, `src/App.jsx:3643`) — **the cropper must not inherit it.**
- **keyboard**: arrows pan, `+` / `-` zoom, so it is not mouse-only. `e2e/specs/platform.mjs` already treats
  keyboard coverage as a first-class concern.

Output: **256x256, original colours, no background removal.**

### 7.4 The two example images

`scripts/Light Background Example.jpeg` and `scripts/Dark Background Example.png` — a dark coral skeleton on white
and a light ghost on black. **Same subject style, opposite polarity**, which is the whole point: it shows the user
that a dark background is not a problem, where the old script turned one into an 80% grey slab.

⚠️ **The dark example is a scrapped icon, never shipped.** Confirmed by the author, and deliberately kept that way —
it is a demonstration asset, not content.

🔴 **They must be downscaled before committing.** As-is they are **805 KB + 900 KB**. At the 256px they actually
display at:

| file | as-is | @256 JPEG q85 | @256 WebP q85 |
|---|---|---|---|
| `Light Background Example` | 805 KB | **9.6 KB** | 6.4 KB |
| `Dark Background Example` | 900 KB | **6.4 KB** | 3.3 KB |

So the real cost is **~16 KB**, not the 1.7 MB first estimated. **Commit the downscaled versions.** 💡 An earlier
draft proposed using the shipped `public/assets` icons instead, on the grounds that they were already committed and
would cost nothing. That was wrong: they are the pipeline's **output**, so they show what you *get*, not what you
*upload*, and "works best with images like these" needs the input.

## 8. The preview is the diagnostic, and that is load-bearing

⚠️ **A static gallery of acceptable inputs cannot work, because the input space is unbounded** — the author's own
objection. Three shipped examples would not cover the fourth file someone uploads. So the design does not lean on
examples; it leans on **previewing the user's own file**, which is computed from the actual bytes and therefore
generalises.

That makes the preview a **requirement, not a convenience**: it is the only thing telling the user whether their file
can reach the look in §7.4.

🔴 **No "file type detector" is in scope.** It would be natural to classify a render or a screenshot and warn — and
the signals exist (border-colour variance catches the armour's gradient; connected-component count catches a
screenshot). ⚠️ **But no such classifier has been measured**, only imagined, and a wrong classifier is worse than
none. Listed in §15 as open. **The measured signals that do exist** — the colour/photo result retaining **38-57%**
background against **17-23%** for line art — are the honest basis for the wording *"works best with images like
these"*, and for nothing stronger.

## 9. Replace on confirm, with a warning

The result replaces the stored icon **when the user confirms**, and **no original is kept**.

⚠️ **The warning must say that, because it is true and irreversible:**

> This replaces the icon file for this sound. The original cannot be recovered.

Keeping the original to allow reverting would mean a **new persisted field on the sound**, which is a persisted-shape
change, and `FADE_SPEC.md` is already introducing one. **This spec deliberately adds none.**

**No extra persisted shape.** The processed icon is simply the icon that gets stored, under the existing
`toStoredFileName('icon', ...)` path (`src/App.jsx:2934-2938`).

## 10. The blocker to know before starting: pixel access

🔴 **Once an icon is stored, its bytes cannot be read back as pixels without help.** `sound.icon` holds a *filename
reference*, and the bytes live in `uploads/<profileId>/` (Tauri) or `localStorage` (web). An `<img>` renders them
fine but `getImageData` throws `SecurityError`, because Tauri's `asset://` URLs are cross-origin and taint the
canvas.

`recolorImageToColor` already works around exactly this (`src/App.jsx:538-550`): `fetch` the URL, convert to a blob,
make an object URL. **That workaround is the precedent and should be reused verbatim.**

✅ **This is also why "crop to square" cannot be an edit action on an existing icon.** It needs the image in memory as
pixels, so it must happen in the upload flow. Putting **all three** choices upload-time keeps the mental model simple
and puts the workaround in one place.

## 11. No quality gating — the preview is the safeguard

🔴 **An earlier draft of this spec made the opposite decision and it was wrong.** It proposed *refusing to save*
when opaque coverage looked pathological. The author overruled it, and the reasoning is sound: **the disclaimer plus
the preview is the safeguard, and the user keeps their agency.** Someone may want to silhouette a screenshot on
purpose; seeing the output and choosing to keep it is a legitimate outcome, and a blocking error would take that
choice away while teaching nobody anything.

So:

- 🚫 **No coverage threshold blocks a save.** Not `<2%`, not `>70%`. **None.**
- ✅ **Any quality information shown must be advisory**, phrased as information, never as a block.
- ✅ **The only errors worth handling are operational**, and they are failures rather than judgements: the file is
  not decodable as an image, or processing threw. ⚠️ Note that `accept` is **only a hint** and the app does **no
  type or size validation** on icon upload today, so "that file is not an image" is a real reachable case and needs
  a message rather than a silently broken preview.
- 💡 **The screenshots are therefore no longer a guard-rail test case.** Every method turns them to garbage, and
  **garbage shown in a preview the user can cancel is the correct outcome.** They remain in the corpus as the
  example of an input the feature does not serve well.

⚠️ **The coverage numbers are still worth computing** — not to block, but because §6's whole method of choosing this
algorithm was measurement, and the same numbers are what would tell a future session whether a change regressed it.

## 12. Test corpus — **used, measured, recorded, then removed**

The corpus was **51 real icons** (`scripts/Test Images/`) plus the two examples. It did its job: the threshold was
validated across it, and **every number in §6 came out of it**. Each file class earned its place:

| file class | proved |
|---|---|
| `Spike_Growth_1/2`, `Tavern`, `Longbow`, `Dungeon`, … (40 files) | the happy path; both methods work, and `Spike_Growth_1` is the border-touching trap |
| `_OLD_Murloc`, `_OLD_Phantom Pain 01/02/03`, `_OLD_They Came From BEHIND`, … (11 files) | **the dark-background failure the script has and the chosen method fixes** — this is the whole justification for not reusing it |
| `Hail_of_Thorns_1/2/3`, `Soothe`, `Force_Barrage`, `Wind` | the **multi-part** illustrations that exposed the component-cleanup defect (§6.4) |
| `Light Background Example.jpeg`, `Dark Background Example.png` | the in-app examples (§7.4) |

🔴 **The corpus was DELETED from the working tree on 2026-10-18, at the author's instruction**, once the measurements
were recorded — the author holds the originals elsewhere. **Consequences, stated rather than discovered later:**

- ✅ **The knowledge is not lost.** Every figure in §6 and §6.4 came from it and is written down here, and
  `Masaüstü\output\` holds the contact sheets, the per-image tables and the generator script.
- ⚠️ **Re-validation is no longer possible from this repo.** §15's open item on tuning `≥2%` can only be revisited with
  the originals, or against the two example images.
- ⚠️ **The pipeline script is kept** (`scripts/Image Pipeline/`) as the reference to port from, and it can no longer be
  diffed against the corpus — only against the examples.
- 💡 **It was never committable anyway**: 51 files, ~50 MB, including two near-identical 2048x2912 PNGs at 6.6 MB each.

### 12.1 What survived, and where

| what | where |
|---|---|
| all measurements, per image | `Masaüstü\output\03_threshold_corpus.txt`, `04_script_vs_chosen.txt` |
| visual comparisons | `Masaüstü\output\02_threshold_largest_vs_2pct.png` |
| every input, as supplied | `Masaüstü\output\01_all_inputs.png` |
| the five unservable inputs | `Masaüstü\output\06_unserved_inputs.png` (**the originals were deleted at the author's instruction**) |
| the generator | `Masaüstü\output\generate_outputs.py` — rerunnable against any folder of images |
| the two example images | **still in `scripts/`**, because they are needed as app assets (§7.4) |

## 13. Where the code lives, and the coverage plan

**A new module `src/iconPrep.js`, not inline in `App.jsx`** (`App.jsx` is already 7448 lines / 408 KB). The
precedent is three times over: `src/profileStorage.js`, `src/profileBundle.js`, `src/bundleGuard.js`, each with its
own `e2e/*.check.mjs`. `bundleGuard` was extracted for exactly this reason — the parts a browser spec cannot reach
became node-testable.

🔴 **Split it so the maths is node-testable.** Otsu and connected components need **no canvas at all** — they take
an RGBA buffer and return an alpha buffer. So:

- `segmentAlpha(rgba, w, h) -> alpha` — **pure.** Border median, distance, Otsu, smoothstep, component cleanup.
- `cropToSquare(rgba, w, h, pan, scale)` — **pure geometry** for the cropper.
- `prepareIcon(blob, mode, opts)` — the only canvas-touching wrapper.

`segmentAlpha` is then testable in node against **synthetic two-tone buffers**, which is how the dark-background
regression gets pinned without a browser. ⚠️ A node check will need a tiny stub for `Image`/`canvas`, since node has
none.

⚠️ **All 26 single-letter test-id prefixes are taken** (measured from `coverage.manifest.json`), so a new suite needs
a **new category**, not a new letter. `check-coverage.mjs` only checks `AMBIGUOUS_ID` **within one (file, category)**
(line ~201), so a fresh category cannot collide.

- new shared spec `e2e/specs/iconprep.mjs`, category **`ICON`**, ids **`IP1`..`IPn`**, `idPattern` `^IP\d`
- the checker auto-discovers `e2e/specs/` (`check-coverage.mjs:260`), but the suite still must be **imported and
  passed to `runSpecs()` by both entrypoints** or it fails `SPEC_NOT_RUN`
- intended coverage: **use-as-is stores the bytes untouched** (the regression that matters most, because without it
  the feature removes a capability); **a dark-background input succeeds where the script left it near-solid** (11/11
measured, 41.3-63.2% against 4.7-30.7%); a
  **multi-part** input survives (§6.4, the component-cleanup defect); crop honours the user's chosen region; the
  three-option dialog appears on upload and **nothing is stored until confirm**; the replace warning appears; and
  **no quality threshold blocks a save** (§11)
- run `node e2e/check-coverage.mjs --update` after writing, and **review the id diff**

⚠️ **Canvas pixel assertions over CDP need care.** `bundle.mjs` already drives the app's byte-level functions
directly because native pickers cannot be stubbed. The same applies here: a test must not depend on the OS file
picker. Seed the bytes in-page and invoke the processing function directly.

---

## 14. Settled decisions

| Question | Answer |
|---|---|
| How many operations? | **Three: Use as-is / Crop to square / Make silhouette.** Use-as-is exists so the feature never *removes* a capability |
| Flow shape | **Two steps: choose (with what-it-does and examples) → preview → confirm or cancel.** Cancel discards |
| Automatic? | **Never.** The author's own reasoning: crop is probably what most people want, but defaulting to it would override the agency the flow exists to protect |
| Blocking on bad output? | **No.** The disclaimer plus the preview is the safeguard. Only *operational* failures produce an error |
| Where do examples live? | **In the app, inside the Make silhouette option** — the two supplied files, downscaled to 256px (**~16 KB**, not 1.7 MB) |
| Replace or keep the original? | **Replace on confirm, with a warning that it cannot be recovered** |
| Output size | **256px** |
| Algorithm | **Adaptive (Otsu on distance-from-border-colour), not the script's.** Component cleanup keeps everything **≥2% of the largest** |
| Colour / photographic art | **Not silhouetted.** Crop to square or use as-is, and the wording says so |
| Scope | **Sound icons only** (one upload call site) |
| Code location | **New `src/iconPrep.js`**, maths split out so a node check can reach it |
| Persisted shape | **Unchanged** |
| The Python script | **Provisionally retired**: it is the reference to port from until `src/iconPrep.js` is validated against the corpus, dead weight after that |

## 15. Still open

1. **Gradient backgrounds.** A border-touching post-pass may fix the armour class in §6.0. Untested; not in scope.
2. **Whether a file-type classifier is wanted at all.** The signals exist (border variance, component count) but
   nothing has been measured. §8 argues for leaving it out; a future session may disagree having seen real uploads.
3. **Whether `Icon.png` and the shipped 512px icons should ever be re-processed to 256.** They work today. Doing it
   would shrink `public/assets` but touches shipped content, so it needs its own decision.
4. **Whether crop-to-square should also offer a background-removal variant** for colour art on a plain background.
5. ⚠️ **Whether `2%` should be tuned.** Validated as "much better than largest-only" (§6.4), not as optimal. Only
   worth revisiting if an input appears where a real part is under 2% of the largest — and note the corpus that would
   test it is **gone from the repo** (§12).

### 15.1 Considered and declined on 2026-10-18 — do not re-propose without a reason

**Exposing the algorithm's constants as sliders.** The author asked whether a user could tune them, and declined.
Recorded so it is not re-litigated:

- **The threshold band** (`th ±0.06 / +0.10`) would be the meaningful knob, labelled by intent
  (*remove less ↔ remove more*) rather than by mechanism, because **output coverage is non-monotonic in the
  threshold** and a percentage label would behave confusingly.
- 🔴 **The component ratio (`≥2%`) must never be exposed.** It is a **bug fix**, not a taste setting — keep-largest
  deleted **110 of 111** real parts of a drawing (§6.4). A slider invites users to walk straight back into that.
- **Why declined:** the recovery path is already free — bad result → cancel → *Use as-is* or *Crop to square*. A slider
  adds a step to the common case where the default is already right, and introduces a worse failure: a user dialling
  in a broken silhouette and saving it.
- 💡 **If it is ever added**, the only defensible form is **one** slider, inside a collapsed *Fine-tune* disclosure,
  **session-only** — so it adds **no persisted shape** and the promise in §9 holds.
- ⚠️ **What would change the answer:** a real example outside the 51-image corpus, e.g. a gradient background or a
  dense illustration. Add it against a real case, not a hypothetical one.