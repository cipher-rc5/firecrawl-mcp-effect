#!/usr/bin/env bash
# Verify all CI checks pass locally before pushing

set -e

echo "🔍 Verifying CI Pipeline"
echo "========================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

run_check() {
    local name="$1"
    local command="$2"
    
    echo -n "⏳ ${name}... "
    
    if eval "$command" > /tmp/ci-check.log 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo ""
        echo "Error output:"
        cat /tmp/ci-check.log | head -20
        echo ""
        FAILED=1
        return 1
    fi
}

# Run all CI checks
run_check "Format check" "bun run fmt:check"
run_check "Type check" "bun run typecheck"
run_check "Tests" "bun test --silent"

# Smoke tests need special handling (starts server)
echo -n "⏳ Smoke tests... "

# Run smoke tests in background with process management
bun run smoke > /tmp/smoke.log 2>&1 &
SMOKE_PID=$!

# Wait up to 15 seconds
SECONDS_WAITED=0
while [ $SECONDS_WAITED -lt 15 ]; do
    if ! kill -0 $SMOKE_PID 2>/dev/null; then
        # Process finished
        break
    fi
    sleep 1
    SECONDS_WAITED=$((SECONDS_WAITED + 1))
done

# Kill if still running
if kill -0 $SMOKE_PID 2>/dev/null; then
    kill $SMOKE_PID 2>/dev/null
    wait $SMOKE_PID 2>/dev/null
fi

# Check results
if grep -q "All smoke checks passed" /tmp/smoke.log; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "Smoke tests didn't complete successfully"
    cat /tmp/smoke.log | tail -20
    FAILED=1
fi

echo ""
echo "========================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All CI checks passed!${NC}"
    echo ""
    echo "You can safely push your changes:"
    echo "  git add ."
    echo "  git commit -m \"your message\""
    echo "  git push"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some CI checks failed${NC}"
    echo ""
    echo "Please fix the issues above before pushing."
    echo ""
    exit 1
fi
