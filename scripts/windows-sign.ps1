# Windows Code Signing Script
# Called by Tauri via signCommand with file path as first argument
# Supports cloud HSM workflows via base64-encoded PFX certificate
#
# SECURITY NOTE: The PFX certificate is temporarily written to a temp file
# (password-protected, not plaintext) for Import-PfxCertificate. The file
# is cleaned up in the finally block. GitHub Actions runners are ephemeral
# and destroyed after each job, limiting the exposure window.
#
# PATH NOTE: signCommand in tauri.conf.json uses a relative path resolved
# from the CWD of the Tauri CLI process. In CI (tauri-action with
# --project-path), CWD is the workspace root where this script lives.
# For local builds, use: npm run tauri build -- --no-sign

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

# Exit gracefully if no certificate configured (AC-5)
if (-not $env:WINDOWS_CERTIFICATE) {
    Write-Host "No WINDOWS_CERTIFICATE environment variable found - skipping code signing"
    Write-Host "This is expected for PR builds and development builds."
    exit 0
}

# Verify file exists
if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

Write-Host "Signing file: $FilePath"

# Decode base64 certificate and save to temporary PFX file
$pfxBytes = [System.Convert]::FromBase64String($env:WINDOWS_CERTIFICATE)
$pfxPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName() + ".pfx")

try {
    # Write PFX to temporary file
    [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
    Write-Host "Certificate decoded to temporary file"

    # Import certificate to CurrentUser\My store
    $certPassword = ConvertTo-SecureString -String $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force
    $cert = Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation Cert:\CurrentUser\My -Password $certPassword -Exportable

    if (-not $cert) {
        Write-Error "Failed to import certificate"
        exit 1
    }

    Write-Host "Certificate imported with thumbprint: $($cert.Thumbprint)"

    # Determine signtool path
    $signtoolPath = $env:TAURI_WINDOWS_SIGNTOOL_PATH
    if (-not $signtoolPath) {
        # Default Windows SDK paths
        $possiblePaths = @(
            "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe",
            "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe",
            "${env:ProgramFiles(x86)}\Windows Kits\10\bin\x64\signtool.exe"
        )

        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $signtoolPath = $path
                break
            }
        }

        if (-not $signtoolPath) {
            Write-Error "signtool.exe not found. Install Windows SDK or set TAURI_WINDOWS_SIGNTOOL_PATH"
            exit 1
        }
    }

    Write-Host "Using signtool: $signtoolPath"

    # Sign the file using RFC 3161 timestamping with SHA-256
    # /fd sha256 - File digest algorithm
    # /tr - RFC 3161 timestamp URL
    # /td sha256 - Timestamp digest algorithm
    # /sha1 - Certificate thumbprint
    $timestampUrl = "http://timestamp.digicert.com"

    & $signtoolPath sign `
        /fd sha256 `
        /tr $timestampUrl `
        /td sha256 `
        /sha1 $cert.Thumbprint `
        /v `
        $FilePath

    if ($LASTEXITCODE -ne 0) {
        Write-Error "signtool failed with exit code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    Write-Host "File signed successfully"

} finally {
    # Cleanup: Remove certificate from store and delete temporary PFX
    if ($cert) {
        Write-Host "Removing certificate from store: $($cert.Thumbprint)"
        Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $pfxPath) {
        Write-Host "Deleting temporary PFX file"
        Remove-Item -Path $pfxPath -Force -ErrorAction SilentlyContinue
    }

    Write-Host "Cleanup complete - no private key material left on disk"
}

exit 0
