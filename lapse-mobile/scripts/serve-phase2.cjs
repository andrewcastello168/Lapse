const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(
  __dirname,
  process.env.UI_EXPORT_DIR ?? "../.expo/phase2-web",
);
http
  .createServer((req, res) => {
    let name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      file += ".html";
      if (!fs.existsSync(file))
        file = path.join(
          root,
          name.startsWith("/item/") ? "item/[id].html" : "index.html",
        );
    }
    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".ttf": "font/ttf",
      ".svg": "image/svg+xml",
    };
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file).pipe(res);
  })
  .listen(8082, "127.0.0.1", () =>
    console.log("Phase 2 static test server on 8082"),
  );
