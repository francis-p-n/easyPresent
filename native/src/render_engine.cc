#include "render_engine.h"
#include "text_renderer.h"
#include "transition_engine.h"
#include <d2d1_1.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <iostream>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "dwrite.lib")

// ComPtr namespaces
using Microsoft::WRL::ComPtr;

// Helper to create Direct2D Factory and Device
ComPtr<ID2D1Factory1> g_d2dFactory;
ComPtr<ID2D1Device> g_d2dDevice;
ComPtr<ID2D1DeviceContext> g_d2dContext;

Napi::Object RenderEngine::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "RenderEngine", {
        InstanceMethod("initialize", &RenderEngine::Initialize),
        InstanceMethod("updateLayerTexture", &RenderEngine::UpdateLayerTexture),
        InstanceMethod("compositeLayers", &RenderEngine::CompositeLayers),
        InstanceMethod("readCompositePixels", &RenderEngine::ReadCompositePixels),
        InstanceMethod("clearLayer", &RenderEngine::ClearLayer),
        InstanceMethod("setTransition", &RenderEngine::SetTransition),
        InstanceMethod("getSharedTextureHandle", &RenderEngine::GetSharedTextureHandle)
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("RenderEngine", func);
    return exports;
}

RenderEngine::RenderEngine(const Napi::CallbackInfo& info) : Napi::ObjectWrap<RenderEngine>(info) {
    Napi::Env env = info.Env();
    
    if (info.Length() >= 2) {
        m_width = info[0].As<Napi::Number>().Int32Value();
        m_height = info[1].As<Napi::Number>().Int32Value();
    }
    
    for (int i = 0; i < LAYER_COUNT; ++i) {
        m_layerSharedHandles[i] = nullptr;
    }
    m_compositeSharedHandle = nullptr;
}

RenderEngine::~RenderEngine() {
    CleanupD3D11();
}

Napi::Value RenderEngine::Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(m_renderMutex);

    if (m_initialized) {
        return Napi::Boolean::New(env, true);
    }

    HRESULT hr = InitD3D11();
    if (FAILED(hr)) {
        Napi::Error::New(env, "Failed to initialize D3D11 and Direct2D: HRESULT " + std::to_string(hr))
            .ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    m_textRenderer = std::make_unique<TextRenderer>(g_d2dContext.Get());
    m_transitionEngine = std::make_unique<TransitionEngine>(m_d3dDevice.Get(), m_d3dContext.Get());

    m_initialized = true;
    return Napi::Boolean::New(env, true);
}

HRESULT RenderEngine::InitD3D11() {
    // 1. Create D3D11 Device and Context
    UINT createDeviceFlags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
#ifdef _DEBUG
    createDeviceFlags |= D3D11_CREATE_DEVICE_DEBUG;
#endif

    D3D_FEATURE_LEVEL featureLevels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
        D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0
    };
    D3D_FEATURE_LEVEL featureLevel;

    HRESULT hr = D3D11CreateDevice(
        nullptr,                    // Specify nullptr to use the default adapter.
        D3D_DRIVER_TYPE_HARDWARE,   // Create a device using the hardware graphics driver.
        nullptr,                    // Should be 0 unless the driver is D3D_DRIVER_TYPE_SOFTWARE.
        createDeviceFlags,          // Set debug and Direct2D compatibility flags.
        featureLevels,              // List of feature levels this app can support.
        ARRAYSIZE(featureLevels),   // Size of the list above.
        D3D11_SDK_VERSION,          // Always set this to D3D11_SDK_VERSION for Windows Store apps.
        &m_d3dDevice,               // Returns the Direct3D device created.
        &featureLevel,              // Returns feature level of device created.
        &m_d3dContext               // Returns the device immediate context.
    );

    if (FAILED(hr)) {
        // Fallback to WARP software renderer if hardware is unavailable
        hr = D3D11CreateDevice(
            nullptr,
            D3D_DRIVER_TYPE_WARP,
            nullptr,
            createDeviceFlags,
            featureLevels,
            ARRAYSIZE(featureLevels),
            D3D11_SDK_VERSION,
            &m_d3dDevice,
            &featureLevel,
            &m_d3dContext
        );
    }

    if (FAILED(hr)) return hr;

    // 2. Initialize Direct2D Factory and Device
    D2D1_FACTORY_OPTIONS options;
    ZeroMemory(&options, sizeof(D2D1_FACTORY_OPTIONS));
