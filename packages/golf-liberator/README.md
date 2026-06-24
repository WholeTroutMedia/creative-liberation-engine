# @cle/golf-liberator

A private, sovereign golf scoring ledger, GHIN backup, and local WHS handicap calculation engine.

## Features

1. **GHIN API Mirror:** Authenticates with the GHIN servers (using the mobile app credentials) and downloads your entire scoring history.
2. **Local WHS Engine:** Computes a World Handicap System (WHS) compliant handicap index locally on your machine.
3. **Decentralized Exporter:** Converts your rounds into clean CSV tables, JSON records, and individual Markdown files with YAML frontmatter suitable for Obsidian or a self-hosted golf blog.
4. **Mock Demo Mode:** Runs offline demonstrating mock rounds at courses like Apogee West, Grove XXIII, and Seminole if no credentials are supplied.

## Installation

Run in the root directory:

```bash
pnpm install
```

## Running the Tool

### 1. Mock Mode (Demo)
Run without any configuration to verify calculations and see output formats:

```bash
pnpm --filter @cle/golf-liberator build
pnpm --filter @cle/golf-liberator start --mock
```

### 2. Live Mirror Backup
To extract your live data, create a `.env` file inside `packages/golf-liberator/` or at the repository root:

```env
GHIN_EMAIL=your.email@example.com
GHIN_PASSWORD=your_secure_password
GHIN_TARGET_NUMBER=optional_different_ghin_to_fetch
```

Then compile and run:

```bash
pnpm --filter @cle/golf-liberator build
pnpm --filter @cle/golf-liberator start
```

## Output Structure

The tool creates an `export/` directory:

* `/export/scores.csv` — Full database ledger for spreadsheet imports.
* `/export/summary.json` — Profile metadata and detailed calculation metrics.
* `/export/rounds/*.md` — Obsidian-friendly individual markdown notes per round with YAML frontmatter.
