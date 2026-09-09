// Run this ON THE YOUTUBE PAGE (Browser pane javascript_tool) with the
// video loaded and the pose lab server up (`node tools/pose-lab/serve-lab.js`).
// It pauses the video, grabs a frame every `step` seconds between `from`
// and `to`, cropped to the lifter, and sends the browser to the lab with
// the frames packed into the URL fragment -- youtube.com's CSP blocks
// every request to localhost, but not a navigation. See
// docs/animation-from-clip.md.
//
// Edit the four values at the top per clip. `crop` is fractions of the
// frame around the lifter (a tight crop raises the model's accuracy).
(async () => {
  const clip = "bench_ejI1Nlsul9k";
  const crop = { x: 0.3, y: 0.28, w: 0.5, h: 0.72 };
  const [from, to, step] = [0, 5.5, 0.25];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const player = document.querySelector(".html5-video-player");
  for (let i = 0; i < 60; i++) {
    const skip = document.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
    if (skip) skip.click();
    if (player && !player.classList.contains("ad-showing")) break;
    await sleep(500);
  }
  const v = document.querySelector("video");
  v.pause();
  v.addEventListener("ended", () => v.pause());
  const seekTo = (t) =>
    new Promise((res) => {
      const done = () => {
        v.removeEventListener("seeked", done);
        res();
      };
      v.addEventListener("seeked", done);
      v.currentTime = t;
    });
  const frames = [];
  for (let t = from; t <= to + 1e-6; t += step) {
    await seekTo(t);
    await sleep(150);
    const sx = crop.x * v.videoWidth, sy = crop.y * v.videoHeight, sw = crop.w * v.videoWidth, sh = crop.h * v.videoHeight;
    const c = document.createElement("canvas");
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    c.getContext("2d").drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    frames.push({ t: +t.toFixed(2), b64: c.toDataURL("image/jpeg", 0.85).split(",")[1] });
  }
  const url = "http://localhost:8098/pose-lab.html#" + encodeURIComponent(JSON.stringify({ clip, crop, frames }));
  if (url.length > 1800000) throw new Error("payload too large for a URL: " + url.length + " -- fewer frames or a tighter crop");
  setTimeout(() => {
    location.href = url;
  }, 200);
  return { frames: frames.length, urlLen: url.length };
})();
