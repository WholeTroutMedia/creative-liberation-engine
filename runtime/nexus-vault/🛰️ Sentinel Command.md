---
cssclass: sentinel-dashboard
aliases: [Sentinel Dashboard, ATHENA Pipeline]
---

# 🛰️ SENTINEL COMMAND

> **Flipboard → ATHENA Ideation Pipeline** | Autonomous intelligence harvesting & strategic routing

---

## 📊 Pipeline Telemetry

```dataviewjs
const sentinel = dv.pages('"Sentinel"');
const total = sentinel.length;
const ideated = sentinel.where(p => p.status === "IDEATED").length;
const discarded = sentinel.where(p => p.status === "DISCARD").length;
const pending = sentinel.where(p => p.status === "PENDING").length;
const failed = sentinel.where(p => p.status === "FAILED").length;

dv.paragraph(`
| Metric | Count | Bar |
|--------|------:|-----|
| 📦 **Total Processed** | ${total} | ${"█".repeat(Math.min(total, 40))} |
| 💡 **Ideated** | ${ideated} | ${"🟢".repeat(Math.min(Math.ceil(ideated/2), 20))} |
| 🚫 **Discarded** | ${discarded} | ${"🔴".repeat(Math.min(discarded, 20))} |
| ⏳ **Pending** | ${pending} | ${"🟡".repeat(Math.min(pending, 20))} |
| ❌ **Failed** | ${failed} | ${"🔻".repeat(Math.min(failed, 20))} |
`);

const rate = total > 0 ? Math.round((ideated / total) * 100) : 0;
dv.paragraph(`> [!tip] Pipeline Health: **${rate}%** acceptance rate — ${pending === 0 ? "✅ Queue clear" : `⚠️ ${pending} jobs pending`}`);
```

---

## 🔥 Recent Ideations (Last 10)

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  truncate(source_title, 60) AS "Article",
  cle_relevance AS "🎯",
  dateformat(date(ideated_at), "MMM dd HH:mm") AS "Ideated",
  join(categories, " · ") AS "Categories"
FROM "Sentinel"
WHERE status = "IDEATED"
SORT ideated_at DESC
LIMIT 10
```

---

## 🎯 Relevance Tiers

### 🏆 Mission-Critical (90-100)

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  truncate(source_title, 55) AS "Article",
  cle_relevance AS "Score",
  join(categories, ", ") AS "Tags"
FROM "Sentinel"
WHERE cle_relevance >= 90 AND status = "IDEATED"
SORT cle_relevance DESC, ideated_at DESC
```

### 🟡 Strategic (50-89)

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  truncate(source_title, 55) AS "Article",
  cle_relevance AS "Score"
FROM "Sentinel"
WHERE cle_relevance >= 50 AND cle_relevance < 90 AND status = "IDEATED"
SORT cle_relevance DESC
```

### ⚪ Low Signal (< 50)

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  truncate(source_title, 55) AS "Article",
  cle_relevance AS "Score"
FROM "Sentinel"
WHERE cle_relevance < 50 AND status = "IDEATED"
SORT cle_relevance DESC
```

---

## 🗂️ Category Heatmap

```dataviewjs
const pages = dv.pages('"Sentinel"').where(p => p.categories);
const catMap = {};
for (const p of pages) {
  const cats = p.categories;
  if (cats && cats.length) {
    for (const c of cats) {
      catMap[c] = (catMap[c] || 0) + 1;
    }
  }
}
const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
const rows = sorted.map(([cat, count]) => {
  const bar = "█".repeat(Math.min(count, 30));
  return `| \`${cat}\` | ${count} | ${bar} |`;
});
dv.paragraph(`| Category | Count | Distribution |\n|----------|------:|--------------|\n${rows.join("\n")}`);
```

---

## 🔗 Cross-Reference Network

> Articles with the most connections to other ideations.

```dataviewjs
const pages = dv.pages('"Sentinel"').where(p => p.related_jobs && p.related_jobs.length > 0);
const rows = pages
  .sort(p => p.related_jobs.length, 'desc')
  .slice(0, 15)
  .map(p => [
    p.file.link,
    p.job_id,
    p.related_jobs.length,
    p.related_jobs.join(", ")
  ]);
dv.table(["Note", "Job ID", "Links", "Connected To"], rows);
```

---

## ⏳ Pending / Failed Jobs

> Jobs that need attention — retry or investigate.

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  status AS "Status",
  source_title AS "Article",
  created_at AS "Created"
FROM "Sentinel"
WHERE status = "PENDING" OR status = "FAILED"
SORT created_at DESC
```

---

## 📅 Timeline — Ideations by Date

```dataviewjs
const pages = dv.pages('"Sentinel"').where(p => p.ideated_at && p.status === "IDEATED");
const byDate = {};
for (const p of pages) {
  const d = p.ideated_at.toString().substring(0, 10);
  byDate[d] = (byDate[d] || 0) + 1;
}
const sorted = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
const rows = sorted.map(([date, count]) => {
  const bar = "🟩".repeat(Math.min(count, 20));
  return `| ${date} | ${count} | ${bar} |`;
});
dv.paragraph(`| Date | Count | Volume |\n|------|------:|--------|\n${rows.join("\n")}`);
```

---

## 🏷️ Quick Filters

Use these links to filter by category:

```dataviewjs
const pages = dv.pages('"Sentinel"').where(p => p.categories);
const cats = new Set();
for (const p of pages) {
  if (p.categories) for (const c of p.categories) cats.add(c);
}
const sorted = [...cats].sort();
dv.paragraph(sorted.map(c => `[[🏷️ ${c}|${c}]]`).join(" · "));
```

---

## ✏️ Operator Actions

### Approve for PLAN mode
> Tag any ideation note with `action: PLAN` in its frontmatter to route it to the planning pipeline.

### Flag for Deep Research
> Tag any ideation note with `action: RESEARCH` to queue a CORTEX deep-research dispatch.

### Archive / Dismiss
> Tag any ideation note with `action: ARCHIVE` to remove it from active views.

```dataview
TABLE WITHOUT ID
  link(file.link, job_id) AS "ID",
  source_title AS "Article",
  action AS "Action"
FROM "Sentinel"
WHERE action != null
SORT ideated_at DESC
```

---

> [!info] Dashboard powered by Dataview
> This dashboard auto-updates every time Obsidian indexes. New Sentinel notes appear immediately.
> 
> **Vault path:** `runtime/nexus-vault/`  
> **Sentinel output:** `Sentinel/`  
> **Pipeline:** Flipboard RSS → Sentinel → ATHENA (Genkit) → Obsidian + Email
