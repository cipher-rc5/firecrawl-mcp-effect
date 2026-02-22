#!/usr/bin/env bash
# Setup script for Claude Desktop MCP integration

set -e

echo " Firecrawl MCP - Claude Desktop Setup"
echo "========================================"
echo ""

# Detect OS and config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CONFIG_DIR="$HOME/.config/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    CONFIG_DIR="$APPDATA/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
else
    echo " Unsupported OS: $OSTYPE"
    exit 1
fi

echo " Detected config path: $CONFIG_FILE"
echo ""

# Get project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STDIO_SERVER="$PROJECT_DIR/src/stdio-server.ts"

echo " Project directory: $PROJECT_DIR"
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo " Bun is not installed!"
    echo ""
    echo "Install Bun first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    echo ""
    exit 1
fi

echo " Bun found: $(bun --version)"
echo ""

# Check if .env exists and has API key
if [[ -f "$PROJECT_DIR/.env" ]]; then
    if grep -q "^FIRECRAWL_API_KEY=" "$PROJECT_DIR/.env"; then
        echo " .env file found with FIRECRAWL_API_KEY"
        USE_ENV=true
    else
        echo "  .env exists but no FIRECRAWL_API_KEY found"
        USE_ENV=false
    fi
else
    echo "  No .env file found"
    USE_ENV=false
fi
echo ""

# Ask for API key if not in .env
if [[ "$USE_ENV" == false ]]; then
    echo " Enter your Firecrawl API key (or press Enter to skip):"
    read -r FIRECRAWL_KEY
    echo ""
fi

# Create config directory if it doesn't exist
mkdir -p "$CONFIG_DIR"

# Generate MCP config
if [[ "$USE_ENV" == true ]]; then
    MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "$STDIO_SERVER"
      ]
    }
  }
}
EOF
)
else
    if [[ -n "$FIRECRAWL_KEY" ]]; then
        MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "$STDIO_SERVER"
      ],
      "env": {
        "FIRECRAWL_API_KEY": "$FIRECRAWL_KEY"
      }
    }
  }
}
EOF
)
    else
        echo "  No API key provided. You'll need to add it manually to:"
        echo "   $CONFIG_FILE"
        MCP_CONFIG=$(cat <<EOF
{
  "mcpServers": {
    "firecrawl": {
      "command": "bun",
      "args": [
        "run",
        "$STDIO_SERVER"
      ],
      "env": {
        "FIRECRAWL_API_KEY": "your-api-key-here"
      }
    }
  }
}
EOF
)
    fi
fi

# Backup existing config if it exists
if [[ -f "$CONFIG_FILE" ]]; then
    BACKUP_FILE="$CONFIG_FILE.backup.$(date +%s)"
    echo " Backing up existing config to: $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo ""
fi

# Write config
echo "$MCP_CONFIG" > "$CONFIG_FILE"

echo " Configuration written to: $CONFIG_FILE"
echo ""
echo " Config preview:"
cat "$CONFIG_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Desktop completely (Quit then reopen)"
echo "  2. Test by asking: 'Can you scrape https://example.com?'"
echo ""
echo "If tools don't appear:"
echo "  - Check Claude logs: tail -f ~/Library/Logs/Claude/mcp*.log"
echo "  - Test manually: echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}' | bun run stdio"
echo ""
echo "Documentation: $PROJECT_DIR/CLAUDE-DESKTOP-QUICKSTART.md"
echo ""
