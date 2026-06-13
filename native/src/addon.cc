#include <napi.h>
#include "render_engine.h"
#include "video_decoder.h"
#include "audio_engine.h"

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    RenderEngine::Init(env, exports);
    VideoDecoder::Init(env, exports);
    AudioEngine::Init(env, exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll)
