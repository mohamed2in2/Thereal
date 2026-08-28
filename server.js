const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error occurred handling", req.url, err);
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });

    // Ensure Node.js keep-alive timeouts align with Nginx proxy keepalive (65s)
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    server.once("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(`> Code-UP server worker ready on http://${hostname}:${port}`);
      // Signal PM2 that the worker is fully initialized and ready to take traffic
      if (process.send) {
        process.send("ready");
      }
    });

    // Graceful shutdown handling
    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((err) => {
    console.error("Failed to prepare Next.js app:", err);
    process.exit(1);
  });
