# GCP Key Management Controls

This folder operationalizes five mandatory controls:

1. Zero-code secret storage (Secret Manager runtime injection)
2. Dormant key audit and decommissioning (>30 days idle)
3. API key restrictions (API + environment restrictions)
4. Least privilege for service accounts (IAM Recommender)
5. Mandatory service account key rotation / key creation disablement

## Prerequisites

- `gcloud` installed and authenticated
- Org-level access for org policy operations
- Project-level IAM permissions for audits and remediation

## Zero-Code Storage (Runtime Injection)

Never commit secrets to source control. Store secrets in Secret Manager and inject them at runtime.

Example (Cloud Run):

```bash
gcloud run deploy tiksave-backend \
  --image gcr.io/PROJECT_ID/tiksave-backend \
  --set-secrets OPENAI_API_KEY=OPENAI_API_KEY:latest \
  --set-secrets GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest
```

Example (GKE, Workload Identity):

- Bind Kubernetes service account to a Google service account.
- Grant the Google service account `roles/secretmanager.secretAccessor`.
- Read at startup via Secret Manager SDK or mount via CSI driver.

## Automation Scripts

- `audit-keys.ps1`: finds potentially dormant service account keys and optionally disables/deletes.
- `audit-api-key-restrictions.ps1`: identifies unrestricted API keys.
- `recommender-least-privilege.ps1`: lists IAM Recommender role recommendations for service accounts.
- `apply-org-policies.ps1`: applies mandatory org policies for key expiry and key creation disablement.

## Quick Start

```powershell
# 1) Audit dormant keys (read-only)
.\security\gcp\audit-keys.ps1 -ProjectId "my-project"

# 2) Check API key restrictions
.\security\gcp\audit-api-key-restrictions.ps1 -ProjectId "my-project"

# 3) Review least privilege recommendations
.\security\gcp\recommender-least-privilege.ps1 -ProjectId "my-project"

# 4) Enforce org-level key policies
.\security\gcp\apply-org-policies.ps1 -OrganizationId "123456789012" -KeyExpiryHours 720 -DisableKeyCreation
```

## Notes

- `audit-keys.ps1` uses Cloud Logging to infer key usage in the last N days. Validate against your org's logging retention and sinks.
- API keys must include:
  - API restrictions (`restrictions.apiTargets`)
  - At least one app restriction (`browser`, `server`, `android`, or `ios`)
- Prefer keyless auth (Workload Identity / attached service accounts) whenever possible.
