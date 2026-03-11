# Start-WorkspaceMCP.ps1
# Launches the Google Workspace MCP server on port 8000 (streamable-http transport)
# Run once per session; Cursor auto-connects via ~/.cursor/mcp.json

$env:GOOGLE_OAUTH_CLIENT_ID     = "YOUR_GOOGLE_CLIENT_ID"
$env:GOOGLE_OAUTH_CLIENT_SECRET = "YOUR_GOOGLE_CLIENT_SECRET"
$env:USER_GOOGLE_EMAIL          = "operator@gmail.com"
$env:MCP_SINGLE_USER_MODE       = "1"
$env:OAUTHLIB_INSECURE_TRANSPORT = "1"
$env:OAUTHLIB_RELAX_TOKEN_SCOPE  = "1"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$scriptDir\.venv\Scripts\python.exe" "$scriptDir\main.py" --transport streamable-http --single-user
