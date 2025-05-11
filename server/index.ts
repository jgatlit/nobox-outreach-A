import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startAirtableServer, isAirtableConfigured } from "./airtable";
import { startAllSchedulers } from "./scheduler";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Start the Airtable MCP server if configured
  if (isAirtableConfigured()) {
    log('Airtable environment variables detected, initializing MCP server...', 'airtable');
    try {
      const serverStatus = await startAirtableServer();
      log(`Airtable MCP server status: ${JSON.stringify(serverStatus)}`, 'airtable');
      
      if (serverStatus && serverStatus.status === 'running') {
        // Type guard for running status
        const runningStatus = serverStatus as { status: 'running', port: number, server: any, startTime: string };
        log(`Successfully started Airtable MCP server on port ${runningStatus.port}`, 'airtable');
      } else if (serverStatus && serverStatus.status === 'fallback_to_direct_client') {
        // Type guard for fallback status
        const fallbackStatus = serverStatus as { status: 'fallback_to_direct_client', error: any, stack: any, fallbackTime: string };
        log('Using direct Airtable client due to MCP server initialization failure', 'airtable');
        log(`MCP server error: ${fallbackStatus.error}`, 'airtable');
      } else {
        log(`Unexpected Airtable server status: ${serverStatus?.status || 'unknown'}`, 'airtable');
      }
    } catch (error: any) {
      log(`Error initializing Airtable MCP server: ${error?.message || 'Unknown error'}`, 'airtable');
    }
  } else {
    log('Airtable not configured. Add an Airtable Personal Access Token (PAT) as AIRTABLE_API_KEY and AIRTABLE_BASE_ID to use Airtable integration.', 'airtable');
  }

  const server = await registerRoutes(app);
  
  // Start the schedulers (including lead sync)
  if (isAirtableConfigured()) {
    log('Starting schedulers for background tasks...', 'scheduler');
    startAllSchedulers();
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
