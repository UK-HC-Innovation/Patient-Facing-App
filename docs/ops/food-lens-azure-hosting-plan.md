# FoodLens Azure Hosting Plan

Status: deployed 2026-09-04 as a synthetic, mock-first technical preview.

Current release:

- URL: `https://ca-foodlens.delightfulsmoke-a0e2eff4.centralus.azurecontainerapps.io`
- Container App: `ca-foodlens`
- revision: `ca-foodlens--src49fba52b-probe10`
- image tag: `foodlens:src-49fba52b607dbf2b`
- image digest: `sha256:af35b37a4469609aeedd252a789a5e739f83d501c8247ba69e72774e5cf42110`
- ACR build: `cj1`
- source delta SHA-256: `49fba52b607dbf2bb3bdbafc826fc7c1def3e3f41ebf40f7af7a45ea5005fed4`

## 1. Outcome

Host a narrow FoodLens release in the existing UKHC Innovation Azure environment without moving the rest of the patient-facing application. The first release is a synthetic, mock-first preview. It must not accept patient information or call paid AI services.

The first usable URL will be the Azure Container Apps hostname. Entra access control, a custom domain, and live AI are separate release gates.

## 2. Architecture decision

The Azure environment already provides:

- resource group `rg-hcinov-compliance-centralus`;
- workload-profile Container Apps environment `cae-hcinov-centralus`;
- Azure Container Registry `acrhcinovcompliance`;
- Log Analytics workspace `log-hcinov-centralus`; and
- a synthetic reference Container App with immutable image deployment and health probes.

Reuse those shared resources and add a separate FoodLens Container App:

```text
Browser -- HTTPS --> ca-foodlens (Azure Container Apps)
                         |
                         +-- immutable Node 22 image from ACR by digest
                         +-- application-level ACR pull secret (temporary fallback)
                         +-- dependency-free /api/health endpoint
                         +-- stdout/system logs in existing Log Analytics
```

This replaces the earlier App Service S1 proposal. Reusing Container Apps removes the need for a separate fixed-price App Service plan, follows the platform already established in the subscription, and provides revision-based rollout and rollback.

The signed-in role can create Container Apps and run ACR builds but cannot create role assignments. The deployed preview therefore uses the registry's already-enabled admin credential as an application-level Container Apps secret, matching the existing reference app. This is a supported development fallback, not an RBAC bypass. Migrate the app to a user-assigned pull identity when a principal with `Microsoft.Authorization/roleAssignments/write` is available.

## 3. First-release boundary

Build with `APP_SURFACE=foodlens`. The default remains `full`, preserving the existing Vercel application.

Allowed pages:

- `/` redirects to `/food/demo` and preserves the query string;
- `/food`;
- `/food/demo`; and
- `/compass`, which remains a permanent redirect to `/food/demo`.

Allowed APIs:

- `/api/food/identify`;
- `/api/food/lookup`;
- `/api/food/plate`;
- `/api/food/vision`;
- `/api/realtime/token`; and
- `/api/health`.

Only FoodLens manifest/icon files and required Next.js static build assets are public. All other pages, APIs, and public files return 404. In particular, `/api/food/package` and `/api/food/package/session` remain unavailable.

## 4. Application readiness

The Azure implementation provides:

- a validated build-time application-surface setting;
- standalone Next.js output only for the FoodLens build;
- a Node 22 multi-stage Linux image running as a non-root user;
- explicit copying of `public`, `.next/static`, and both Food Compass JSON datasets into the standalone artifact;
- `/api/health` with a fast, dependency-free, no-store response;
- FoodLens-specific metadata, manifest, icon, navigation, and branding;
- no Ladder service-worker registration in the FoodLens build;
- a provider-free `/food/demo` mount so the public door does not initialize patient state or write the patient-store key;
- barcode lookup via bounded, strict POST JSON rather than a URL query string; and
- deterministic artifact and browser contracts for route, API, data-file, mock-mode, and browser-storage behavior.

## 5. Azure resources created

The 2026-09-04 deployment created only:

- ACR image `foodlens:src-49fba52b607dbf2b`, resolved and deployed by digest; and
- `ca-foodlens`, a separate Container App using the existing environment and registry.

Container Apps stored the existing ACR credential as an application-level secret and references it from the registry configuration. No identity, role assignment, registry setting, shared environment, or reference app was created or changed.

