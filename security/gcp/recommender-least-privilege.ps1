param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [switch]$IncludeApplied
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

Test-GCloud

Write-Host "Fetching IAM least-privilege recommendations for project '$ProjectId'..."

$location = "global"
$recommenderId = "google.iam.policy.Recommender"
$parent = "projects/$ProjectId/locations/$location/recommenders/$recommenderId"

$recommendations = Invoke-GCloudJson -Args @(
  "recommender", "recommendations", "list",
  "--project=$ProjectId",
  "--location=$location",
  "--recommender=$recommenderId"
)

if (-not $recommendations -or $recommendations.Count -eq 0) {
  Write-Host "No IAM policy recommendations available."
  exit 0
}

$filtered = @()
foreach ($rec in $recommendations) {
  $stateInfo = $rec.stateInfo
  $state = if ($stateInfo -and $stateInfo.state) { $stateInfo.state } else { "ACTIVE" }
  if (-not $IncludeApplied -and $state -ne "ACTIVE") { continue }

  $isServiceAccountTarget = $false
  $description = ""
  if ($rec.description) { $description = $rec.description }

  foreach ($opGroup in $rec.content.operationGroups) {
    foreach ($op in $opGroup.operations) {
      if ($op.path -and $op.path -match "serviceAccount:") {
        $isServiceAccountTarget = $true
      }
    }
  }

  if ($isServiceAccountTarget) {
    $filtered += [pscustomobject]@{
      name = $rec.name
      state = $state
      primaryImpact = $rec.primaryImpact.category
      priority = $rec.priority
      description = $description
    }
  }
}

if ($filtered.Count -eq 0) {
  Write-Host "No active service-account least-privilege recommendations found."
  exit 0
}

Write-Host ""
$filtered | Sort-Object priority | Format-Table -AutoSize

Write-Host ""
Write-Host "To inspect a recommendation:"
Write-Host "gcloud recommender recommendations describe RECOMMENDATION_NAME --project=$ProjectId --location=$location --recommender=$recommenderId"
Write-Host ""
Write-Host "To apply one (after review):"
Write-Host "gcloud recommender recommendations mark-claimed RECOMMENDATION_NAME --project=$ProjectId --location=$location --recommender=$recommenderId --etag=ETAG"
Write-Host "gcloud recommender recommendations mark-succeeded RECOMMENDATION_NAME --project=$ProjectId --location=$location --recommender=$recommenderId --etag=ETAG"

