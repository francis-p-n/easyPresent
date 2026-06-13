#pragma once

#include <napi.h>
#include <d3d11.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <wrl/client.h>
#include <string>
#include <mutex>
#include <thread>
#include <atomic>

class RenderEngine; // Forward declaration

class VideoDecoder : public Napi::ObjectWrap<VideoDecoder> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoDecoder(const Napi::CallbackInfo& info);
    ~VideoDecoder();

    // Internal C++ API
    void SetRenderEngine(RenderEngine* engine);
    ID3D11ShaderResourceView* GetCurrentFrameSRV();
    void Update(float deltaTime);

private:
    // NAPI exported methods
    Napi::Value LoadMedia(const Napi::CallbackInfo& info);
    Napi::Value Play(const Napi::CallbackInfo& info);
    Napi::Value Pause(const Napi::CallbackInfo& info);
    Napi::Value Stop(const Napi::CallbackInfo& info);
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value SetLooping(const Napi::CallbackInfo& info);
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetCurrentTimeCode(const Napi::CallbackInfo& info);

    HRESULT InitializeMediaFoundation();
    HRESULT OpenFile(const std::wstring& filePath);
    HRESULT ProcessNextFrame();

    Microsoft::WRL::ComPtr<IMFSourceReader> m_pReader;
    Microsoft::WRL::ComPtr<IMFDXGIDeviceManager> m_pDeviceManager;
    
    RenderEngine* m_pRenderEngine = nullptr;
    ID3D11ShaderResourceView* m_pCurrentFrameSRV = nullptr;

    bool m_isPlaying = false;
    bool m_isLooping = false;
    double m_duration = 0.0;
    double m_currentTime = 0.0;
    
    std::mutex m_mutex;
};
