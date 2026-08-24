# scripts/check-mcp-tunnel.ps1
# Helper script to test the local SSH tunnel and MCP endpoint connectivity

Write-Host "Checking local port 8000..." -ForegroundColor Cyan

$portCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue

if (-not $portCheck.TcpTestSucceeded) {
    Write-Host "❌ Port 8000 is NOT listening." -ForegroundColor Red
    Write-Host "Please start your SSH tunnel in a separate PowerShell window:" -ForegroundColor Yellow
    Write-Host 'ssh -i "path\to\your-key.pem" -N -L 8000:127.0.0.1:8000 ec2-user@13.63.210.114' -ForegroundColor White
    exit 1
}

Write-Host "✅ Port 8000 is listening! Testing MCP endpoint..." -ForegroundColor Green

try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/mcp" -Method Get -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ MCP endpoint responded successfully:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "⚠️ Port 8000 responded, but HTTP GET to /mcp returned:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Gray
    Write-Host "Note: FastMCP SSE endpoints expect POST/SSE streams. Connection is reachable!" -ForegroundColor Green
}
