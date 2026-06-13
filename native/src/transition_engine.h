#pragma once

#include <d3d11.h>
#include <d2d1_1.h>
#include <wrl/client.h>

enum class TransitionType {
    Cut = 0,
    Dissolve = 1,
    WipeLeft = 2,
    WipeRight = 3,
    WipeTop = 4,
    WipeBottom = 5,
    PushLeft = 6,
    PushRight = 7,
    ZoomIn = 8,
    ZoomOut = 9
};

class TransitionEngine {
public:
    TransitionEngine(ID3D11Device* d3dDevice, ID3D11DeviceContext* d3dContext);
    ~TransitionEngine();

    HRESULT RenderTransition(
        ID2D1DeviceContext* d2dContext,
        ID2D1Bitmap1* sourceBitmap,
        ID2D1Bitmap1* targetBitmap,
        float progress, // 0.0f to 1.0f
        TransitionType type,
        int width,
        int height
    );

private:
    Microsoft::WRL::ComPtr<ID3D11Device> m_d3dDevice;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_d3dContext;
};
