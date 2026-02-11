param(
  [Parameter(Mandatory = $true)]
  [string]$OrganizationId,

  [int]$KeyExpiryHours = 720,

  [switch]$DisableKeyCreation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-GCloud {
  $null = Get-Command gcloud -ErrorAction Stop
}

function Set-FileContentUtf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

Test-GCloud

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$policyDir = Join-Path $baseDir "org-policies"

$expiryPolicyPath = Join-Path $policyDir "iam.serviceAccountKeyExpiryHours.yaml"
$disablePolicyPath = Join-Path $policyDir "iam.managed.disableServiceAccountKeyCreation.yaml"

$expiryPolicy = @"
name: organizations/$OrganizationId/policies/iam.serviceAccountKeyExpiryHours
spec:
  rules:
    - values:
        allowedValues:
          - "${KeyExpiryHours}h"
"@

Set-FileContentUtf8NoBom -Path $expiryPolicyPath -Content $expiryPolicy

Write-Host "Applying iam.serviceAccountKeyExpiryHours = ${KeyExpiryHours}h"
& gcloud org-policies set-policy $expiryPolicyPath | Out-Null
Write-Host "Applied: constraints/iam.serviceAccountKeyExpiryHours"

if ($DisableKeyCreation) {
  $disablePolicy = @"
name: organizations/$OrganizationId/policies/iam.managed.disableServiceAccountKeyCreation
spec:
  rules:
    - enforce: true
"@
  Set-FileContentUtf8NoBom -Path $disablePolicyPath -Content $disablePolicy

  Write-Host "Applying managed service account key creation disablement"
  & gcloud org-policies set-policy $disablePolicyPath | Out-Null
  Write-Host "Applied: constraints/iam.managed.disableServiceAccountKeyCreation"
} else {
  Write-Host "Skipped disablement policy. Re-run with -DisableKeyCreation to enforce."
}

