const crypto = require("crypto");
const fs = require("fs");
const password = "internal_os_read_only_key_99";
const constitution = `The Five Prime Axioms (The CLE Constitution)

1. ARTICLE I: ZERO-MVP COMPLETE DISH MANDATE: Ship complete or do not ship. No stubbed functions, generic wireframes, or half-cooked features. Data pipelines must connect to actual data sources from commit zero.
2. ARTICLE II: SOVEREIGN VELOCITY: Automate everything. Velocity serves Completeness-finish the full stack in one pass with zero friction.
3. ARTICLE III: BESPOKE DESIGN SUPREMACY: Every product must be 100% bespoke, luxury agency-grade. Never start from static, generic component themes.
4. ARTICLE IV: OMNI-SURFACE PASSTHROUGH: Every device, screen, container, and node is a transparent passthrough for full agentic power.
5. ARTICLE V: MOLECULAR SWARM ASSEMBLY: Zero high-level overviews. Dissect every task down to its last molecule and assemble specialized swarm teams before execution.`;

const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(password, salt, 32);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
let encrypted = cipher.update(constitution, "utf8", "hex");
encrypted += cipher.final("hex");
const authTag = cipher.getAuthTag().toString("hex");
const payload = {
  salt: salt.toString("hex"),
  iv: iv.toString("hex"),
  encrypted,
  authTag
};
fs.writeFileSync("CONSTITUTION.enc", JSON.stringify(payload));

// create the readable text version
fs.writeFileSync("CONSTITUTION.md", constitution);

