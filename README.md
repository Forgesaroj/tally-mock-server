# Tally Mock Server

A small, local HTTP mock for testing software that sends XML to TallyPrime. It returns deterministic XML fixtures so you can exercise your client's success, rejection, empty-export, and transport-error paths without a running Tally installation.

**It is a test response simulator. It does not validate Tally XML, reproduce accounting rules, or guarantee compatibility with every TallyPrime version.**

## Quick start

Requires Node.js 20 or newer. There are no runtime dependencies.

```sh
git clone https://github.com/Forgesaroj/tally-mock-server.git
cd tally-mock-server
npm start
```

The command line server listens only on `http://127.0.0.1:9000`.

```sh
curl http://127.0.0.1:9000/health
curl http://127.0.0.1:9000/scenarios
curl -i -X POST 'http://127.0.0.1:9000/?scenario=import-success' \
  -H 'Content-Type: text/xml' \
  --data '<ENVELOPE><HEADER><TALLYREQUEST>Import</TALLYREQUEST></HEADER></ENVELOPE>'
```

If port 9000 is busy, choose another local port:

```sh
npm start -- --port 19000
```

## Scenarios

Send a request to `/` with XML content. Select a fixture with the `scenario` query parameter or `X-Tally-Mock-Scenario` header. The default is `import-success`.

| Scenario | HTTP status | Fixture behavior |
| --- | ---: | --- |
| `import-success` | 200 | One created record, zero errors |
| `import-rejected` | 200 | One import error and a synthetic line error |
| `export-empty` | 200 | Successful response with an empty data section |
| `export-sample` | 200 | One synthetic demo ledger in the response |
| `server-error` | 503 | Simulated transport/server failure |

Health and discovery endpoints:

- `GET /health` returns a small JSON health response.
- `GET /scenarios` returns available fixture names.

## Test a client

Point the client's Tally endpoint at `http://127.0.0.1:9000`. For example, a client can send its normal XML request and select an error fixture during a test:

```js
const response = await fetch("http://127.0.0.1:9000/?scenario=import-rejected", {
  method: "POST",
  headers: { "content-type": "text/xml" },
  body: xmlRequest
});
const responseXml = await response.text();
```

With [`@forgesaroj/tally-xml-kit`](https://github.com/Forgesaroj/tally-xml-kit), pass `responseXml` to `parseTallyResponse` to exercise response handling. The mock does not need to share or import that package.

## Limits and safety

- The request body is consumed only to enforce a size limit. It is not parsed, stored, logged, or reflected in the response.
- The default maximum request size is 1,000,000 bytes. Change it with `--max-body-bytes`.
- The command line server binds to loopback only. The programmatic API returns an unbound Node server; bind it to `127.0.0.1`. It has no authentication and must not be exposed to a network.
- Fixtures use synthetic data and are deliberately small. They are not a golden master of TallyPrime output.
- Requests with the wrong content type, empty body, unknown path, unknown scenario, or oversized body receive an HTTP error.

See [SECURITY.md](SECURITY.md) before using this on a shared machine.

## Development

```sh
npm test
npm run check
```

The test suite uses Node's built-in test runner. CI runs tests and syntax checks on pushes and pull requests.

## License

MIT. See [LICENSE](LICENSE).
