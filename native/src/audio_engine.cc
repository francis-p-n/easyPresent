#include "audio_engine.h"
#include <iostream>

#pragma comment(lib, "ole32.lib")

Napi::Object AudioEngine::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "AudioEngine", {
        InstanceMethod("loadAudio", &AudioEngine::LoadAudio),
        InstanceMethod("play", &AudioEngine::Play),
        InstanceMethod("pause", &AudioEngine::Pause),
        InstanceMethod("stop", &AudioEngine::Stop),
        InstanceMethod("setVolume", &AudioEngine::SetVolume),
        InstanceMethod("getDuration", &AudioEngine::GetDuration),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("AudioEngine", func);
    return exports;
}

AudioEngine::AudioEngine(const Napi::CallbackInfo& info) : Napi::ObjectWrap<AudioEngine>(info) {
    HRESULT hr = InitializeAudio();
    if (FAILED(hr)) {
        Napi::Error::New(info.Env(), "Failed to initialize WASAPI Audio Engine").ThrowAsJavaScriptException();
    }
}

AudioEngine::~AudioEngine() {
    m_isRendering = false;
    if (m_renderThread.joinable()) {
        m_renderThread.join();
    }
    if (m_pAudioClient) {
        m_pAudioClient->Stop();
    }
}

HRESULT AudioEngine::InitializeAudio() {
    HRESULT hr = CoInitializeEx(NULL, COINIT_MULTITHREADED);
    if (FAILED(hr)) return hr;

    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), NULL, CLSCTX_ALL, __uuidof(IMMDeviceEnumerator), (void**)&m_pEnumerator);
    if (FAILED(hr)) return hr;

    hr = m_pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &m_pDevice);
    if (FAILED(hr)) return hr;

    hr = m_pDevice->Activate(__uuidof(IAudioClient), CLSCTX_ALL, NULL, (void**)&m_pAudioClient);
    if (FAILED(hr)) return hr;

    WAVEFORMATEX* pFormat = nullptr;
    hr = m_pAudioClient->GetMixFormat(&pFormat);
    if (FAILED(hr)) return hr;

    hr = m_pAudioClient->Initialize(AUDCLNT_SHAREMODE_SHARED, 0, 10000000, 0, pFormat, NULL);
    CoTaskMemFree(pFormat);
    if (FAILED(hr)) return hr;

    hr = m_pAudioClient->GetService(__uuidof(IAudioRenderClient), (void**)&m_pRenderClient);
    
    m_isRendering = true;
    m_renderThread = std::thread(&AudioEngine::RenderLoop, this);
    
    return hr;
}

void AudioEngine::RenderLoop() {
    UINT32 bufferFrameCount;
    m_pAudioClient->GetBufferSize(&bufferFrameCount);

    while (m_isRendering) {
        if (!m_isPlaying) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }

        UINT32 numFramesPadding;
        m_pAudioClient->GetCurrentPadding(&numFramesPadding);

        UINT32 numFramesAvailable = bufferFrameCount - numFramesPadding;
        if (numFramesAvailable == 0) {
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
            continue;
        }

        BYTE* pData;
        HRESULT hr = m_pRenderClient->GetBuffer(numFramesAvailable, &pData);
        if (SUCCEEDED(hr)) {
            // Write silence for now (mocking the decode process)
            memset(pData, 0, numFramesAvailable * 4); // Assuming 32-bit float stereo = 8 bytes per frame, but let's just write 0s
            
            m_pRenderClient->ReleaseBuffer(numFramesAvailable, 0);
        }
    }
}

Napi::Value AudioEngine::LoadAudio(const Napi::CallbackInfo& info) {
    // In a full app, decode audio using Media Foundation into a PCM buffer in memory.
    return Napi::Boolean::New(info.Env(), true);
}

Napi::Value AudioEngine::Play(const Napi::CallbackInfo& info) {
    if (m_pAudioClient) {
        m_pAudioClient->Start();
    }
    m_isPlaying = true;
    return info.Env().Undefined();
}

Napi::Value AudioEngine::Pause(const Napi::CallbackInfo& info) {
    if (m_pAudioClient) {
        m_pAudioClient->Stop();
    }
    m_isPlaying = false;
    return info.Env().Undefined();
}

Napi::Value AudioEngine::Stop(const Napi::CallbackInfo& info) {
    if (m_pAudioClient) {
        m_pAudioClient->Stop();
        m_pAudioClient->Reset();
    }
    m_isPlaying = false;
    return info.Env().Undefined();
}

Napi::Value AudioEngine::SetVolume(const Napi::CallbackInfo& info) {
    if (info.Length() > 0 && info[0].IsNumber()) {
        m_volume = info[0].As<Napi::Number>().FloatValue();
        // Here we'd apply the volume multiplier when writing PCM data
    }
    return info.Env().Undefined();
}

Napi::Value AudioEngine::GetDuration(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), m_duration);
}
