# Contributing

1. Use a supported Node.js release (20 or newer).
2. Install dependencies if you add any; the current project has no runtime or
   development dependencies.
3. Run `npm test` and `npm run check`.
4. Keep fixture data synthetic. Do not add customer, company, or production
   accounting data.
5. Describe the scenario being tested and include the expected response shape.

The mock intentionally does not attempt to implement Tally accounting rules or
validate every possible Tally XML request.
