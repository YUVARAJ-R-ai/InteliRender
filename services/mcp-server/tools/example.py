"""
Example tools — delete or extend this file to add your own.
Each function decorated with @mcp.tool() is automatically registered.
"""
import platform
import subprocess
import sys
import textwrap

from main import mcp


@mcp.tool()
def get_system_info() -> dict:
    """Return basic info about the MCP server host (OS, Python version, CPU count)."""
    return {
        "os": platform.system(),
        "os_version": platform.version(),
        "python": sys.version,
        "machine": platform.machine(),
        "processor": platform.processor(),
    }


@mcp.tool()
def run_python_snippet(code: str) -> dict:
    """
    Execute a short, self-contained Python snippet and return its stdout/stderr.
    Use this for quick calculations, data transformations, or proof-of-concept code.
    The snippet runs in an isolated subprocess with a 10-second timeout.
    """
    try:
        result = subprocess.run(
            [sys.executable, "-c", textwrap.dedent(code)],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Snippet timed out after 10 seconds."}
    except Exception as e:
        return {"error": str(e)}
