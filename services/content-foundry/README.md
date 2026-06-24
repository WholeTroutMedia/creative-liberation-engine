# Content Foundry

> **IE-IDX-0149** · Sovereign Content Creation Pipeline  
> `capture → ingest → transcribe → analyze → edit → publish`

The Content Foundry is the orchestration layer for the Creative Liberation Engine's media capabilities. It unifies FX30 capture, Whisper transcription, text-based video editing, AI analysis, and multi-platform distribution into a single sovereign pipeline.

## Core Innovation: Text-Based Video Editing

Edit your video by editing its transcript. The EDL compiler converts word-level transcript changes into FFmpeg-executable Edit Decision Lists.

```
Transcript Edit                    Video Result
─────────────                    ────────────
"So, um, I think the—           "I think the key insight
the key insight here is          here is that sovereignty
that, like, sovereignty          matters."
matters, right?"
                                 [filler removed, pauses cut,
                                  clean 8-second clip]
```

## Pipeline Stages

| Stage | Service | Status |
|---|---|---|
| Capture | FX30/OBS → media-vault | Existing |
| Ingest | Auto-catalog + waveform | Phase 1 |
| Transcribe | Whisper word-level | Phase 1 |
| Analyze | LLM chapters/highlights | Phase 3 |
| Edit | Transcript → EDL compiler | **Phase 1 ✅** |
| Publish | Multi-platform distributor | Phase 4 |

## Architecture

- **Schema:** `schemas/CONTENT_FOUNDRY_ASSET.schema.json`
- **Transcript:** `schemas/CONTENT_FOUNDRY_TRANSCRIPT.schema.json`
- **EDL Compiler:** `src/edl-compiler.ts`
- **Media Vault:** `runtime/media-vault/` (NAS)

## Related Ideations

IE-HRT-031 (GenMedia), IE-HRT-033 (DaVinci), IE-HRT-034 (FX30),
IE-HRT-035 (FFmpeg Swarm), IE-HRT-032 (Foley), IE-HRT-046 (ATLAS LIVE),
IE-HRT-045 (GOD PROMPT), IE-HRT-048 (Barnstorm)
