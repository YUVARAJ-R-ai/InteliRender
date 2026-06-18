# IntelliRender MCP Server

A plug-and-play MCP server that auto-exposes Python tools to the IntelliRender chat agent via the [MCP streamable-HTTP transport](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/#streamable-http-transport).

## How it works

1. The server starts and auto-imports every module inside `tools/`.
2. Any function decorated with `@mcp.tool()` is registered as an MCP tool.
3. The Next.js agent route reads `MCP_SERVER_URL` and auto-connects — no manual registration needed.

## Adding a new tool

Create (or edit) any `.py` file in `tools/`:

```python
from main import mcp

@mcp.tool()
def my_tool(input: str) -> str:
    """Describe what the tool does — this becomes the tool description the model sees."""
    return input.upper()
```

Then restart the container:

```bash
docker compose restart mcp-server
```

The new tool is immediately available in every chat session — no Next.js restart required.

## Running locally (without Docker)

```bash
cd services/mcp-server
pip install -r requirements.txt
python main.py
```

Set in `.env.local`:

```
MCP_SERVER_URL=http://localhost:8001/mcp
```

## Running with Docker Compose

`MCP_SERVER_URL` is already wired from `docker-compose.yml`. Just run:

```bash
docker compose up --build
```
