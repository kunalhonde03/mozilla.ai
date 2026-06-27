import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    # Configure parameters to spawn our local MCP python module
    server_params = StdioServerParameters(
        command=".venv/Scripts/python",
        args=["-m", "mcp_log_reader"],
        env=None
    )
    
    print("Connecting to local MCP log-reader server...")
    try:
        async with stdio_client(server_params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                # Initialize connection with the server
                await session.initialize()
                
                # List the tools exposed by our server
                print("\nListing available tools:")
                tools_response = await session.list_tools()
                for tool in tools_response.tools:
                    print(f"- Tool Name: {tool.name}")
                    print(f"  Description: {tool.description}")
                    
                # Execute the 'read_new_logs' tool
                print("\nCalling tool 'read_new_logs'...")
                response = await session.call_tool("read_new_logs")
                
                print("\nServer Response:")
                for content in response.content:
                    print(content.text)
                    
    except Exception as e:
        print(f"\nAn error occurred during MCP testing: {e}")

if __name__ == "__main__":
    asyncio.run(main())
