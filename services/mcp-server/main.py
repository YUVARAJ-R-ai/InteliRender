import importlib
import pkgutil
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# host/port/path are constructor settings in mcp>=1.8 — FastMCP.run() no longer
# accepts them as kwargs.
mcp = FastMCP(
    "IntelliRender MCP Server",
    host="0.0.0.0",
    port=8001,
    streamable_http_path="/mcp",
)

# Auto-import every module under tools/ so their @mcp.tool() decorators fire.
# Skip *_stdio modules: those are standalone stdio MCP servers spawned per-request
# by the Next.js agent (e.g. Google Forms with per-user OAuth), not HTTP tools.
_tools_pkg = Path(__file__).parent / "tools"
for _mod in pkgutil.iter_modules([str(_tools_pkg)]):
    if _mod.name.endswith("_stdio"):
        continue
    importlib.import_module(f"tools.{_mod.name}")

# NOTE: do NOT run this file directly (`python main.py`). The server is started
# via run.py so the tools (which `from main import mcp`) register on the SAME
# instance that is served. See run.py for the full explanation.
