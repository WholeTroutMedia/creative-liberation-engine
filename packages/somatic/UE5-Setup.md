# UE5 Headless OSC Configuration — Project Omnimedia

To correctly receive the 60Hz UDP OSC blasts from `packages/somatic` into a headless Unreal Engine 5 MetaHuman project, ensure the following steps are configured:

## 1. Plugin Requirements

Ensure the **OSC** plugin (built-in Epic plugin) is enabled in your `.uproject`.
*(Optional but recommended: `monsieurgustav/UE-OSC` if you need custom struct mapping algorithms natively in C++)*

## 2. Server Configuration

1. Open your project in Unreal Editor.
2. Navigate to **Edit > Project Settings > Plugins > OSC**.
3. Set **Default Receive IP Address** to `0.0.0.0` to bind to all interfaces (or specifically the NAS IP if local).
4. Set **Default Receive Port** to `5005` (must match the `UDPEmitter` default port in Node.js).
5. Ensure firewall rules allow incoming UDP traffic on port 5005.

## 3. MetaHuman OSC Blueprint Wiring

You must wire the OSC receiver directly to the MetaHuman Face Animation Blueprint.

1. Open the `Face_AnimBP` associated with your MetaHuman.
2. In the Event Graph, initialize an **OSC Server** on `BeginPlay` targeting port 5005.
3. Bind the `OnOSCMessageReceived` event.
4. Filter incoming messages to ensure the address matches `/somatic/arkit`.
5. Extract the 52 float arguments.
6. The `AutonomicEngine.ts` packs the arguments in the exact order specified by the Apple ARKit standard. Map index `0` to `EyeBlinkLeft`, index `1` to `EyeLookDownLeft`, etc.
7. Apply these values to the `Modify Curve` animation node before passing it to the final pose.

## 4. Headless Execution

To run the MetaHuman renderer on a headless Linux/Windows runner without the editor:

```bash
# Launch the packaged project without rendering to a window, but still processing animations
<ProjectName>.exe -log -RenderOffScreen -NoUI
```

The `ContinuousLoop` flow and `AutonomicEngine` running on the Genkit server will now transparently animate the MetaHuman.
