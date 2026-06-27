import os
import asyncio
from mcp.server.models import InitializationOptions
import mcp.server.stdio
from mcp.server import Server, Notification
from mcp.types import Tool, TextContent

# Initialize the MCP Server named 'log-reader-server'
server = Server("log-reader-server")

LOG_FILE = "logs_stream.log"
last_position = 0

# Initialize file pointer to the end of the file on startup so we only capture new logs
if os.path.exists(LOG_FILE):
    last_position = os.path.getsize(LOG_FILE)

@server.list_tools()
async def handle_list_tools():
    """List available tools to the AI Agent"""
    return [
        Tool(
            name="read_new_logs",
            description="Reads the newly appended log lines from the server log stream since the last check.",
            inputSchema={
                "type": "object",
                "properties": {} # No inputs needed
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict):
    global last_position
    
    if name != "read_new_logs":
        raise ValueError(f"Unknown tool: {name}")
        
    if not os.path.exists(LOG_FILE):
        return [TextContent(type="text", text="Error: Log file logs_stream.log does not exist yet. Please run the mock_log_generator first.")]
        
    # Open file, seek to the last read position, and read new lines
    with open(LOG_FILE, "r") as f:
        f.seek(last_position)
        new_lines = f.readlines()
        # Update our last read pointer
        last_position = f.tell()
        
    if not new_lines:
        return [TextContent(type="text", text="No new logs found since the last check.")]
        
    logs_content = "".join(new_lines)
    return [TextContent(type="text", text=logs_content)]

async def main():
    # Run the server using Standard Input/Output communication
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="log-reader-server",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=Notification(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
