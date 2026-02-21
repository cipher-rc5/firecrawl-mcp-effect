// file: scripts/smoke.ts
// description: Bun runtime smoke test script for local MCP endpoints

type Json = Record<string, unknown>;

const baseUrl = process.env['SMOKE_BASE_URL'] ?? 'http://127.0.0.1:3000';
const startLocalServer = process.env['SMOKE_START_LOCAL'] !== '0';
const maxWaitMs = Number(process.env['SMOKE_WAIT_MS'] ?? '15000');
const basePort = String(new URL(baseUrl).port || '3000');

let localServer: Bun.Subprocess | undefined;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message: string): never {
  console.error(`\n[smoke] FAIL: ${message}`);
  throw new Error(message);
}

async function requestJson(path: string, init?: RequestInit): Promise<{ status: number, json: Json }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  let json: Json = {};

  try {
    json = await response.json() as Json;
  } catch {
    fail(`Non-JSON response from ${path}`);
  }

  return { status: response.status, json };
}

async function waitForHealth(): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const { status, json } = await requestJson('/health');
      if (status === 200 && json['status'] === 'ok') {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(300);
  }

  fail(`Server did not become healthy within ${maxWaitMs}ms`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

async function runSmokeTests(): Promise<void> {
  console.log(`[smoke] Base URL: ${baseUrl}`);
  console.log(`[smoke] Start local server: ${startLocalServer}`);

  if (startLocalServer) {
    localServer = Bun.spawn(['bun', '--hot', 'src/server.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: basePort,
        CLOUD_SERVICE: 'false',
        FIRECRAWL_API_KEY: process.env['FIRECRAWL_API_KEY'] ?? 'fc-smoke-placeholder'
      },
      stdout: 'inherit',
      stderr: 'inherit'
    });
  }

  await waitForHealth();
  console.log('[smoke] health: OK');

  const initResp = await requestJson('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  });

  assert(initResp.status === 200, 'initialize did not return 200');
  assert(initResp.json['jsonrpc'] === '2.0', 'initialize response missing jsonrpc=2.0');
  assert(
    typeof initResp.json['result'] === 'object' && initResp.json['result'] !== null,
    'initialize result is missing'
  );
  console.log('[smoke] initialize: OK');

  const toolsListResp = await requestJson('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  });

  assert(toolsListResp.status === 200, 'tools/list did not return 200');
  const result = toolsListResp.json['result'];
  assert(typeof result === 'object' && result !== null, 'tools/list missing result object');
  const tools = (result as Json)['tools'];
  assert(Array.isArray(tools), 'tools/list missing tools array');
  assert(tools.length > 0, 'tools/list returned empty tools array');
  console.log(`[smoke] tools/list: OK (${tools.length} tools)`);

  const toolNotFoundResp = await requestJson('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    })
  });

  assert(toolNotFoundResp.status === 200, 'tools/call unknown tool did not return 200');
  const error = toolNotFoundResp.json['error'];
  assert(error !== undefined, 'tools/call unknown tool did not return error object');
  assert(typeof error === 'object' && error !== null, 'tools/call unknown tool returned invalid error object');
  assert((error as Json)['code'] === -32004, 'tools/call unknown tool did not return code -32004');
  assert(
    typeof (error as Json)['message'] === 'string' && String((error as Json)['message']).length > 0,
    'tools/call unknown tool missing message'
  );
  console.log('[smoke] tools/call unknown tool: OK');

  console.log('\n[smoke] All smoke checks passed.');
}

try {
  await runSmokeTests();
} finally {
  if (localServer !== undefined) {
    localServer.kill();
    await localServer.exited;
  }
}

export {};
