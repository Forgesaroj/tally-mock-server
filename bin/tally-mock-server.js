#!/usr/bin/env node

import { createMockServer } from "../src/server.js";

const HELP = `Usage: tally-mock-server [--port <1-65535>] [--max-body-bytes <bytes>]

Start a local Tally XML response mock on 127.0.0.1.

Options:
  --port <number>            Port to listen on (default: 9000)
  --max-body-bytes <number>  Maximum request size (default: 1000000)
  --help                     Show this help
`;

function parseArgs(args) {
  const options = { port: 9000, maxBodyBytes: 1_000_000 };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg !== "--port" && arg !== "--max-body-bytes") {
      throw new Error(`Unknown option: ${arg}`);
    }
    const value = args[i + 1];
    if (!value || !/^\d+$/.test(value)) throw new Error(`${arg} requires a positive integer`);
    i += 1;
    if (arg === "--port") options.port = Number(value);
    else options.maxBodyBytes = Number(value);
  }
  if (!Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("--port must be between 1 and 65535");
  }
  if (!Number.isSafeInteger(options.maxBodyBytes) || options.maxBodyBytes < 1) {
    throw new Error("--max-body-bytes must be a positive safe integer");
  }
  return options;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}\n\nRun tally-mock-server --help for usage.`);
  process.exitCode = 2;
} 

if (options?.help) {
  console.log(HELP);
} else if (options) {
  const server = createMockServer({ maxBodyBytes: options.maxBodyBytes });
  server.on("error", (error) => {
    console.error(`Server error: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(options.port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`Tally Mock Server listening on http://127.0.0.1:${address.port}`);
    console.log("Scenarios: /?scenario=import-success, import-rejected, export-empty, export-sample, server-error");
    console.log("Request bodies are not logged or stored. Press Ctrl+C to stop.");
  });
  const stop = () => server.close(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
