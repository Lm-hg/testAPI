# init-dev.ps1
# Démarre docker-compose, crée le bucket MinIO et lance le serveur dev dans une nouvelle fenêtre PowerShell

Write-Host "Starting docker-compose services..."
docker-compose up -d

function Wait-ForPort($host, $port, $timeoutSec = 60) {
    $end = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $end) {
        try {
            $sock = New-Object System.Net.Sockets.TcpClient
            $iar = $sock.BeginConnect($host, $port, $null, $null)
            $ok = $iar.AsyncWaitHandle.WaitOne(1000)
            if ($ok -and $sock.Connected) {
                $sock.Close()
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

Write-Host "Waiting for MinIO (localhost:9000)..."
if (-not (Wait-ForPort -host 'localhost' -port 9000 -timeoutSec 60)) {
    Write-Error "MinIO did not start in time"
    exit 2
}

Write-Host "Initializing bucket..."
$env:MINIO_ENDPOINT = 'http://localhost:9000'
$env:MINIO_ACCESS_KEY = 'minioadmin'
$env:MINIO_SECRET_KEY = 'minioadmin'
$env:S3_BUCKET = 'test-bucket'
node .\src\scripts\create_bucket.js

Write-Host "Launching server dev in a new PowerShell window..."
$startCmd = "`$env:USE_MINIO='true'; `$env:MINIO_ENDPOINT='http://localhost:9000'; `$env:MINIO_ACCESS_KEY='minioadmin'; `$env:MINIO_SECRET_KEY='minioadmin'; `$env:S3_BUCKET='test-bucket'; npm run dev"
Start-Process -FilePath powershell -ArgumentList "-NoExit","-Command",$startCmd

Write-Host "Init complete. Server will run in the new window."
