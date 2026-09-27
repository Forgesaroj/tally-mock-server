import test from "node:test";
import assert from "node:assert/strict";
import { createMockServer, listScenarios } from "../src/server.js";

const xmlHeaders = { "content-type": "text/xml; charset=utf-8" };
const requestXml = "<ENVELOPE><HEADER><TALLYREQUEST>Import</TALLYREQUEST></HEADER></ENVELOPE>";

async function withServer(run, options) {
  const server = createMockServer(options);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("lists stable scenarios", () => {
  assert.deepEqual(listScenarios(), [
    "import-success", "import-rejected", "export-empty", "export-sample", "server-error"
  ]);
});

test("health endpoint responds without Tally setup", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", service: "tally-mock-server" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("default POST returns a parseable import success fixture", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl, { method: "POST", headers: xmlHeaders, body: requestXml });
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/xml/);
    assert.match(xml, /<CREATED>1<\/CREATED>/);
    assert.match(xml, /<ERRORS>0<\/ERRORS>/);
  });
});

test("selects a response scenario through query or header", async () => {
  await withServer(async (baseUrl) => {
    const rejected = await fetch(`${baseUrl}/?scenario=import-rejected`, {
      method: "POST", headers: xmlHeaders, body: requestXml
    });
    const rejectedXml = await rejected.text();
    assert.equal(rejected.status, 200);
    assert.match(rejectedXml, /<ERRORS>1<\/ERRORS>/);
    assert.match(rejectedXml, /unknown ledger/);

    const sample = await fetch(baseUrl, {
      method: "POST", headers: { ...xmlHeaders, "x-tally-mock-scenario": "export-sample" }, body: requestXml
    });
    assert.match(await sample.text(), /Demo Customer/);
  });
});

test("returns transport errors with XML for the server-error scenario", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/?scenario=server-error`, {
      method: "POST", headers: xmlHeaders, body: requestXml
    });
    assert.equal(response.status, 503);
    assert.match(await response.text(), /simulated server unavailable/);
  });
});

test("rejects unknown scenarios without echoing request data", async () => {
  await withServer(async (baseUrl) => {
    const secret = "synthetic-private-value";
    const response = await fetch(`${baseUrl}/?scenario=../../secret`, {
      method: "POST", headers: xmlHeaders, body: `<DATA>${secret}</DATA>`
    });
    const body = await response.text();
    assert.equal(response.status, 400);
    assert.doesNotMatch(body, new RegExp(secret));
    assert.match(body, /Unknown scenario/);
  });
});

test("rejects wrong content type, empty body, and unknown route", async () => {
  await withServer(async (baseUrl) => {
    const wrongType = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(wrongType.status, 415);

    const empty = await fetch(baseUrl, { method: "POST", headers: xmlHeaders, body: "" });
    assert.equal(empty.status, 400);

    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
  });
});

test("enforces request size limit", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(baseUrl, {
      method: "POST", headers: xmlHeaders, body: `<DATA>${"x".repeat(100)}</DATA>`
    });
    assert.equal(response.status, 413);
  }, { maxBodyBytes: 24 });
});

test("rejects invalid body limits at construction time", () => {
  assert.throws(() => createMockServer({ maxBodyBytes: 0 }), /positive safe integer/);
  assert.throws(() => createMockServer({ maxBodyBytes: 1.5 }), /positive safe integer/);
});
