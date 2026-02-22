#!/usr/bin/env bash
# Test stdio transport for LM Studio compatibility

set -e

echo "Testing stdio transport..."
echo ""

# Test 1: initialize
echo "1. Testing initialize:"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | bun run stdio 2>/dev/null | jq

echo ""
echo ""

# Test 2: tools/list
echo "2. Testing tools/list:"
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | bun run stdio 2>/dev/null | jq '.result.tools[] | {name, title}' | head -30

echo ""
echo " stdio transport test complete!"
echo "If you see JSON-RPC responses above, the stdio server is working correctly."
