# FoodLens on Azure Container Apps

The preferred managed-identity deployment reuses the existing Central US
Container Apps environment, Azure Container Registry, and Log Analytics
workspace. It creates only a FoodLens pull identity, its least-privilege
registry role assignment, and a separate Container App.

The synthetic preview was first deployed on 2026-09-04 at
`https://ca-foodlens.delightfulsmoke-a0e2eff4.centralus.azurecontainerapps.io`.
Its current verified revision is `ca-foodlens--src49fba52b-probe10` (Healthy
and Active on 2026-09-04), with startup, readiness, and liveness probes on
`/api/health` and a startup failure threshold of 10.
The signed-in role could not create ACR role assignments, so that release uses
the registry's existing admin credential as a temporary application-level
Container Apps secret. No identity or role assignment was created. This is a
development fallback only; use the Bicep path below when role-assignment
authority becomes available.

The first release is intentionally synthetic and mock-first:

- `HEALTH_AI_PROVIDER=mock`
- detailed package scanning is disabled
- no OpenAI or USDA secret is present
- only `/food`, `/food/demo`, the approved FoodLens APIs, and health are exposed
- all images are deployed by immutable ACR digest

Do not enter patient information. Entra access control, a separate staging app,
custom domains, and live AI remain later release gates.

## Deploy

Authenticate the Azure CLI to the UKHC Innovation tenant/subscription, then run:

```powershell
.\scripts\deploy-foodlens-azure.ps1 -SubscriptionId '<subscription-id>'
```

For an uploaded source archive or a dirty working tree, pass a tag derived from
the archive SHA-256 so the registry tag identifies the exact deployed source:

```powershell
.\scripts\deploy-foodlens-azure.ps1 `
  -SubscriptionId '<subscription-id>' `
  -ImageTag 'src-<first-16-sha256-characters>'
```

The script performs read-only environment and ACR preflight checks, compiles
both Bicep templates, shows Azure `what-if` output, creates/reconciles the pull
identity, builds the Linux image remotely in ACR, resolves its SHA-256 digest,
deploys the Container App, and runs route/API smoke checks.

The script deliberately stops rather than changing the shared registry when
ACR's ARM-audience authentication is disabled. It selects `AcrPull` for an
RBAC-only registry and `Container Registry Repository Reader` for an
RBAC+ABAC-enabled registry.

## Roll back

Redeploy a previously verified digest through `container-app.bicep`. Container
Apps Single revision mode keeps traffic on the old healthy revision until the
new revision is ready.
