// Static server for the pose lab: serves this scratchpad directory on 8098,
// and takes frames from a page that can only reach us through an <img> GET
// (youtube.com's CSP blocks fetch/XHR to localhost but not images):
//   GET /frame?name=<file>&data=<base64 jpeg>  -> writes frames/<file>.jpg
//   GET /frames.json                           -> lists what is there
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const framesDir = path.join(root, "frames");
if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (url.pathname === "/frame") {
      const name = (url.searchParams.get("name") || "frame").replace(/[^a-z0-9_.-]/gi, "_");
      const data = url.searchParams.get("data") || "";
      fs.writeFileSync(path.join(framesDir, name + ".jpg"), Buffer.from(data, "base64"));
      res.writeHead(200, { "Content-Type": "image/gif", "Cache-Control": "no-store", ...cors });
      res.end(pixel);
      return;
    }
    // POST /save?name=<file> with a data URL body -> shots/<file>.png (same
    // origin as the lab page, so no CORS in the way).
    if (url.pathname === "/save" && req.method === "POST") {
      const name = (url.searchParams.get("name") || "shot").replace(/[^a-z0-9_.-]/gi, "_");
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const b64 = body.split(",")[1] || "";
        const dir = path.join(root, "shots");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, name + ".png"), Buffer.from(b64, "base64"));
        res.writeHead(200, { "Content-Type": "text/plain", ...cors });
        res.end("saved " + name);
      });
      return;
    }
    if (url.pathname === "/frames.json") {
      res.writeHead(200, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify(fs.readdirSync(framesDir)));
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", ...cors });
    fs.createReadStream(file).pipe(res);
  })
  .listen(8098, () => console.log("pose lab on http://localhost:8098/pose-lab.html"));
