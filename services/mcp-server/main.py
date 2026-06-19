import importlib
import pkgutil
from pathlib import Path

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("IntelliRender MCP Server")

# Auto-import every module under tools/ so their @mcp.tool() decorators fire.
# Skip *_stdio modules: those are standalone stdio MCP servers spawned per-request
# by the Next.js agent (e.g. Google Forms with per-user OAuth), not HTTP tools.
_tools_pkg = Path(__file__).parent / "tools"
for _mod in pkgutil.iter_modules([str(_tools_pkg)]):
    if _mod.name.endswith("_stdio"):
        continue
    importlib.import_module(f"tools.{_mod.name}")

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001, path="/mcp")
