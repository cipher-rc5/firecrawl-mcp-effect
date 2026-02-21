# Tests

This project uses Bun exclusively for test execution.

## Run all tests

```bash
bun test
```

## Unit tests

```bash
bun test tests/unit
```

## Integration tests

```bash
bun test tests/integration
```

## Coverage

```bash
bun test --coverage
```

## Smoke checks

Use Bun to run local smoke checks:

```bash
bun run smoke
```

Run integration tests:

```bash
bun test
```

Environment variables for the smoke script:

- `SMOKE_BASE_URL` (default: `http://127.0.0.1:3000`)
- `SMOKE_START_LOCAL` (default: `1`; set `0` to target an already-running server)
- `SMOKE_WAIT_MS` (default: `15000`)
