# RFC-WTM-0001: The `STIR-1.0 + IESCS` Open Agent-to-Agent Safety, Provenance & Bot-Immunity Standard

- **Standard Identifier**: `RFC-WTM-0001` (`STIR-IESCS/1.0`)
- **Status**: Public-Good Open Standard (`v2.2.0` · MIT License · Zero External Dependencies)
- **Maintained By**: WholeTroutMedia Engineering (`@WholeTroutMedia` · `@jaharoni` · [`justinaharoni.com`](https://justinaharoni.com))
- **Canonical Reference SDK**: [`WholeTroutMedia/open-source-micro-tools/apps/000-stir-iescs-protocol-sdk`](https://github.com/WholeTroutMedia/open-source-micro-tools/tree/main/apps/000-stir-iescs-protocol-sdk)
- **Live Trust-Root & Bot-Shield Feeds**:
  - Trust Epoch: [`registry/stir_trust_epoch.json`](https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/registry/stir_trust_epoch.json)
  - Verified Spam-Bot Blocklist: [`registry/verified_spam_bot_blocklist.json`](https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/registry/verified_spam_bot_blocklist.json)

---

## 1. Why This Open Standard Exists

Modern open-source repositories and multi-agent systems face two compounding failure modes:
1. **Unverified PR & Bot Spam**: Automated bounty-farming and LLM wrapper bots flood maintainers with untested diffs.
2. **Verbose, Unverifiable Agent-to-Agent Chatter**: Autonomous agents exchange hundreds of tokens of ambiguous natural language and coerce unknown states into boolean `True` guesses instead of halting when evidence is missing.

**`RFC-WTM-0001` (`STIR-1.0 + IESCS`)** solves both problems in a single, zero-dependency open standard that is **100% free to adopt** and integrates directly into Git commit history, GitHub Actions CI, ASGI/HTTP headers, and MCP tool calls.

---

## 2. The Four Structural Pillars of `RFC-WTM-0001`

### Pillar I: Strong Three-Valued Kleene Logic (`{-1, 0, +1}`)
Every agent tool invocation, CI verification check, or PR gate MUST evaluate to one of three Kleene truth states rather than coercing uncertainty to `True`:
- **`+1` (`VERIFIED_TRUE`)**: Deterministic tests, typecheckers, and provenance seals passed (`COMMIT`).
- **`0` (`EPISTEMIC_UNKNOWN`)**: Evidence is incomplete or unverified; the agent MUST refuse to guess (`HOLD_FOR_EVIDENCE` / `$0.00` charge).
- **`-1` (`VERIFIED_FALSE`)**: Invariant check failed or author matched a verified spam-bot signature (`HALT_AND_REJECT`).

### Pillar II: `IESCS` Prefix-Sigil Wire Grammar & Plain-English Receipts
Agents compress verbose natural-language tool invocations (`~450` tokens) into 21-token `STIR-1.0 + IESCS` frames (`96.8%` token reduction) using six deterministic prefix sigils (`!`, `&`, `@`, `?`, `~`, `$`):
```text
STIR-1.0 ⊢ &app:EPIS_ARB_11 ⊢ !op:0x0B ⊢ ?kleene:+1 ⊢ $cap:0.00125 ⊢ [max_slippage_bps=12 pair=ETH-USDC] ⊢ ⚓:9f8bd223a2c2fb51d133c0f8
```
Every `STIR-1.0` frame is paired with a deterministic **Plain-English Receipt** (`unpack_plain_english_receipt()`) so human maintainers never have to read opaque machine logs.

### Pillar III: Native Git Commit & PR Trailers (`STIR-Receipt:`) + Drop-In `STIRASGIMiddleware`
Just as `Signed-off-by:` (DCO) standardized commit authorship, `RFC-WTM-0001` standardizes **verification and bot-immunity provenance** directly inside Git commits, PR bodies, and HTTP/MCP headers:
- **Git Commit & PR Trailers**:
  ```text
  STIR-Receipt: STIR/1.0|0xAA|&git:COMMIT_VERIFY|!op:0x01|?kleene:+1|$cap:0.00000|bot_free=true tests=pass|SHA3:2c9a6a5e0d9b8f31a4e7c112
  STIR-Translation: [VERIFIED_TRUE] Local verification suite passed (bot_free=true, tests=pass)
  STIR-Standard: RFC-WTM-0001 (X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0)
  ```
- **HTTP / ASGI / MCP Headers (`STIRASGIMiddleware`)**:
  - `X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0`
  - `X-STIR-Receipt: STIR/1.0|0xAA|...|SHA3:...`
  - `X-STIR-Trust-Epoch: https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/registry/stir_trust_epoch.json`

### Pillar IV: Federated Trust-Root & Bot-Shield Synchronization
Repositories adopting `open-source-bot-shield.yml` or `install_stir_standard.py` automatically synchronize with the live public-good blocklist (`registry/verified_spam_bot_blocklist.json`) and conformance epoch (`registry/stir_trust_epoch.json`), closing spam-ring PRs in `<2 seconds` while badging `STIR-Receipt:` conformal PRs in the GitHub Actions summary.

---

## 3. One-Command Adoption for Any Repository (`install_stir_standard.py`)

```bash
curl -fsSL https://raw.githubusercontent.com/WholeTroutMedia/open-source-bounties/main/install_stir_standard.py | python3 - --target-repo .
```

This single command (zero external dependencies) installs:
1. `.git/hooks/prepare-commit-msg` (automatically stamps verifiable `STIR-Receipt:` trailers on commits),
2. `.github/workflows/open-source-bot-shield.yml` (protects the repository against spam-bot rings and verifies `STIR-Receipt:` trailers in CI), and
3. `.well-known/agent.json` (`X-Inception-Rosetta-Upgrade: STIR-IESCS/1.0` discovery beacon for visiting AI agents).
