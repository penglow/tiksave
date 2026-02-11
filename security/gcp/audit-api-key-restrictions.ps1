param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-GCloud {
  $null = Get-Command gcloud -ErrorAction Stop
}

function Invoke-GCloudJson {
  param([string[]]$Args)
  $output = & gcloud @Args --format=json
  if (-not $output) { return @() }
  return $output | ConvertFrom-Json
}

function Has-AppRestriction {
  param($Restrictions)
  if (-not $Restrictions) { return $false }
  if ($Restrictions.browserKeyRestrictions -and $Restrictions.browserKeyRestrictions.allowedReferrers) { return $true }
  if ($Restrictions.serverKeyRestrictions -and $Restrictions.serverKeyRestrictions.allowedIps) { return $true }
  if ($Restrictions.androidKeyRestrictions -and $Restrictions.androidKeyRestrictions.allowedApplications) { return $true }
  if ($Restrictions.iosKeyRestrictions -and $Restrictions.iosKeyRestrictions.allowedBundleIds) { return $true }
  return $false
}

Test-GCloud

Write-Host "Auditing API key restrictions in project '$ProjectId'..."

$keys = Invoke-GCloudJson -Args @("services", "api-keys", "list", "--project=$ProjectId")

if (-not $keys -or $keys.Count -eq 0) {
  Write-Host "No API keys found."
  exit 0
}

$violations = @()

foreach ($key in $keys) {
  $restrictions = $key.restrictions
  $apiRestricted = $false

  if ($restrictions -and $restrictions.apiTargets -and $restrictions.apiTargets.Count -gt 0) {
    $apiRestricted = $true
  }

  $appRestricted = Has-AppRestriction -Restrictions $restrictions

  if (-not $apiRestricted -or -not $appRestricted) {
    $violations += [pscustomobject]@{
      displayName = $key.displayName
      uid = $key.uid
      apiRestriction = if ($apiRestricted) { "OK" } else { "MISSING" }
      appRestriction = if ($appRestricted) { "OK" } else { "MISSING" }
      name = $key.name
    }
  }
}

if ($violations.Count -eq 0) {
  Write-Host "All API keys have API and app/environment restrictions."
  exit 0
}

Write-Host ""
Write-Host "Unrestricted or partially restricted API keys:"
$violations | Sort-Object displayName | Format-Table -AutoSize

Write-Host ""
Write-Host "Remediation example:"
Write-Host "gcloud services api-keys update KEY_ID --project=$ProjectId --allowed-referrers=""https://example.com/*"" --api-target=service=maps-backend.googleapis.com"

