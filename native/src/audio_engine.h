#pragma once

#include <napi.h>
#include <Audioclient.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <string>
#include <mutex>
#include <thread>
#include <atomic>

class AudioEngine : public Napi::ObjectWrap<AudioEngine> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioEngine(const Napi::CallbackInfo& info);
    ~AudioEngine();

private:
    Napi::Value LoadAudio(const Napi::CallbackInfo& info);
    Napi::Value Play(const Napi::CallbackInfo& info);
    Napi::Value Pause(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value SetVolume(const Napi::CallbackInfo& info);
    Napi::Value GetDuration(const Napi::CallbackInfo& info);

    HRESULT InitializeAudio();
    HRESULT OpenFile(const std::wstring& filePath);
    void RenderLoop();

    Microsoft::WRL::ComPtr<IMMDeviceEnumerator> m_pEnumerator;
    Microsoft::WRL::ComPtr<IMMDevice> m_pDevice;
    Microsoft::WRL::ComPtr<IAudioClient> m_pAudioClient;
    Microsoft::WRL::ComPtr<IAudioRenderClient> m_pRenderClient;

    std::thread m_renderThread;
    std::atomic<bool> m_isRendering{false};
    std::atomic<bool> m_isPlaying{false};
    
    float m_volume = 1.0f;
    double m_duration = 0.0;
    
    // In a full implementation, we'd use Media Foundation to decode audio into PCM buffers
    // For now, this acts as the interface definition.
    
    std::mutex m_mutex;
};
