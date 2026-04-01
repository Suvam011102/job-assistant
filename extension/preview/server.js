const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PREVIEW_PORT || 4173);
const ROOT_DIR = path.resolve(__dirname, "..");
let previewVersion = Date.now();

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

function resolveRequestPath(urlPath) {
  const safePath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = safePath === "/" ? "/preview/preview.html" : safePath;
  const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return absolutePath;
}

try {
  fs.watch(ROOT_DIR, { recursive: true }, () => {
    previewVersion = Date.now();
  });
} catch (error) {
  console.warn("File watching is unavailable, auto-refresh disabled:", error.message);
}

const server = http.createServer((request, response) => {
  if ((request.url || "").startsWith("/__preview_version")) {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ version: previewVersion }));
    return;
  }

  const filePath = resolveRequestPath(request.url || "/");

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Preview server running at http://${HOST}:${PORT}/preview/preview.html`);
});
