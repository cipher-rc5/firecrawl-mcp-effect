#!/usr/bin/env bash
# Test Claude Desktop compatibility for stdio transport

set -e

echo "🧪 Testing Claude Desktop Compatibility"
echo "========================================"
echo ""

cd "$(dirname "$0")/.."

# Test 1: Parse error should have numeric id
echo "1. Testing parse error response (invalid JSON)..."
RESULT=$(echo 'invalid json' | bun run stdio 2>/dev/null)
ID=$(echo "$RESULT" | jq -r '.id')
if [[ "$ID" == "0" ]]; then
    echo "   ✅ Parse error uses id: 0 (not null)"
else
    echo "   ❌ Parse error has id: $ID (expected 0)"
    exit 1
fi
echo ""

# Test 2: Invalid request should extract ID if present
echo "2. Testing invalid request with ID extraction..."
RESULT=$(echo '{"id":42,"foo":"bar"}' | bun run stdio 2>/dev/null)
ID=$(echo "$RESULT" | jq -r '.id')
if [[ "$ID" == "42" ]]; then
    echo "   ✅ Invalid request preserves id: 42"
else
    echo "   ❌ Invalid request has id: $ID (expected 42)"
    exit 1
fi
echo ""

# Test 3: Valid initialize should work
echo "3. Testing valid initialize request..."
RESULT=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio 2>/dev/null)
PROTO=$(echo "$RESULT" | jq -r '.result.protocolVersion')
if [[ "$PROTO" == "2024-11-05" ]]; then
    echo "   ✅ Initialize returns protocol: $PROTO"
else
    echo "   ❌ Initialize returns protocol: $PROTO (expected 2024-11-05)"
    exit 1
fi
echo ""

# Test 4: Response IDs should never be null
echo "4. Testing that error responses never use null ID..."
# Test multiple error scenarios
ERRORS=(
    'not-json'
    '{"method":"foo"}'
    '{"jsonrpc":"1.0","id":3,"method":"test"}'
)

for ERROR_INPUT in "${ERRORS[@]}"; do
    RESULT=$(echo "$ERROR_INPUT" | bun run stdio 2>/dev/null)
    ID=$(echo "$RESULT" | jq -r '.id')
    if [[ "$ID" == "null" ]]; then
        echo "   ❌ Found null ID in error response for input: $ERROR_INPUT"
        exit 1
    fi
done
echo "   ✅ No error responses use null ID"
echo ""

# Test 5: Check stderr protocol version
echo "5. Testing stderr protocol version..."
STDERR=$(echo '{}' | bun run stdio 2>&1 >/dev/null | grep "Protocol:")
if echo "$STDERR" | grep -q "2024-11-05"; then
    echo "   ✅ Stderr shows correct protocol version"
else
    echo "   ❌ Stderr protocol version: $STDERR"
    exit 1
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All Claude Desktop compatibility tests passed!"
echo ""
echo "Your stdio server is compatible with Claude Desktop."
echo "If you're still seeing errors, check:"
echo "  - Claude Desktop logs: ~/Library/Logs/Claude/mcp*.log"
echo "  - Config file syntax: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo ""
