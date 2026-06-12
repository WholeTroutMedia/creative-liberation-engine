# Runtime Hardening Manifests

These manifests are the machine-validated hardening state for six CLE parallel helices:

- `execution.hardening.json`
- `modelops.hardening.json`
- `memory.hardening.json`
- `security.hardening.json`
- `release.hardening.json`
- `reliability.hardening.json`

Generate board and graph:

- `npm run cle:hardening:board`

Validation is enforced by:

- `npm test`
