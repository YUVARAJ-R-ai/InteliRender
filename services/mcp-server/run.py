"""Entrypoint for the HTTP MCP server.

The server MUST be started from a module other than main.py. The tool modules
register their @mcp.tool() decorators via `from main import mcp`. If main.py is
run directly (`python main.py`), it becomes the `__main__` module, so `from main
import mcp` inside the tools imports main *a second time* as a separate `main`
module — registering every tool on a different FastMCP instance than the one
`.run()` serves. The result: the server exposes ZERO tools.

Running via this entrypoint imports main once (as `main`), so the tools and the
served instance are the same object.
"""
from main import mcp

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