The shared Container Apps environment, registry, Log Analytics workspace, network configuration, and reference app are declared as existing and are not rewritten.

Resource-group tags are inherited at deployment time. The app adds only non-sensitive project, development, and synthetic-data tags.

## 6. Deployment sequence

The deployed no-admin sequence was:

1. Use the already-authenticated Azure portal and Cloud Shell in Chrome. The tenant blocks the local CLI device-code flow, but the portal Cloud Shell session is permitted.
2. Reconstruct the reviewed source from public base commit `7ae12cc` plus a scrubbed 10,507-byte runtime delta. Verify the delta SHA-256 before applying it.
3. Build in ACR Tasks and tag the image from the delta hash.
4. Resolve the image tag to an immutable registry digest.
5. Read the existing ACR username and password into shell variables without printing either value.
6. Create `ca-foodlens` with the registry password supplied from memory, then immediately unset the variables.
7. Add startup, readiness, and liveness probes against `/api/health`, preserving the complete container template while omitting secret values from the update document.
8. Verify the healthy active revision, HTTPS-only ingress, route allowlist, deterministic pizza score, seeded barcode lookup, mock realtime mode, browser rendering, and logs.

The preferred managed-identity sequence, once role-assignment authority exists, remains:

1. Authenticate Azure CLI with the UKHC Innovation account and select the intended subscription.
2. Read the Container Apps environment location and workload-profile names; never infer them from the resource-group location.
3. Check the ACR authorization mode:
   - RBAC-only uses `AcrPull`;
   - RBAC+ABAC uses `Container Registry Repository Reader`.
4. Verify ACR ARM-audience authentication is enabled for managed-identity pulls. Stop for an explicit shared-platform decision if it is disabled.
5. Compile both Bicep templates.
6. Run `what-if` for the identity and role assignment, then deploy them before the app so RBAC has time to propagate.
7. Build the Linux image remotely with ACR Tasks.
8. Resolve the pushed tag to `repository@sha256:digest`.
9. Run `what-if` for the Container App and deploy that immutable digest.
10. Verify the healthy revision, HTTPS hostname, route boundary, deterministic scoring, seeded barcode lookup, disabled package endpoints, and mock realtime mode.

The checked-in managed-identity command is:

```powershell
.\scripts\deploy-foodlens-azure.ps1 -SubscriptionId '<subscription-id>'
```

The script does not enable ACR admin credentials and does not change a disabled shared ACR authentication setting automatically. It was not used for the current credential-fallback deployment because the signed-in role cannot create the required ACR pull assignment.

## 7. Initial runtime configuration

| Setting | Value | Purpose |
|---|---|---|
| `APP_SURFACE` | `foodlens` | Records the artifact identity at runtime; the route boundary is compiled from the validated build value. |
| `NODE_ENV` | `production` | Runs the production Next.js server. |
| `PORT` | `3000` | Matches Container Apps ingress and probes. |
| `HOSTNAME` | `0.0.0.0` | Listens on the container network interface. |
| `HEALTH_AI_PROVIDER` | `mock` | Prevents paid/external AI calls. |
| `FOOD_PACKAGE_SCAN_ENABLED` | `0` | Keeps the paid package route disabled. |
| `NEXT_PUBLIC_FOOD_PACKAGE_SCAN` | `0` at build | Omits package controls from the client. |
| `APP_OPERATING_MODE` | `synthetic` | Documents the permitted data posture. |
| `APPROVED_SYNTHETIC_DEMO` | `true` | Makes the preview intent explicit. |

No OpenAI, USDA, passcode, or package-session secret is deployed in this phase.

## 8. Identity and public-access gate

The first deployment mirrors the existing synthetic reference pattern: internet-routable HTTPS with synthetic data and all paid AI disabled. That makes it suitable for technical validation only.

The current ACR admin credential has registry-wide scope and is shared. Container Apps stores it as an application secret, but rotating either ACR password requires updating the app's registry secret before the next image pull. Do not reuse this pattern for a patient-facing or multi-team production boundary; replace it with the least-privilege pull identity described above.

Before inviting a named internal cohort, add a separate single-tenant Entra app registration and Container Apps Easy Auth configuration with an explicit `allowedPrincipals.identities` list. Each allowed person must be resolved to their object ID in this tenant. Keep the token store off unless downstream Entra tokens are required.

Creating the app registration, service principal, redirect URI, and credential is a distinct security action. Store the credential in Key Vault through a versionless Container Apps reference; do not echo, commit, or pass it in ordinary command output.

