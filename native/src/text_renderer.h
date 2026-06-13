#pragma once

#include <d2d1_1.h>
#include <dwrite.h>
#include <wrl/client.h>
#include <string>

struct TextStyle {
    std::wstring fontFamily = L"Inter";
    float fontSize = 60.0f;
    D2D1_COLOR_F color = D2D1::ColorF(D2D1::ColorF::White);
    bool bold = false;
    bool italic = false;
    bool underline = false;
    
    // Stroke/Outline properties
    float strokeWidth = 0.0f;
    D2D1_COLOR_F strokeColor = D2D1::ColorF(D2D1::ColorF::Black);

    // Drop Shadow properties
    bool hasShadow = false;
    float shadowOffsetX = 3.0f;
    float shadowOffsetY = 3.0f;
    D2D1_COLOR_F shadowColor = D2D1::ColorF(D2D1::ColorF::Black, 0.5f);

    // Alignment
    DWRITE_TEXT_ALIGNMENT hAlign = DWRITE_TEXT_ALIGNMENT_CENTER;
    DWRITE_PARAGRAPH_ALIGNMENT vAlign = DWRITE_PARAGRAPH_ALIGNMENT_CENTER;
};

class TextRenderer {
public:
    TextRenderer(ID2D1DeviceContext* context);
    ~TextRenderer();

    HRESULT DrawTextToTarget(
        ID2D1DeviceContext* context, 
        const std::wstring& text, 
        float x, float y, float w, float h, 
        const TextStyle& style
    );

private:
    Microsoft::WRL::ComPtr<IDWriteFactory> m_writeFactory;
    ID2D1DeviceContext* m_context; // Weak pointer managed by RenderEngine
};
