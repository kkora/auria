// Video recorder + muxer.
//
// recordVideo(browser, job, { plan, analysis, emu, auth, outDir, name, format })
//   -> { outVideo, seconds }
//
// Steps:
//   1. Synthesize narration WAVs via the TTS seam (src/narrate/tts.mjs).
//   2. Assemble a single timeline WAV (per-segment durations + pads -> silence gaps).
//   3. Record a Playwright context while driving the on-screen caption overlay and the
//      plan's actions (Tab presses, per-viewport resize + full scroll).
//   4. Mux video + narration with ffmpeg (ffmpeg-static) into mp4 (H.264/AAC) or webm.
//   5. Clean up intermediates (seg-*.wav, _narration.wav, _steps.json).
//
// Cross-platform once TTS is: recordVideo + ffmpeg already run headless on Linux.
// parseWav is exported for unit tests.
import { spawnSync } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { getTts } from "./narrate/tts.mjs";
import { applySteps } from "./browser.mjs";

const LEAD_MS = 1400;

// Parse a PCM WAV buffer into { fmt, data, durMs }. Pure — the WAV-assembly seam.
export function parseWav(buf) {
  let off = 12, fmt = null, data = null;
  while (off < buf.length) {
    const id = buf.toString("ascii", off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), byteRate: buf.readUInt32LE(off + 16), bits: buf.readUInt16LE(off + 22) };
    if (id === "data") data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  return { fmt, data, durMs: (data.length / fmt.byteRate) * 1000 };
}

export async function recordVideo(browser, job, { plan, analysis, emu = {}, auth = { cookies: [], headers: {} }, outDir, name, format = "mp4" }) {
  // 1. narration audio
  const tts = await getTts();
  await tts.synth(plan.map(p => p.text), { voice: job.voice, rate: job.rate, outDir });
  const stepsJson = path.join(outDir, "_steps.json");

  // 2. assemble one timeline WAV: silence gaps place each segment at its scheduled start
  const segs = [];
  for (let i = 0; i < plan.length; i++) segs.push(parseWav(await readFile(path.join(outDir, `seg-${i}.wav`))));
  const fmt = segs[0].fmt;
  let t = LEAD_MS;
  const schedule = plan.map((p, i) => { const s = { start: t, ...p }; t += Math.ceil(segs[i].durMs) + p.pad; return s; });
  const TOTAL = t + 1500;
  const chunks = []; let cursor = 0;
  const silence = ms => Buffer.alloc(Math.max(0, Math.round((ms / 1000) * fmt.byteRate)) & ~1);
  schedule.forEach((s, i) => { chunks.push(silence(s.start - cursor), segs[i].data); cursor = s.start + segs[i].durMs; });
  chunks.push(silence(TOTAL - cursor));
  const pcm = Buffer.concat(chunks);
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(fmt.channels, 22); hdr.writeUInt32LE(fmt.sampleRate, 24);
  hdr.writeUInt32LE(fmt.byteRate, 28); hdr.writeUInt16LE(fmt.byteRate / fmt.sampleRate, 32);
  hdr.writeUInt16LE(fmt.bits, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
  const narrationWav = path.join(outDir, "_narration.wav");
  await writeFile(narrationWav, Buffer.concat([hdr, pcm]));

  // 3. record the page while captioning + driving the plan's actions
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 900 } },
    ...emu,
  });
  if (auth.cookies.length) await ctx.addCookies(auth.cookies);
  const page = await ctx.newPage();
  await page.goto(job.url, { waitUntil: "load" });
  await applySteps(page, job.steps);
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });

  const caption = async text => {
    await page.evaluate(({ t2, nvdaUsed }) => {
      let c = document.getElementById("__audit_cap");
      if (!c) {
        c = document.createElement("div");
        c.id = "__audit_cap";
        c.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(8,16,32,.92);color:#fff;padding:12px 18px 14px;font:500 15px/1.4 system-ui;border-top:3px solid #6FA8FF";
        const tag = document.createElement("div");
        tag.style.cssText = "font:700 10px system-ui;letter-spacing:.08em;color:#8FBCFF;margin-bottom:3px";
        tag.textContent = nvdaUsed ? "AUTOMATED AUDIT — REAL NVDA OUTPUT (RE-VOICED)" : "AUTOMATED AUDIT — SIMULATED NARRATION";
        const body = document.createElement("div"); body.id = "__audit_cap_t";
        c.append(tag, body); document.body.appendChild(c);
      }
      document.getElementById("__audit_cap_t").textContent = t2;
    }, { t2: text, nvdaUsed: analysis.nvdaUsed });
  };

  const t0 = Date.now();
  for (let si = 0; si < schedule.length; si++) {
    const s = schedule[si];
    const wait = s.start - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await caption(s.text);
    if (s.action?.type === "tab") await page.keyboard.press("Tab");
    if (s.action?.type === "layout") {
      const { w, h } = s.action.vp;
      await page.setViewportSize({ width: w, height: h });
      // The scroll spans the whole slot (narration + pad): it reaches the true bottom
      // just before the slot ends and holds there one second, so the end of the page
      // is always on camera.
      const slotEnd = si + 1 < schedule.length ? schedule[si + 1].start : TOTAL;
      const avail = Math.max(3000, slotEnd - (Date.now() - t0) - 1400);
      await page.evaluate(async ms => {
        window.scrollTo(0, 0);
        const start = Date.now();
        const hh = () => document.documentElement.scrollHeight - innerHeight;
        // Adaptive step: remaining distance over remaining time, so the bottom is
        // reached exactly as the budget expires — even when the page is tall or grows.
        while (Date.now() - start < ms && scrollY < hh() - 2) {
          const remaining = ms - (Date.now() - start);
          scrollBy(0, Math.max(2, (hh() - scrollY) / Math.max(1, remaining / 16)));
          await new Promise(r => setTimeout(r, 16));
        }
        window.scrollTo(0, hh());
        await new Promise(r => setTimeout(r, 1000));
        window.scrollTo(0, 0);
      }, avail).catch(() => {});
    }
  }
  const tail = TOTAL - (Date.now() - t0);
  if (tail > 0) await page.waitForTimeout(tail);

  const video = page.video();
  await ctx.close();
  const rawVideo = await video.path();

  // 4. mux video + narration
  const outVideo = path.join(outDir, `${name}.${format}`);
  const codecArgs = format === "mp4"
    ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"]
    : ["-c:v", "copy", "-c:a", "libopus", "-b:a", "96k"];
  const mux = spawnSync(ffmpegPath, ["-y", "-i", rawVideo, "-itsoffset", "0.35", "-i", narrationWav,
    "-map", "0:v", "-map", "1:a", ...codecArgs, "-shortest", outVideo], { encoding: "utf8" });
  if (mux.status !== 0) throw new Error(mux.stderr.slice(-1200));
  await unlink(rawVideo).catch(() => {});
  const seconds = Math.round(TOTAL / 1000);

  // 5. clean up intermediates
  for (let i = 0; i < plan.length; i++) await unlink(path.join(outDir, `seg-${i}.wav`)).catch(() => {});
  await unlink(stepsJson).catch(() => {});
  await unlink(narrationWav).catch(() => {});

  return { outVideo, seconds };
}
