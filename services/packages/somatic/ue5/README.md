# UE5 OSC Blueprint — MetaHuman Blendshape Receiver

**T20260308-003:** UE5 OSC Blueprint setup for the Consciousness Architecture.

Receives `/somatic/arkit` OSC UDP packets from `a2f_osc_bridge.py` and applies
52 ARKit blendshape values to a MetaHuman face component in real time.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Unreal Engine | 5.3+ | |
| OSC Plugin | built-in | Enable in Plugins → OSC |
| MetaHuman | any | Face mesh required |
| `a2f_osc_bridge.py` | running | Sends `/somatic/arkit` on port 5005 |

---

## 1. Enable the OSC Plugin

1. Open UE5 Editor → **Edit → Plugins**
2. Search `OSC` → Enable **OSC Plugin**
3. Restart the editor

---

## 2. Create the OSC Server

In your **Level Blueprint** or a **GameInstance Blueprint**:

```
Event BeginPlay
  → Create OSC Server
      IP Address: 0.0.0.0
      Port: 5005
      Start Listening: true
  → Bind Event to On Osc Message Received
```

**Or in C++:**

```cpp
UOscServer* Server = NewObject<UOscServer>();
Server->Connect(FString("0.0.0.0"), 5005);
Server->OnOscMessageReceived.AddDynamic(this, &AMyActor::OnOscMessage);
```

---

## 3. ARKit 52 Blendshape Order

The bridge sends exactly 52 floats in this order (matching Apple ARKit + MetaHuman):

```
Index  Name
0      EyeBlinkLeft
1      EyeLookDownLeft
2      EyeLookInLeft
3      EyeLookOutLeft
4      EyeLookUpLeft
5      EyeSquintLeft
6      EyeWideLeft
7      EyeBlinkRight
8      EyeLookDownRight
9      EyeLookInRight
10     EyeLookOutRight
11     EyeLookUpRight
12     EyeSquintRight
13     EyeWideRight
14     JawForward
15     JawRight
16     JawLeft
17     JawOpen
18     MouthClose
19     MouthFunnel
20     MouthPucker
21     MouthRight
22     MouthLeft
23     MouthSmileLeft
24     MouthSmileRight
25     MouthFrownLeft
26     MouthFrownRight
27     MouthDimpleLeft
28     MouthDimpleRight
29     MouthStretchLeft
30     MouthStretchRight
31     MouthRollLower
32     MouthRollUpper
33     MouthShrugLower
34     MouthShrugUpper
35     MouthPressLeft
36     MouthPressRight
37     MouthLowerDownLeft
38     MouthLowerDownRight
39     MouthUpperUpLeft
40     MouthUpperUpRight
41     BrowDownLeft
42     BrowDownRight
43     BrowInnerUp
44     BrowOuterUpLeft
45     BrowOuterUpRight
46     CheekPuff
47     CheekSquintLeft
48     CheekSquintRight
49     NoseSneerLeft
50     NoseSneerRight
51     TongueOut
```

---

## 4. Blueprint — OSC Message Handler

```
Event On Osc Message Received (Message)
  Branch: Message Address == "/somatic/arkit"
    True →
      Get Float Values from Message  (array of 52 floats)
      For Each Loop (Index 0..51)
          Get Morph Target Name from Index  [see mapping above]
          Set Morph Target
              Mesh: MetaHuman Face Component
              Morph Target Name: [name from mapping]
              Value: [float value from array]
```

### Blueprint Node Reference

| Node | Package | Notes |
|------|---------|-------|
| `Get Osc Message Float Values` | OSC | Returns `TArray<float>` |
| `Set Morph Target` | Components | On SkeletalMeshComponent |
| `Get Osc Message Address` | OSC | Pattern match `/somatic/arkit` |

---

## 5. MetaHuman Morph Target Names

MetaHuman uses the standard ARKit naming scheme. The morph target names on the
`CTRL_expressions` SkeletalMesh exactly match the ARKit names above (e.g.,
`CTRL_expressions_eyeBlinkL` maps to `EyeBlinkLeft`).

**Verified naming convention:**

```
ARKit Name      →  MetaHuman MorphTarget
EyeBlinkLeft    →  CTRL_expressions_eyeBlinkL
JawOpen         →  CTRL_expressions_jawOpen
MouthSmileLeft  →  CTRL_expressions_mouthSmileL
... (same pattern for all 52)
```

---

## 6. Test Level Setup

1. Create a new level: `Maps/SomaticTest`
2. Place a **MetaHuman Character** actor
3. Attach the OSC Blueprint component (or use Level Blueprint)
4. Play in editor with `a2f_osc_bridge.py` running
5. Speak into a mic feeding Kokoro TTS → watch the MetaHuman animate in real time

---

## 7. Performance Tuning

| Setting | Value | Reason |
|---------|-------|--------|
| OSC Server tick rate | Unlimited | Must match 60fps bridge output |
| Morph target blend mode | Additive | Allows stacking with animation |
| `t.MaxFPS 0` (console) | Uncapped | Remove UE5 FPS ceiling during perf test |

---

## 8. Headless Deployment (Production)

When running UE5 in headless packaged build (no Editor):

```bash
UE5Game.exe /Game/Maps/SomaticTest \
  -NoUI -RenderOffScreen -PixelStreamingURL=ws://localhost:8888 \
  -log
```

Then run `a2f_osc_bridge.py` as a sidecar — it connects to the packaged binary
via UDP port 5005 (no OSC plugin reconfiguration needed).

---

## References

- `packages/somatic/scripts/a2f_osc_bridge.py` — the OSC broadcast sidecar
- `packages/somatic/src/SomaticBridge.ts` — HTTP bridge
- Unreal Engine OSC Plugin docs: <https://docs.unrealengine.com/5.3/en-US/osc-plugin-overview>