If “internal” means network-private rather than identity-restricted, first verify that the shared Container Apps environment has the required internal/VNet topology. Easy Auth restricts identity but does not make public ingress private.

## 9. Observability and privacy

The existing environment already sends Container Apps system and console logs to Log Analytics. Initial monitoring should filter by `ca-foodlens` and alert on:

- unhealthy or failed revisions;
- restart/replica failures;
- HTTP 5xx spikes;
- sustained latency; and
- unexpected scaling or execution cost.

Do not log images, request bodies, transcripts, passcodes, barcodes, auth tokens, or provider keys. Barcode lookup now uses POST specifically to keep barcodes out of access-log URLs.

Application Insights is not automatic for Container Apps. Add direct OpenTelemetry instrumentation and a workspace-based Application Insights destination only after its telemetry schema, sampling, retention, and ingestion cap are reviewed. Do not mutate the shared environment's managed OpenTelemetry configuration as part of this first release.

## 10. Rollout and rollback

Use Single revision mode. Container Apps keeps traffic on the prior healthy revision until the replacement revision provisions and passes startup/readiness checks.

Record every released digest. Rollback means redeploying the last verified digest. A separate `ca-foodlens-stg` app is the preferred later staging boundary because Container Apps has revisions rather than App Service slots.

Do not retire the existing Vercel deployment until the Azure URL passes acceptance and the desired domain/access-control decision is complete.

## 11. Verification gates

Before Azure deployment:

- [x] full/Vercel mode lint, unit tests, store-free gate, production build, and bundle budgets pass;
- [x] FoodLens standalone production build succeeds;
- [x] standalone artifact contains and parses both Food Compass datasets;
- [x] health, redirects, exact allowlist, package denial, deterministic pizza score, seeded barcode lookup, and mock token probes pass; and
- [x] a production-browser contract proves `/food/demo` renders without console errors and leaves the patient-state localStorage key absent.

After Azure deployment (verified 2026-09-04 against `ca-foodlens--src49fba52b-probe10`):

- [x] image is referenced by SHA-256 digest;
- [x] current revision is Healthy and Active;
- [x] `/api/health` returns 200 with `{ "status": "healthy", "surface": "foodlens" }`;
- [x] HTTPS is enforced;
- [x] `/food/demo` renders in Chrome with no console warnings or errors;
- [x] unrelated pages/APIs and package endpoints return 404;
- [x] deterministic pizza scoring, seeded barcode lookup, and mock-token probes match the local artifact;
- [x] startup and recent system logs contain no request bodies, secrets, errors, or unhealthy events;
- [x] startup, readiness, and liveness probes target `/api/health`, with the startup failure threshold set to the documented maximum of 10; and
- [ ] prior-digest rollback is documented and exercised before live AI.

Before live AI or any patient-facing pilot:

- [ ] named-user Entra policy or reviewed public-abuse design is active;
- [ ] secrets are in Key Vault with least-privilege identity access;
- [ ] shared, deployment-wide rate and concurrency limits are active;
- [ ] provider budgets, alerts, and a tested mock-mode kill switch are active;
- [ ] camera/microphone disclosures and browser flows pass on target devices;
- [ ] privacy, security, clinical, and operational owners approve the release; and
- [ ] real patient information remains prohibited until the separate pilot gates are complete.

## 12. Cost posture

Reusing the existing Consumption environment, registry, and workspace avoids a new fixed S1 App Service charge. Incremental costs are Container Apps execution, ACR build/storage, and Log Analytics ingestion. The initial app is capped at one replica and makes no paid AI calls. Azure budgets alert but do not stop spend, so keep explicit replica limits and review ingestion volume.

## 13. References

- [Managed-identity image pulls](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull)
- [ACR RBAC and ABAC repository permissions](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions)
- [Container Apps authentication](https://learn.microsoft.com/en-us/azure/container-apps/authentication)
- [Container Apps revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
- [Container Apps health probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)
- [Container Apps container registries](https://learn.microsoft.com/en-us/azure/container-apps/containers#container-registries)
- [Container Apps secrets and Key Vault references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)
- [Container Apps log monitoring](https://learn.microsoft.com/en-us/azure/container-apps/log-monitoring)
- [Container Apps OpenTelemetry agents](https://learn.microsoft.com/en-us/azure/container-apps/opentelemetry-agents)
