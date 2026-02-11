param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [int]$DormantDays = 30,

  [switch]$DisableDormantKeys,

  [switch]$DeleteDormantKeys
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($DisableDormantKeys -and $DeleteDormantKeys) {
  throw "Use either -DisableDormantKeys or -DeleteDormantKeys, not both."
}

function Test-GCloud {
  $null = Get-Command gcloud -ErrorAction Stop
}

function Invoke-GCloudJson {
  param([string[]]$Args)
  $output = & gcloud @Args --format=json
  if (-not $output) { return @() }
  return $output | ConvertFrom-Json
}

function Get-CutoffIso {
  param([int]$Days)
  return (Get-Date).ToUniversalTime().AddDays(-1 * $Days).ToString("yyyy-MM-ddTHH:mm:ssZ")
}

function Test-KeyActivity {
  param(
    [string]$ProjectId,
    [string]$KeyId,
    [string]$CutoffIso
  )

  # Best-effort signal from Cloud Audit Logs for service account key usage.
  $filter = @(
    "timestamp>=""$CutoffIso"""
    "protoPayload.authenticationInfo.serviceAccountKeyName:""$KeyId"""
  ) -join " AND "

  $logs = & gcloud logging read $filter --project=$ProjectId --limit=1 --format=json 2>$null
  return -not [string]::IsNullOrWhiteSpace($logs) -and $logs -ne "[]"
}

Test-GCloud

$cutoff = Get-CutoffIso -Days $DormantDays
Write-Host "Auditing user-managed service account keys in project '$ProjectId' (activity window: last $DormantDays days)..."

$serviceAccounts = Invoke-GCloudJson -Args @("iam", "service-accounts", "list", "--project=$ProjectId")

if (-not $serviceAccounts -or $serviceAccounts.Count -eq 0) {
  Write-Host "No service accounts found."
  exit 0
}

$dormant = @()

foreach ($sa in $serviceAccounts) {
  $email = $sa.email
  $keys = Invoke-GCloudJson -Args @(
    "iam", "service-accounts", "keys", "list",
    "--iam-account=$email",
    "--managed-by=user",
    "--project=$ProjectId"
  )

  if (-not $keys) { continue }

  foreach ($key in $keys) {
    $keyName = $key.name
    $keyId = ($keyName -split "/")[-1]
    $hasActivity = Test-KeyActivity -ProjectId $ProjectId -KeyId $keyId -CutoffIso $cutoff

    if (-not $hasActivity) {
      $dormant += [pscustomobject]@{
        serviceAccount = $email
        keyId = $keyId
        keyName = $keyName
        validAfterTime = $key.validAfterTime
        validBeforeTime = $key.validBeforeTime
      }
    }
  }
}

if ($dormant.Count -eq 0) {
  Write-Host "No dormant user-managed service account keys detected."
  exit 0
}

Write-Host ""
Write-Host "Dormant keys detected:"
$dormant | Format-Table -AutoSize

if ($DisableDormantKeys) {
  Write-Host ""
  Write-Host "Disabling dormant keys..."
  foreach ($row in $dormant) {
    & gcloud iam service-accounts keys disable $row.keyId --iam-account=$row.serviceAccount --project=$ProjectId | Out-Null
    Write-Host "Disabled: $($row.serviceAccount) / $($row.keyId)"
  }
}

if ($DeleteDormantKeys) {
  Write-Host ""
  Write-Host "Deleting dormant keys..."
  foreach ($row in $dormant) {
    & gcloud iam service-accounts keys delete $row.keyId --iam-account=$row.serviceAccount --project=$ProjectId --quiet | Out-Null
    Write-Host "Deleted: $($row.serviceAccount) / $($row.keyId)"
  }
}

