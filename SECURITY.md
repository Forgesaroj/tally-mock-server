# Security policy

## Safe use

The command line server binds only to `127.0.0.1`. It has no authentication
because it is intended for local development. Do not expose it through a
tunnel, reverse proxy, container port mapping, or public network interface.
When using the programmatic `createMockServer()` API, bind the returned server
to `127.0.0.1` yourself.

Request bodies are read only to enforce a size limit. They are not parsed,
stored, logged, or included in responses. Use synthetic data; do not send live
company, customer, or financial information to a test service.

## Reporting a vulnerability

Please do not post credentials, private XML payloads, or customer data in a
public issue. Report the affected version and a minimal synthetic reproduction.