#ifdef _DEBUG
    options.debugLevel = D2D1_DEBUG_LEVEL_INFORMATION;
#endif

    hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_MULTI_THREADED, __uuidof(ID2D1Factory1), &options, &g_d2dFactory);
    if (FAILED(hr)) return hr;

    ComPtr<IDXGIDevice> dxgiDevice;
    hr = m_d3dDevice.As(&dxgiDevice);
    if (FAILED(hr)) return hr;

    hr = g_d2dFactory->CreateDevice(dxgiDevice.Get(), &g_d2dDevice);
    if (FAILED(hr)) return hr;

    hr = g_d2dDevice->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE, &g_d2dContext);
    if (FAILED(hr)) return hr;

    // 3. Create Layer Textures (Shared textures for zero-copy IPC)
    for (int i = 0; i < LAYER_COUNT; ++i) {
        hr = CreateSharedTexture(m_width, m_height, &m_layerTextures[i], &m_layerSharedHandles[i]);
        if (FAILED(hr)) return hr;

        D3D11_SHADER_RESOURCE_VIEW_DESC srvDesc;
        ZeroMemory(&srvDesc, sizeof(srvDesc));
        srvDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        srvDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
        srvDesc.Texture2D.MostDetailedMip = 0;
        srvDesc.Texture2D.MipLevels = 1;

        hr = m_d3dDevice->CreateShaderResourceView(m_layerTextures[i].Get(), &srvDesc, &m_layerSRVs[i]);
        if (FAILED(hr)) return hr;
    }

    // 4. Create Composite Texture and Staging Texture
    hr = CreateSharedTexture(m_width, m_height, &m_compositeTexture, &m_compositeSharedHandle);
    if (FAILED(hr)) return hr;

    hr = m_d3dDevice->CreateRenderTargetView(m_compositeTexture.Get(), nullptr, &m_compositeRTV);
    if (FAILED(hr)) return hr;

    D3D11_SHADER_RESOURCE_VIEW_DESC compSrvDesc;
    ZeroMemory(&compSrvDesc, sizeof(compSrvDesc));
    compSrvDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    compSrvDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
    compSrvDesc.Texture2D.MostDetailedMip = 0;
    compSrvDesc.Texture2D.MipLevels = 1;
    hr = m_d3dDevice->CreateShaderResourceView(m_compositeTexture.Get(), &compSrvDesc, &m_compositeSRV);
    if (FAILED(hr)) return hr;

    // Create CPU staging texture (for ReadCompositePixels)
    D3D11_TEXTURE2D_DESC stagingDesc;
    ZeroMemory(&stagingDesc, sizeof(stagingDesc));
    stagingDesc.Width = m_width;
    stagingDesc.Height = m_height;
    stagingDesc.MipLevels = 1;
    stagingDesc.ArraySize = 1;
    stagingDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    stagingDesc.SampleDesc.Count = 1;
    stagingDesc.Usage = D3D11_USAGE_STAGING;
    stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    stagingDesc.BindFlags = 0;
    stagingDesc.MiscFlags = 0;

    hr = m_d3dDevice->CreateTexture2D(&stagingDesc, nullptr, &m_stagingTexture);
    if (FAILED(hr)) return hr;

    return S_OK;
}

HRESULT RenderEngine::CreateSharedTexture(int width, int height, ID3D11Texture2D** ppTexture, HANDLE* pSharedHandle) {
    D3D11_TEXTURE2D_DESC desc;
    ZeroMemory(&desc, sizeof(desc));
    desc.Width = width;
    desc.Height = height;
    desc.MipLevels = 1;
    desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM; // Match Direct2D BGRA layout
    desc.SampleDesc.Count = 1;
    desc.SampleDesc.Quality = 0;
    desc.Usage = D3D11_USAGE_DEFAULT;
    desc.BindFlags = D3D11_BIND_RENDER_TARGET | D3D11_BIND_SHADER_RESOURCE;
    desc.CPUAccessFlags = 0;
    desc.MiscFlags = D3D11_RESOURCE_MISC_SHARED_KEYEDMUTEX | D3D11_RESOURCE_MISC_SHARED; // Shared handle support

    HRESULT hr = m_d3dDevice->CreateTexture2D(&desc, nullptr, ppTexture);
    if (FAILED(hr)) return hr;

    // Get the DXGI shared resource handle
    ComPtr<IDXGIResource> dxgiResource;
    hr = (*ppTexture)->QueryInterface(IID_PPV_ARGS(&dxgiResource));
    if (SUCCEEDED(hr)) {
        hr = dxgiResource->GetSharedHandle(pSharedHandle);
    }

    return hr;
}

