#pragma once

#include <napi.h>
#include <d3d11.h>
#include <wrl/client.h>
#include <vector>
#include <memory>
#include <mutex>

class TextRenderer;
class TransitionEngine;

class RenderEngine : public Napi::ObjectWrap<RenderEngine> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    RenderEngine(const Napi::CallbackInfo& info);
    ~RenderEngine();

private:
    // JS API Methods
    Napi::Value Initialize(const Napi::CallbackInfo& info);
    Napi::Value UpdateLayerTexture(const Napi::CallbackInfo& info);
    Napi::Value CompositeLayers(const Napi::CallbackInfo& info);
    Napi::Value ReadCompositePixels(const Napi::CallbackInfo& info);
    Napi::Value ClearLayer(const Napi::CallbackInfo& info);
    Napi::Value SetTransition(const Napi::CallbackInfo& info);
    Napi::Value GetSharedTextureHandle(const Napi::CallbackInfo& info);

    // Internal Helpers
    HRESULT InitD3D11();
    void CleanupD3D11();
    HRESULT CreateTextureFromPixels(const uint8_t* pixels, int width, int height, ID3D11Texture2D** ppTexture, ID3D11ShaderResourceView** ppSRV);
    HRESULT CreateSharedTexture(int width, int height, ID3D11Texture2D** ppTexture, HANDLE* pSharedHandle);

    // DirectX 11 Interfaces
    Microsoft::WRL::ComPtr<ID3D11Device> m_d3dDevice;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_d3dContext;
    
    // Layer Textures and Views
    // 0: Media, 1: Slide, 2: Props, 3: Announcement
    static const int LAYER_COUNT = 4;
    Microsoft::WRL::ComPtr<ID3D11Texture2D> m_layerTextures[LAYER_COUNT];
    Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> m_layerSRVs[LAYER_COUNT];
    HANDLE m_layerSharedHandles[LAYER_COUNT];

    // Compositing Render Targets
    Microsoft::WRL::ComPtr<ID3D11Texture2D> m_compositeTexture;
    Microsoft::WRL::ComPtr<ID3D11RenderTargetView> m_compositeRTV;
    Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> m_compositeSRV;
    HANDLE m_compositeSharedHandle;

    // Staging texture for reading pixels back to Host Memory (JS Buffer)
    Microsoft::WRL::ComPtr<ID3D11Texture2D> m_stagingTexture;

    // Direct3D States
    Microsoft::WRL::ComPtr<ID3D11BlendState> m_blendState;
    Microsoft::WRL::ComPtr<ID3D11SamplerState> m_samplerState;
    Microsoft::WRL::ComPtr<ID3D11RasterizerState> m_rasterizerState;

    // Sub-Engines
    std::unique_ptr<TextRenderer> m_textRenderer;
    std::unique_ptr<TransitionEngine> m_transitionEngine;

    // Dimensions
    int m_width = 1920;
    int m_height = 1080;
    bool m_initialized = false;
    std::mutex m_renderMutex;
};
