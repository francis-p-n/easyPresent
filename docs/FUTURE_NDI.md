# NDI Output — Future Implementation

## Overview
NDI (Network Device Interface) by Vizrt allows video and audio to be sent over a standard local network. This would allow our ProPresenter clone to output its composited frames to any NDI-compatible receiver (e.g., OBS, vMix, broadcast switchers, other computers).

## Architecture
NDI output will be implemented as a C++ native addon (`NdiOutput.node`) that receives rendered frames from the `RenderEngine` and sends them over the network.

### Dependencies
- **NDI SDK** (free download from https://ndi.video/tools/ndi-sdk/)
- Requires accepting Vizrt's license agreement
- SDK provides C headers and libraries for Windows, macOS, Linux

### Implementation Plan

#### 1. C++ Native Addon
```
native/src/ndi_output.h
native/src/ndi_output.cc
```

**Key functions:**
- `NDIOutput::Initialize()` — Load NDI runtime, create sender
- `NDIOutput::SetSourceName(name)` — Set the NDI source name visible on the network
- `NDIOutput::SendFrame(pixelBuffer, width, height)` — Send a video frame
- `NDIOutput::SendAudioFrame(samples, channels, sampleRate)` — Send audio
- `NDIOutput::Destroy()` — Clean up resources

#### 2. JS Wrapper
```js
// src/engine/NdiOutput.js
import ndi from '../../build/Release/ndi_output.node'

export class NdiOutput {
  constructor(sourceName = 'ProPresenter Clone') {
    this.native = new ndi.NDIOutput()
    this.native.initialize()
    this.native.setSourceName(sourceName)
  }

  sendFrame(frameBuffer, width, height) {
    this.native.sendFrame(frameBuffer, width, height)
  }

  destroy() {
    this.native.destroy()
  }
}
```

#### 3. Integration Points
- Hook into `RenderEngine.compositeFrame()` — after compositing, pass the final frame to NDI
- Add UI toggle in Screen Configuration to enable/disable NDI output
- Add NDI source name field in settings
- Support alpha-key output (transparent background for lower-thirds overlay on broadcast)

### NDI Features to Support
| Feature | Priority | Notes |
|---------|----------|-------|
| Video output (BGRA) | High | Main use case |
| Audio output | Medium | Route master audio to NDI |
| Alpha key/fill | Medium | For broadcast lower-thirds |
| NDI discovery | Low | Find other NDI sources on network |
| NDI input (receive) | Low | Could receive camera feeds |

### Performance Considerations
- NDI uses its own compression codec — minimal CPU impact
- Frame data can be passed from DirectX texture via staging texture → CPU readback → NDI send
- For best performance, use `NDIlib_send_send_video_async_v2` for non-blocking sends
- Target: 1080p60 output with < 1ms added latency

### Testing
1. Install NDI Tools (free) — includes NDI Monitor for viewing output
2. Start the app with NDI enabled
3. Open NDI Monitor — the source should appear automatically
4. Verify video plays smoothly with correct colors and timing
