#include "video_decoder.h"
#include <iostream>

#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfuuid.lib")
#pragma comment(lib, "mfreadwrite.lib")

using Microsoft::WRL::ComPtr;

Napi::Object VideoDecoder::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoDecoder", {
        InstanceMethod("loadMedia", &VideoDecoder::LoadMedia),
        InstanceMethod("play", &VideoDecoder::Play),
        InstanceMethod("pause", &VideoDecoder::Pause),
        InstanceMethod("stop", &VideoDecoder::Stop),
        InstanceMethod("seek", &VideoDecoder::Seek),
        InstanceMethod("setLooping", &VideoDecoder::SetLooping),
        InstanceMethod("getDuration", &VideoDecoder::GetDuration),
        InstanceMethod("getCurrentTime", &VideoDecoder::GetCurrentTimeCode),
    });

    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);

    exports.Set("VideoDecoder", func);
    return exports;
}

VideoDecoder::VideoDecoder(const Napi::CallbackInfo& info) : Napi::ObjectWrap<VideoDecoder>(info) {
    HRESULT hr = InitializeMediaFoundation();
    if (FAILED(hr)) {
        Napi::Error::New(info.Env(), "Failed to initialize Media Foundation").ThrowAsJavaScriptException();
    }
}

VideoDecoder::~VideoDecoder() {
    MFShutdown();
}

HRESULT VideoDecoder::InitializeMediaFoundation() {
    return MFStartup(MF_VERSION);
}

void VideoDecoder::SetRenderEngine(RenderEngine* engine) {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_pRenderEngine = engine;
}

ID3D11ShaderResourceView* VideoDecoder::GetCurrentFrameSRV() {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_pCurrentFrameSRV;
}

void VideoDecoder::Update(float deltaTime) {
    if (!m_isPlaying) return;
    ProcessNextFrame();
}

Napi::Value VideoDecoder::LoadMedia(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::u16string pathStr = info[0].As<Napi::String>().Utf16Value();
    std::wstring path(pathStr.begin(), pathStr.end());
    
    HRESULT hr = OpenFile(path);
    return Napi::Boolean::New(env, SUCCEEDED(hr));
}

HRESULT VideoDecoder::OpenFile(const std::wstring& filePath) {
    std::lock_guard<std::mutex> lock(m_mutex);
    ComPtr<IMFAttributes> pAttributes;
    HRESULT hr = MFCreateAttributes(&pAttributes, 1);
    if (SUCCEEDED(hr)) {
        hr = pAttributes->SetUINT32(MF_SOURCE_READER_ENABLE_VIDEO_PROCESSING, TRUE);
        if (SUCCEEDED(hr)) {
            hr = MFCreateSourceReaderFromURL(filePath.c_str(), pAttributes.Get(), &m_pReader);
        }
    }
    
    if (SUCCEEDED(hr)) {
        ComPtr<IMFMediaType> pMediaType;
        hr = MFCreateMediaType(&pMediaType);
        if (SUCCEEDED(hr)) {
            pMediaType->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Video);
            pMediaType->SetGUID(MF_MT_SUBTYPE, MFVideoFormat_RGB32);
            hr = m_pReader->SetCurrentMediaType(MF_SOURCE_READER_FIRST_VIDEO_STREAM, NULL, pMediaType.Get());
        }
        
        // Get duration
        PROPVARIANT var;
        PropVariantInit(&var);
        if (SUCCEEDED(m_pReader->GetPresentationAttribute(MF_SOURCE_READER_MEDIASOURCE, MF_PD_DURATION, &var))) {
            if (var.vt == VT_UI8) {
                m_duration = static_cast<double>(var.uhVal.QuadPart) / 10000000.0;
            }
            PropVariantClear(&var);
        }
    }
    
    m_currentTime = 0;
    return hr;
}

HRESULT VideoDecoder::ProcessNextFrame() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!m_pReader) return E_FAIL;
    
    DWORD streamIndex, flags;
    LONGLONG timestamp;
    ComPtr<IMFSample> pSample;
    
    HRESULT hr = m_pReader->ReadSample(
        MF_SOURCE_READER_FIRST_VIDEO_STREAM,
        0, &streamIndex, &flags, &timestamp, &pSample
    );
    
    if (SUCCEEDED(hr)) {
        if (flags & MF_SOURCE_READERF_ENDOFSTREAM) {
            if (m_isLooping) {
                PROPVARIANT var;
                PropVariantInit(&var);
                var.vt = VT_I8;
                var.hVal.QuadPart = 0;
                m_pReader->SetCurrentPosition(GUID_NULL, var);
                PropVariantClear(&var);
                m_currentTime = 0;
            } else {
                m_isPlaying = false;
            }
        } else if (pSample) {
            m_currentTime = static_cast<double>(timestamp) / 10000000.0;
            // TODO: Extract ID3D11Texture2D from sample and create SRV, updating m_pCurrentFrameSRV
        }
    }
    return hr;
}

Napi::Value VideoDecoder::Play(const Napi::CallbackInfo& info) {
    m_isPlaying = true;
    return info.Env().Undefined();
}

Napi::Value VideoDecoder::Pause(const Napi::CallbackInfo& info) {
    m_isPlaying = false;
    return info.Env().Undefined();
}

Napi::Value VideoDecoder::Stop(const Napi::CallbackInfo& info) {
    m_isPlaying = false;
    if (m_pReader) {
        PROPVARIANT var;
        PropVariantInit(&var);
        var.vt = VT_I8;
        var.hVal.QuadPart = 0;
        m_pReader->SetCurrentPosition(GUID_NULL, var);
        PropVariantClear(&var);
        m_currentTime = 0;
    }
    return info.Env().Undefined();
}

Napi::Value VideoDecoder::Seek(const Napi::CallbackInfo& info) {
    if (info.Length() > 0 && info[0].IsNumber() && m_pReader) {
        double timeSecs = info[0].As<Napi::Number>().DoubleValue();
        PROPVARIANT var;
        PropVariantInit(&var);
        var.vt = VT_I8;
        var.hVal.QuadPart = static_cast<LONGLONG>(timeSecs * 10000000.0);
        m_pReader->SetCurrentPosition(GUID_NULL, var);
        PropVariantClear(&var);
        m_currentTime = timeSecs;
    }
    return info.Env().Undefined();
}

Napi::Value VideoDecoder::SetLooping(const Napi::CallbackInfo& info) {
    if (info.Length() > 0 && info[0].IsBoolean()) {
        m_isLooping = info[0].As<Napi::Boolean>().Value();
    }
    return info.Env().Undefined();
}

Napi::Value VideoDecoder::GetDuration(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), m_duration);
}

Napi::Value VideoDecoder::GetCurrentTimeCode(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), m_currentTime);
}
