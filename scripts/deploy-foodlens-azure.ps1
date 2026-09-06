[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SubscriptionId,

  [string]$ResourceGroup = "rg-hcinov-compliance-centralus",
  [string]$EnvironmentName = "cae-hcinov-centralus",
  [string]$RegistryName = "acrhcinovcompliance",
  [string]$AppName = "ca-foodlens",
  [string]$PullIdentityName = "id-foodlens-acr-pull",
  [string]$WorkloadProfileName = "Consumption",
  [string]$ImageRepository = "foodlens",

  [ValidatePattern("^[a-z0-9][a-z0-9._-]{0,127}$")]
  [string]$ImageTag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-AzureJson {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $raw = & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed: az $($Arguments -join ' ')"
  }
  return $raw | ConvertFrom-Json
}

function Assert-LastExitCode {
  param([Parameter(Mandatory = $true)][string]$Operation)

  if ($LASTEXITCODE -ne 0) {
    throw "$Operation failed with exit code $LASTEXITCODE."
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$identityTemplate = Join-Path $repoRoot "infra\azure\identity.bicep"
$appTemplate = Join-Path $repoRoot "infra\azure\container-app.bicep"

$account = Invoke-AzureJson -Arguments @("account", "show", "--output", "json")
if ([string]$account.id -ne $SubscriptionId) {
  & az account set --subscription $SubscriptionId
  Assert-LastExitCode -Operation "Selecting Azure subscription"
  $account = Invoke-AzureJson -Arguments @("account", "show", "--output", "json")
}

$environmentResourceId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.App/managedEnvironments/$EnvironmentName"
$environmentInfo = Invoke-AzureJson -Arguments @(
  "resource", "show",
  "--ids", $environmentResourceId,
  "--api-version", "2026-01-01",
  "--output", "json"
)
$location = [string]$environmentInfo.location
if (-not $location) {
  throw "The existing Container Apps environment did not report a location."
}

$workloadProfiles = @($environmentInfo.properties.workloadProfiles)
if ($workloadProfiles.Count -gt 0) {
  $workloadMatch = $workloadProfiles | Where-Object { [string]$_.name -eq $WorkloadProfileName }
  if (-not $workloadMatch) {
    $availableNames = ($workloadProfiles | ForEach-Object { [string]$_.name }) -join ", "
    throw "Workload profile '$WorkloadProfileName' was not found. Available profiles: $availableNames"
  }
}

$registry = Invoke-AzureJson -Arguments @(
  "acr", "show",
  "--resource-group", $ResourceGroup,
  "--name", $RegistryName,
  "--output", "json"
)

$armAuthentication = Invoke-AzureJson -Arguments @(
  "acr", "config", "authentication-as-arm", "show",
  "--registry", $RegistryName,
  "--output", "json"
)
if ([string]$armAuthentication.status -ne "enabled") {
  throw "Managed-identity image pulls require ACR authentication-as-arm to be enabled. This script will not mutate the shared registry setting automatically."
}

$registryRoleMode = [string]$registry.roleAssignmentMode
$pullRoleName = if ($registryRoleMode -match "abac") {
  "Container Registry Repository Reader"
} else {
  "AcrPull"
}
$pullRole = Invoke-AzureJson -Arguments @(
  "role", "definition", "list",
  "--name", $pullRoleName,
  "--query", "[0]",
  "--output", "json"
)
$pullRoleDefinitionGuid = [string]$pullRole.name
if (-not $pullRoleDefinitionGuid) {
  throw "Could not resolve the '$pullRoleName' role definition."
}

& az bicep build --file $identityTemplate --stdout | Out-Null
Assert-LastExitCode -Operation "Compiling the identity Bicep template"
& az bicep build --file $appTemplate --stdout | Out-Null
Assert-LastExitCode -Operation "Compiling the Container App Bicep template"

Write-Host "Reviewing the identity and ACR pull-role changes..."
& az deployment group what-if `
  --subscription $SubscriptionId `
  --resource-group $ResourceGroup `
  --template-file $identityTemplate `
  --parameters acrName=$RegistryName pullIdentityName=$PullIdentityName pullRoleDefinitionGuid=$pullRoleDefinitionGuid
Assert-LastExitCode -Operation "Identity deployment what-if"

Write-Host "Creating or reconciling the FoodLens pull identity..."
& az deployment group create `
  --subscription $SubscriptionId `
  --resource-group $ResourceGroup `
  --name "foodlens-identity" `
  --template-file $identityTemplate `
  --parameters acrName=$RegistryName pullIdentityName=$PullIdentityName pullRoleDefinitionGuid=$pullRoleDefinitionGuid `
  --output none
Assert-LastExitCode -Operation "Identity deployment"

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
if (-not $ImageTag) {
  $commit = (& git -C $repoRoot rev-parse --short=12 HEAD 2>$null).Trim()
  if ($LASTEXITCODE -eq 0 -and $commit) {
    $dirty = & git -C $repoRoot status --porcelain
    $sourceLabel = if ($dirty) { "$commit-dirty" } else { $commit }
  } else {
    $sourceLabel = "source"
  }
  $ImageTag = "$sourceLabel-$timestamp"
}

Write-Host "Building the Linux image in Azure Container Registry as $ImageRepository`:$ImageTag..."
& az acr build `
  --subscription $SubscriptionId `
  --resource-group $ResourceGroup `
  --registry $RegistryName `
  --image "$ImageRepository`:$ImageTag" `
  --file (Join-Path $repoRoot "Dockerfile") `
  $repoRoot
Assert-LastExitCode -Operation "ACR remote build"

$digest = (& az acr repository show `
  --subscription $SubscriptionId `
  --name $RegistryName `
  --image "$ImageRepository`:$ImageTag" `
  --query digest `
  --output tsv).Trim()
Assert-LastExitCode -Operation "Resolving the built image digest"
if ($digest -notmatch "^sha256:[a-f0-9]{64}$") {
  throw "ACR returned an invalid image digest: $digest"
}
$imageDigestRef = "$($registry.loginServer)/$ImageRepository@$digest"

Write-Host "Reviewing the Container App changes for immutable image $imageDigestRef..."
& az deployment group what-if `
  --subscription $SubscriptionId `
  --resource-group $ResourceGroup `
  --template-file $appTemplate `
  --parameters `
    location=$location `
    environmentName=$EnvironmentName `
    acrName=$RegistryName `
    pullIdentityName=$PullIdentityName `
    appName=$AppName `
    workloadProfileName=$WorkloadProfileName `
    imageDigestRef=$imageDigestRef
Assert-LastExitCode -Operation "Container App deployment what-if"

Write-Host "Deploying FoodLens..."
$deployment = Invoke-AzureJson -Arguments @(
  "deployment", "group", "create",
  "--subscription", $SubscriptionId,
  "--resource-group", $ResourceGroup,
  "--name", "foodlens-app-$timestamp",
  "--template-file", $appTemplate,
  "--parameters",
  "location=$location",
  "environmentName=$EnvironmentName",
  "acrName=$RegistryName",
  "pullIdentityName=$PullIdentityName",
  "appName=$AppName",
  "workloadProfileName=$WorkloadProfileName",
  "imageDigestRef=$imageDigestRef",
  "--output", "json"
)

$fqdn = [string]$deployment.properties.outputs.fqdn.value
if (-not $fqdn) {
  throw "The Container App deployment did not return an FQDN."
}
$baseUrl = "https://$fqdn"

Write-Host "Waiting for the health endpoint at $baseUrl..."
$healthy = $false
for ($attempt = 1; $attempt -le 18; $attempt += 1) {
  try {
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 10
    if ([string]$health.status -eq "healthy") {
      $healthy = $true
      break
    }
  } catch {
    if ($attempt -eq 18) {
      throw
    }
  }
  Start-Sleep -Seconds 5
}
if (-not $healthy) {
  throw "FoodLens did not become healthy within the verification window."
}

$demo = Invoke-WebRequest -Uri "$baseUrl/food/demo" -TimeoutSec 30 -SkipHttpErrorCheck
if ($demo.StatusCode -ne 200) {
  throw "The public FoodLens door returned HTTP $($demo.StatusCode)."
}

$blockedPage = Invoke-WebRequest -Uri "$baseUrl/today" -TimeoutSec 30 -SkipHttpErrorCheck
if ($blockedPage.StatusCode -ne 404) {
  throw "The FoodLens route boundary expected /today to return 404, got $($blockedPage.StatusCode)."
}

$blockedPackage = Invoke-WebRequest `
  -Uri "$baseUrl/api/food/package" `
  -Method Post `
  -ContentType "application/json" `
  -Body "{}" `
  -TimeoutSec 30 `
  -SkipHttpErrorCheck
if ($blockedPackage.StatusCode -ne 404) {
  throw "The package endpoint boundary expected HTTP 404, got $($blockedPackage.StatusCode)."
}

$identified = Invoke-RestMethod `
  -Uri "$baseUrl/api/food/identify" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"text":"pizza"}' `
  -TimeoutSec 30
if ([string]$identified.mode -ne "match") {
  throw "The deterministic FoodLens probe did not return a match."
}

$tokenProbe = Invoke-RestMethod `
  -Uri "$baseUrl/api/realtime/token" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"probe":true}' `
  -TimeoutSec 30
if ([string]$tokenProbe.mode -ne "mock") {
  throw "The first release must keep realtime AI in mock mode."
}

Write-Host "FoodLens deployment verified."
[pscustomobject]@{
  Url = $baseUrl
  Image = $imageDigestRef
  Subscription = [string]$account.name
  ResourceGroup = $ResourceGroup
  AppName = $AppName
  Mode = "synthetic/mock-first"
}
