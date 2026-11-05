# Creative Liberation Engine (`cle`)

A lightweight, Unix-native creative workflow skeleton.

Creative Liberation Engine (`cle`) follows the classic Unix philosophy: **small, composable programs that read from standard input, write to standard output, and store configuration and skills as plain text files.**

It ships with zero mandatory third-party dependencies (pure Python 3 standard library + POSIX shell) so anyone can clone, inspect, pipe, and extend it with their own scripts, local models, or creative tools.

---

## Unix Directory Layout

```text
.
├── bin/
│   └── cle                  # Executable POSIX CLI entry point
├── etc/
│   └── cle.conf.example     # Sample POSIX configuration file
├── src/
│   └── cle/                 # Core standard-library engine package
│       ├── __init__.py
│       ├── cli.py           # Command-line argument router
│       ├── config.py        # Hierarchical config loader (env + etc/cle.conf)
│       ├── kernel.py        # Runtime diagnostics and stage execution
│       ├── pipeline.py      # Composable stdin/stdout Unix pipeline engine
│       ├── skills.py        # Plain-text SKILL.md discovery and parser
│       └── workspace.py     # Project workspace scaffolder (`cle init`)
├── share/
│   └── skills/              # Modular plain-text skill definitions
│       ├── ideate/SKILL.md
│       ├── plan/SKILL.md
│       ├── transform/SKILL.md
│       └── verify/SKILL.md
├── examples/
│   └── unix_pipeline.sh     # Runnable stdin/stdout pipeline demonstration
├── tests/
│   └── test_cle.py          # Standard-library unit test suite
├── var/
│   ├── log/                 # Runtime logs (git-ignored)
│   └── run/                 # Runtime state (git-ignored)
├── Makefile                 # Standard Unix build, test, and demo targets
├── pyproject.toml           # Python package metadata
└── package.json             # Optional Node/Workspace task runner metadata
```

---

## Quick Start

### 1. Clone and Check Environment

```bash
git clone <repository-url> creative-liberation-engine
cd creative-liberation-engine
./bin/cle doctor
```

### 2. Explore Built-in Skills

```bash
./bin/cle skills
./bin/cle skills --show ideate
```

### 3. Run a Unix Pipeline (`stdin` -> `stdout`)

Pipe any prompt or text stream through a sequence of stages (`ideate`, `plan`, `transform`, `verify`):

```bash
echo "Design a minimal markdown note organizer using POSIX directories" \
  | ./bin/cle pipe --stages ideate,plan,verify
```

Or emit structured JSON for downstream tools (`jq`, custom scripts, etc.):

```bash
echo "Build a procedural audio synth in WebAudio" \
  | ./bin/cle pipe --stages ideate,plan --json
```

### 4. Scaffold a New Workspace

```bash
./bin/cle init ./my-project --description "Experimental media pipeline"
cd my-project
```

### 5. Run Tests & Demo via `make`

```bash
make test
make demo
```

---

## Configuration

`cle` resolves configuration in standard Unix order (highest precedence first):

1. Environment variables (`CLE_MODE`, `CLE_PROVIDER`, `CLE_MODEL`, `CLE_SKILLS_DIR`)
2. Local workspace config (`./.cle.json` or `./etc/cle.conf`)
3. User config (`~/.config/cle/cle.conf`)
4. System config (`/etc/cle/cle.conf`)

Copy `etc/cle.conf.example` to `etc/cle.conf` or `.env.example` to `.env` if you wish to connect an external LLM or local inference server (such as Ollama or any OpenAI/Gemini-compatible endpoint). By default, `cle` runs 100% locally in deterministic offline mode with zero network calls.

---

## License

Released under the [MIT License](./LICENSE).
