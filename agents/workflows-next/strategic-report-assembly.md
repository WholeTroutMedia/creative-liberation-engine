# strategic-report-assembly

## Purpose

Orchestrate the end-to-end generation of high-fidelity enterprise reports by dynamically resolving intent, executing data collection skills in parallel, combining findings, validating against strict quality gates, and delivering a curated strategic artifact.

## Steps

1. **Template Selection:** Extract user intent, match against strategic report templates, and verify the user's tier privileges.
2. **Data Sourcing (Parallel Execute):** Dispatch tasks to all required dataSkills defined in the selected template, executing them in parallel.
3. **Assembly & Synthesis:** Combine results of data sourcing skills and assign the template's assemblyAgent to compile the report under the STRATEGIC_REPORT schema.
4. **Quality Gate Validation:** Enforce completeness, source-attribution verification, data staleness checks, and constitutional-policy alignment.
5. **Artifact Delivery:** Write the compiled report to the workspace artifacts directory and notify the requesting agent or user.
