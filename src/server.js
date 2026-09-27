import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

const fixturesDirectory = fileURLToPath(new URL("../fixtures/", import.meta.url));
const FIXTURES = Object.freeze({
  "import-success": { file: "import-success.xml", status: 200 },
  "import-rejected": { file: "import-rejected.xml", status: 200 },
  "export-empty": { file: "export-empty.xml", status: 200 },
  "export-sample": { file: "export-sample.xml", status: 200 },
  "server-error": { file: "server-error.xml", status: 503 }
});

const XML_TYPES = new Set(["application/xml", "text/xml"]);
const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export function listScenarios() {
  return Object.keys(FIXTURES);
}

export function createMockServer({ maxBodyBytes = DEFAULT_MAX_BODY_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1) {
    throw new TypeError("maxBodyBytes must be a positive safe integer");
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    setCommonHeaders(response);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { status: "ok", service: "tally-mock-server" });
    }

    if (request.method === "GET" && url.pathname === "/scenarios") {
      return sendJson(response, 200, { scenarios: listScenarios() });
    }

    if (request.method !== "POST" || url.pathname !== "/") {
      return sendJson(response, 404, { error: "Route not found" });
    }

    if (!isXmlContentType(request.headers["content-type"])) {
      return sendJson(response, 415, { error: "Content-Type must be application/xml or text/xml" });
    }

    let bytesRead;
    try {
      bytesRead = await consumeBody(request, maxBodyBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        response.setHeader("connection", "close");
        return sendJson(response, 413, { error: `Request body exceeds ${maxBodyBytes} bytes` });
      }
      return sendJson(response, 400, { error: "Could not read request body" });
    }

    if (bytesRead === 0) {
      return sendJson(response, 400, { error: "Request body must not be empty" });
    }

    const scenario = url.searchParams.get("scenario")
      ?? firstHeader(request.headers["x-tally-mock-scenario"])
      ?? "import-success";
    const fixture = FIXTURES[scenario];
    if (!fixture) {
      return sendJson(response, 400, { error: "Unknown scenario", available: listScenarios() });
    }

    const fixtureRoot = resolve(fixturesDirectory);
    const fixturePath = resolve(fixtureRoot, fixture.file);
    if (!fixturePath.startsWith(`${fixtureRoot}${sep}`)) {
      return sendJson(response, 500, { error: "Invalid fixture configuration" });
    }

    try {
      const xml = await readFile(fixturePath, "utf8");
      response.writeHead(fixture.status, {
        "content-type": "text/xml; charset=utf-8",
        "content-length": Buffer.byteLength(xml)
      });
      response.end(xml);
    } catch {
      sendJson(response, 500, { error: "Fixture could not be read" });
    }
  });
}

function isXmlContentType(value = "") {
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  return XML_TYPES.has(mediaType);
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function consumeBody(request, maxBytes) {
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new PayloadTooLargeError();
  }
  return size;
}

function setCommonHeaders(response) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("cache-control", "no-store");
}

function sendJson(response, status, body) {
  const json = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json)
  });
  response.end(json);
}

class PayloadTooLargeError extends Error {}
