#!/usr/bin/env bash
# Test SSE endpoint for LM Studio compatibility

set -e

echo "Testing SSE endpoint..."
echo ""

# Test initialize request with SSE Accept header
echo "1. Testing initialize with SSE Accept header:"
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | head -20

echo ""
echo ""

# Test tools/list with SSE
echo "2. Testing tools/list with SSE Accept header:"
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | head -20

echo ""
echo ""
echo " SSE endpoint test complete!"
echo "You should see 'Content-Type: text/event-stream' responses above."
