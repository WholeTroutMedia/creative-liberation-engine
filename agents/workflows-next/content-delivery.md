# content-delivery

## Purpose

Manage the final stages of asset packaging, transcoding, and secure distribution to diverse endpoint systems and partners.

## Steps

1. Detect approved "final" assets in the delivery staging directory.
2. Trigger automated QA (quality control) pass to verify specs (codec, resolution, audio levels).
3. Transcode assets into required delivery formats based on predefined delivery profiles.
4. Execute secure transfer (via Sony FTP or similar protocol) to destination endpoints.
5. Generate and dispatch a digital delivery manifesto/receipt to clients and internal logs.
