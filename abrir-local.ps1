# =====================================================================
# abrir-local.ps1: sobe o painel em http://localhost:5173 (Windows)
# e abre no navegador. Não precisa instalar nada.
# Para parar: feche esta janela (ou Ctrl+C).
# No Mac/Linux use:  python3 -m http.server 5173   (e abra o endereço)
# =====================================================================
param([int]$Porta = 5173)

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Porta/")
$listener.Start()
Write-Host "Painel no ar em http://localhost:$Porta  (feche esta janela para parar)"
Start-Process "http://localhost:$Porta"

$tipos = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"; ".json" = "application/json"
  ".md" = "text/plain; charset=utf-8"; ".svg" = "image/svg+xml"; ".png" = "image/png"
  ".jpg" = "image/jpeg"; ".ico" = "image/x-icon"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $resp = $ctx.Response
  try {
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($caminho)) { $caminho = "index.html" }
    $arquivo = [System.IO.Path]::GetFullPath((Join-Path $raiz $caminho))
    if ($arquivo.StartsWith($raiz) -and (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($arquivo)
      $ext = [System.IO.Path]::GetExtension($arquivo).ToLower()
      $resp.ContentType = if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { "application/octet-stream" }
      $resp.Headers.Add("Cache-Control", "no-store")
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404")
      $resp.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $resp.StatusCode = 500
  } finally {
    $resp.Close()
  }
}
