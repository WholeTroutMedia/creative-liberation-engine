---
tags: [sentinel, dashboard, moc]
updated: "2026-06-24T02:00:24.311Z"
---

# 📡 Sentinel Dashboard

> Autonomous ideation pipeline — powered by ATHENA

## Active Ideations

```dataview
TABLE status, cle_relevance as "Relevance", source_author as "Author", created_at as "Created"
FROM "Sentinel"
WHERE status != "ARCHIVED"
SORT cle_relevance DESC
```

## By Category

```dataview
TABLE length(rows) as "Count"
FROM "Sentinel"
FLATTEN categories as category
GROUP BY category
SORT rows.length DESC
```

## Archived

```dataview
TABLE source_title as "Article", created_at as "Created"
FROM "Sentinel"
WHERE status = "ARCHIVED"
SORT created_at DESC
LIMIT 20
```
