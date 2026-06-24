---
name: "davinci-resolve-automation"
description: "Advanced automation skill for the DaVinci Resolve 21.0 release scripting API, including transcription, audio classification, motion deblur, face analysis, slate sync, and speech generation."
agentCallable: true
---

# DaVinci Resolve Automation

## Purpose

Automate and orchestrate post-production workflows using the DaVinci Resolve 21.0 scripting API. Exposes features like diarized transcription, audio classification, camera shake/motion deblur, Intellisearch facial mapping, automated slate synchronization, and AI speech synthesis.

## Scripting Setup & Prerequisites

To execute Resolve automation scripts, the following environment variables must be configured on the host:
- **RESOLVE_SCRIPT_API**: `%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting`
- **RESOLVE_SCRIPT_LIB**: `C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll`
- **PYTHONPATH**: `%PYTHONPATH%;%RESOLVE_SCRIPT_API%\Modules\`

External scripting must be enabled in Resolve's preferences (`System.Scripting.Mode = 2`).

## Studio and AI Scripting APIs (Extras Packages)

Many of the advanced AI and scripting features require specific package downloads. These must be installed on the machine via the DaVinci Resolve Studio application menu (**Extras Download Manager**) prior to script invocation:

- **AI IntelliSearch - Faster**: Required for `AnalyzeForIntellisearch(identifyFaces, isBetterMode=False)`.
- **AI IntelliSearch - Better**: Required for `AnalyzeForIntellisearch(identifyFaces, isBetterMode=True)`.
- **AI Slate ID**: Required for `AnalyzeForSlate(markerColor)`.
- **AI Speech Generator**: Required for `GenerateSpeech({speechGenerationSettings}, timecode)`.
- **Extended Language Models**: Required for transcription workflows with languages other than the built-in models.

## Key API Functions (21.0 Release)

The scripting API is exposed on both `Folder` objects (for batch processing folders and subfolders) and individual `MediaPoolItem` objects.

### 1. Diarized Audio Transcription
Transcribes audio with optional speaker diarization:
```python
# Folder.TranscribeAudio(useSpeakerDetection=None)
# MediaPoolItem.TranscribeAudio(useSpeakerDetection=None)
# If no argument is specified, uses the project default setting.
success = folder.TranscribeAudio(useSpeakerDetection=True)
success = clip.TranscribeAudio(useSpeakerDetection=True)

# Clear transcription:
# Folder.ClearTranscription()
# MediaPoolItem.ClearTranscription()
folder.ClearTranscription()
```

### 2. AI Audio Classification
Categorizes audio clips in a folder or individual media items into logical categories (e.g., dialog, music, effects) and subcategories:
```python
# Folder.PerformAudioClassification()
# MediaPoolItem.PerformAudioClassification()
success = folder.PerformAudioClassification()
success = clip.PerformAudioClassification()

# Clear classification:
# Folder.ClearAudioClassification()
# MediaPoolItem.ClearAudioClassification()
folder.ClearAudioClassification()
```

### 3. AI Motion Deblur
Applies motion deblur to correct camera shake on media clips:
```python
# Folder.RemoveMotionBlur({deblurOption}) -> [[MediaPoolItem, MediaPoolItem]...]
# MediaPoolItem.RemoveMotionBlur({deblurOption}) -> MediaPoolItem
# Returns list of pairs or the new MediaPoolItem mapped to source.

deblur_options = {
    "FileName": "output_deblurred.mov",       # string
    "Format": "mov",                          # string (e.g., "mov", "mp4")
    "Codec": "H264",                          # string (e.g., "H264", "ProRes422")
    "EncodingProfile": "Main10",              # string (for H264 and H265 only)
    "UseExtremeMode": True,                   # bool
    "UseMarkInMarkOut": False,                # bool
    "RenderAtSourceRes": True,                 # bool
    "UseMoreGpuMemory": True                  # bool
}
results = folder.RemoveMotionBlur(deblur_options)
new_clip = clip.RemoveMotionBlur(deblur_options)
```

### 4. Intellisearch Face Analysis
Performs neural facial mapping and intellisearch indexing on a folder or clip:
```python
# Folder.AnalyzeForIntellisearch(identifyFaces, isBetterMode)
# MediaPoolItem.AnalyzeForIntellisearch(identifyFaces, isBetterMode)
success = folder.AnalyzeForIntellisearch(identifyFaces=True, isBetterMode=True)
success = clip.AnalyzeForIntellisearch(identifyFaces=True, isBetterMode=True)

# To clear analysis data for the project:
# Project.ResetIntellisearchAnalysis()
success = project.ResetIntellisearchAnalysis()
```

### 5. Automated Slate Synchronization
Aligns slate/markers using marker colors:
```python
# Folder.AnalyzeForSlate(markerColor)
# MediaPoolItem.AnalyzeForSlate(markerColor)
# markerColor must be one of the resolve.MARKER_* constants.
success = folder.AnalyzeForSlate(resolve.MARKER_GREEN)
```
**Supported markerColor Constants:**
`resolve.MARKER_BLUE`, `resolve.MARKER_CYAN`, `resolve.MARKER_GREEN`, `resolve.MARKER_YELLOW`, `resolve.MARKER_RED`, `resolve.MARKER_PINK`, `resolve.MARKER_PURPLE`, `resolve.MARKER_FUCHSIA`, `resolve.MARKER_ROSE`, `resolve.MARKER_LAVENDER`, `resolve.MARKER_SKY`, `resolve.MARKER_MINT`, `resolve.MARKER_LEMON`, `resolve.MARKER_SAND`, `resolve.MARKER_COCOA`, `resolve.MARKER_CREAM`.

### 6. Speech Synthesis Generation
Generates AI speech-to-audio clips directly on the timeline:
```python
# Project.GenerateSpeech({speechGenerationSettings}, timecode)
settings = {
    "TextInput": "Welcome to the Creative Liberation Engine cinematic workspace.",
    "VoiceModel": "Female 1",             # string (e.g., "Female 1", "Male 1", "Custom Voice")
    "CustomVoiceFile": "",                # string (full path of voice file for custom models)
    "Speed": 50,                          # int
    "Variation": 50,                      # int
    "Pitch": 50,                          # int
    "GenerationID": 0,                    # int
    "Filename": "generated_voice.wav",     # string
    "AddToTimeline": True,                # bool
    "AudioTrack": 1                       # int
}
new_clip = project.GenerateSpeech(settings, "01:00:00:00")
```

### 7. Project Performance Boost
Disables all background tasks for the current scripting session to optimize script execution speeds:
```python
# Resolve.DisableBackgroundTasksForCurrentResolveSession()
resolve.DisableBackgroundTasksForCurrentResolveSession()
```

### 8. Cloud Project Operations
Scripting API support has been added to manage Blackmagic Cloud projects:
```python
# ProjectManager.CreateCloudProject({cloudSettings}) -> Project
# ProjectManager.LoadCloudProject({cloudSettings}) -> Project
# ProjectManager.ImportCloudProject(filePath, {cloudSettings}) -> Bool
# ProjectManager.RestoreCloudProject(folderPath, {cloudSettings}) -> Bool
```

## Guardrails

- Ensure DaVinci Resolve Studio is running prior to invoking scripts.
- Validate that the target timeline and folder are loaded before executing slate or marker modifications.
- Handle exceptions and inspect return values (`False` or `None`) when required Extras downloads (e.g., AI Speech Generator, AI Slate ID, AI IntelliSearch) are missing on the target host.