void RenderEngine::CleanupD3D11() {
    m_textRenderer.reset();
    m_transitionEngine.reset();

    for (int i = 0; i < LAYER_COUNT; ++i) {
        m_layerTextures[i].Reset();
        m_layerSRVs[i].Reset();
        m_layerSharedHandles[i] = nullptr;
    }

    m_compositeTexture.Reset();
    m_compositeRTV.Reset();
    m_compositeSRV.Reset();
    m_compositeSharedHandle = nullptr;

    m_stagingTexture.Reset();
    m_blendState.Reset();
    m_samplerState.Reset();
    m_rasterizerState.Reset();

    g_d2dContext.Reset();
    g_d2dDevice.Reset();
    g_d2dFactory.Reset();

    m_d3dContext.Reset();
    m_d3dDevice.Reset();
    m_initialized = false;
}

Napi::Value RenderEngine::UpdateLayerTexture(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(m_renderMutex);

    if (!m_initialized) {
        Napi::Error::New(env, "RenderEngine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    if (info.Length() < 4) {
        Napi::Error::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    int layerIndex = info[0].As<Napi::Number>().Int32Value();
    if (layerIndex < 0 || layerIndex >= LAYER_COUNT) {
        Napi::Error::New(env, "Invalid layer index").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = info[1].As<Napi::Buffer<uint8_t>>();
    int texWidth = info[2].As<Napi::Number>().Int32Value();
    int texHeight = info[3].As<Napi::Number>().Int32Value();

    // Map pointer to pixels
    const uint8_t* pixels = buffer.Data();

    // Update texture using UpdateSubresource
    D3D11_BOX box;
    box.left = 0;
    box.right = texWidth;
    box.top = 0;
    box.bottom = texHeight;
    box.front = 0;
    box.back = 1;

    m_d3dContext->UpdateSubresource(
        m_layerTextures[layerIndex].Get(),
        0,
        &box,
        pixels,
        texWidth * 4, // 4 bytes per pixel (BGRA)
        0
    );

    return Napi::Boolean::New(env, true);
}

Napi::Value RenderEngine::CompositeLayers(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(m_renderMutex);

    if (!m_initialized) {
        return Napi::Boolean::New(env, false);
    }

    // Direct2D composite pipeline
    ComPtr<IDXGISurface> dxgiSurface;
    HRESULT hr = m_compositeTexture.As(&dxgiSurface);
    if (FAILED(hr)) return Napi::Boolean::New(env, false);

    ComPtr<ID2D1Bitmap1> targetBitmap;
    D2D1_BITMAP_PROPERTIES1 bitmapProperties = D2D1::BitmapProperties1(
        D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
        D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED)
    );

    hr = g_d2dContext->CreateBitmapFromDxgiSurface(dxgiSurface.Get(), &bitmapProperties, &targetBitmap);
    if (FAILED(hr)) return Napi::Boolean::New(env, false);

    g_d2dContext->SetTarget(targetBitmap.Get());
    g_d2dContext->BeginDraw();
    
    // Clear to black backdrop
    g_d2dContext->Clear(D2D1::ColorF(D2D1::ColorF::Black, 1.0f));

    // Render layers in sequence: Media (0) -> Slide (1) -> Props (2) -> Announcement (3)
    for (int i = 0; i < LAYER_COUNT; ++i) {
        ComPtr<IDXGISurface> layerSurface;
        hr = m_layerTextures[i].As(&layerSurface);
        if (FAILED(hr)) continue;

        ComPtr<ID2D1Bitmap1> layerBitmap;
        D2D1_BITMAP_PROPERTIES1 layerProps = D2D1::BitmapProperties1(
            D2D1_BITMAP_OPTIONS_NONE,
            D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED)
        );

        hr = g_d2dContext->CreateBitmapFromDxgiSurface(layerSurface.Get(), &layerProps, &layerBitmap);
        if (FAILED(hr)) continue;

        // Draw the layer with standard straight alpha blending (governed by target mode)
        g_d2dContext->DrawImage(layerBitmap.Get());
    }

    // Perform Direct2D Draw calls
    hr = g_d2dContext->EndDraw();
    if (FAILED(hr)) return Napi::Boolean::New(env, false);

    return Napi::Boolean::New(env, true);
}

Napi::Value RenderEngine::ReadCompositePixels(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(m_renderMutex);

    if (!m_initialized) {
        Napi::Error::New(env, "RenderEngine not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Copy composite GPU texture to local CPU staging texture
    m_d3dContext->CopyResource(m_stagingTexture.Get(), m_compositeTexture.Get());

    // Map staging texture for CPU read access
    D3D11_MAPPED_SUBRESOURCE mappedResource;
    HRESULT hr = m_d3dContext->Map(m_stagingTexture.Get(), 0, D3D11_MAP_READ, 0, &mappedResource);
    if (FAILED(hr)) {
        Napi::Error::New(env, "Failed to map composite staging texture").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Create a new JS Buffer to copy pixel data back to Javascript
    size_t size = m_width * m_height * 4;
    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::New(env, size);
    uint8_t* pDest = buffer.Data();
    uint8_t* pSrc = reinterpret_cast<uint8_t*>(mappedResource.pData);

    for (int y = 0; y < m_height; ++y) {
        memcpy(pDest + (y * m_width * 4), pSrc + (y * mappedResource.RowPitch), m_width * 4);
    }

    m_d3dContext->Unmap(m_stagingTexture.Get(), 0);

    return buffer;
}

Napi::Value RenderEngine::ClearLayer(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::lock_guard<std::mutex> lock(m_renderMutex);

    if (!m_initialized) {
        return Napi::Boolean::New(env, false);
    }

    if (info.Length() < 1) {
        Napi::Error::New(env, "Layer index required").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    int layerIndex = info[0].As<Napi::Number>().Int32Value();
    if (layerIndex < 0 || layerIndex >= LAYER_COUNT) {
        Napi::Error::New(env, "Invalid layer index").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    // Direct2D clear layer texture to fully transparent
    ComPtr<IDXGISurface> layerSurface;
    HRESULT hr = m_layerTextures[layerIndex].As(&layerSurface);
    if (FAILED(hr)) return Napi::Boolean::New(env, false);

    ComPtr<ID2D1Bitmap1> layerBitmap;
    D2D1_BITMAP_PROPERTIES1 layerProps = D2D1::BitmapProperties1(
        D2D1_BITMAP_OPTIONS_TARGET,
        D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED)
    );

    hr = g_d2dContext->CreateBitmapFromDxgiSurface(layerSurface.Get(), &layerProps, &layerBitmap);
    if (FAILED(hr)) return Napi::Boolean::New(env, false);

    g_d2dContext->SetTarget(layerBitmap.Get());
    g_d2dContext->BeginDraw();
    g_d2dContext->Clear(D2D1::ColorF(0.0f, 0.0f, 0.0f, 0.0f)); // Transparent
    hr = g_d2dContext->EndDraw();

    return Napi::Boolean::New(env, SUCCEEDED(hr));
}

Napi::Value RenderEngine::SetTransition(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // Transition settings will be passed through to the TransitionEngine sub-component
    return Napi::Boolean::New(env, true);
}

Napi::Value RenderEngine::GetSharedTextureHandle(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        Napi::Error::New(env, "Layer index required (-1 for composite)").ThrowAsJavaScriptException();
        return env.Null();
    }

    int layerIndex = info[0].As<Napi::Number>().Int32Value();
    HANDLE handle = nullptr;
    
    if (layerIndex == -1) {
        handle = m_compositeSharedHandle;
    } else if (layerIndex >= 0 && layerIndex < LAYER_COUNT) {
        handle = m_layerSharedHandles[layerIndex];
    } else {
        Napi::Error::New(env, "Invalid layer index").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Represent the Win32 HANDLE as a JS Number/Pointer
    return Napi::Number::New(env, reinterpret_cast<uintptr_t>(handle));
}
