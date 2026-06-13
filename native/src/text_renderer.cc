#include "text_renderer.h"
#include <wrl/client.h>
#include <iostream>

using Microsoft::WRL::ComPtr;

// Custom IDWriteTextRenderer for stroke/outline support
class CustomTextRenderer : public IDWriteTextRenderer {
private:
    ULONG m_refCount;
    ID2D1DeviceContext* m_context;
    ComPtr<ID2D1Factory> m_d2dFactory;
    ID2D1Brush* m_fillBrush;
    ID2D1Brush* m_strokeBrush;
    float m_strokeWidth;

public:
    CustomTextRenderer(ID2D1DeviceContext* context, ID2D1Factory* factory, ID2D1Brush* fillBrush, ID2D1Brush* strokeBrush, float strokeWidth)
        : m_refCount(1), m_context(context), m_d2dFactory(factory), m_fillBrush(fillBrush), m_strokeBrush(strokeBrush), m_strokeWidth(strokeWidth) {}

    // IUnknown
    IFACEMETHODIMP QueryInterface(REFIID riid, void** ppvObject) {
        if (riid == __uuidof(IDWriteTextRenderer) || riid == __uuidof(IDWritePixelSnapping) || riid == __uuidof(IUnknown)) {
            *ppvObject = this;
            AddRef();
            return S_OK;
        }
        *ppvObject = nullptr;
        return E_NOINTERFACE;
    }
    IFACEMETHODIMP_(ULONG) AddRef() { return InterlockedIncrement(&m_refCount); }
    IFACEMETHODIMP_(ULONG) Release() {
        ULONG newRef = InterlockedDecrement(&m_refCount);
        if (newRef == 0) {
            delete this;
            return 0;
        }
        return newRef;
    }

    // IDWritePixelSnapping
    IFACEMETHODIMP IsPixelSnappingDisabled(void* clientDrawingContext, BOOL* isDisabled) {
        *isDisabled = FALSE;
        return S_OK;
    }
    IFACEMETHODIMP GetCurrentTransform(void* clientDrawingContext, DWRITE_MATRIX* transform) {
        m_context->GetTransform(reinterpret_cast<D2D1_MATRIX_3X2_F*>(transform));
        return S_OK;
    }
    IFACEMETHODIMP GetPixelsPerDip(void* clientDrawingContext, float* pixelsPerDip) {
        float dpiX, dpiY;
        m_context->GetDpi(&dpiX, &dpiY);
        *pixelsPerDip = dpiX / 96.0f;
        return S_OK;
    }

    // IDWriteTextRenderer
    IFACEMETHODIMP DrawGlyphRun(
        void* clientDrawingContext,
        float baselineOriginX,
        float baselineOriginY,
        DWRITE_MEASURING_MODE measuringMode,
        DWRITE_GLYPH_RUN const* glyphRun,
        DWRITE_GLYPH_RUN_DESCRIPTION const* glyphRunDescription,
        IUnknown* clientDrawingEffect
    ) {
        HRESULT hr = S_OK;

        ComPtr<ID2D1PathGeometry> pathGeometry;
        hr = m_d2dFactory->CreatePathGeometry(&pathGeometry);
        if (FAILED(hr)) return hr;

        ComPtr<ID2D1GeometrySink> sink;
        hr = pathGeometry->Open(&sink);
        if (FAILED(hr)) return hr;

        hr = glyphRun->fontFace->GetGlyphRunOutline(
            glyphRun->fontEmSize,
            glyphRun->glyphIndices,
            glyphRun->glyphAdvances,
            glyphRun->glyphOffsets,
            glyphRun->glyphCount,
            glyphRun->isSideways,
            glyphRun->bidiLevel % 2 == 1,
            sink.Get()
        );
        if (FAILED(hr)) return hr;

        hr = sink->Close();
        if (FAILED(hr)) return hr;

        D2D1_MATRIX_3X2_F matrix = D2D1::Matrix3x2F::Translation(baselineOriginX, baselineOriginY);
        ComPtr<ID2D1TransformedGeometry> transformedGeometry;
        hr = m_d2dFactory->CreateTransformedGeometry(pathGeometry.Get(), &matrix, &transformedGeometry);
        if (FAILED(hr)) return hr;

        // Draw fill
        m_context->FillGeometry(transformedGeometry.Get(), m_fillBrush);

        // Draw outline if stroke width is greater than 0
        if (m_strokeWidth > 0.0f) {
            m_context->DrawGeometry(transformedGeometry.Get(), m_strokeBrush, m_strokeWidth);
        }

        return S_OK;
    }

    IFACEMETHODIMP DrawUnderline(void* clientDrawingContext, float baselineOriginX, float baselineOriginY, DWRITE_UNDERLINE const* underline, IUnknown* clientDrawingEffect) {
        D2D1_RECT_F rect = D2D1::RectF(
            baselineOriginX,
            baselineOriginY + underline->offset,
            baselineOriginX + underline->width,
            baselineOriginY + underline->offset + underline->thickness
        );
        m_context->FillRectangle(rect, m_fillBrush);
        return S_OK;
    }

    IFACEMETHODIMP DrawStrikethrough(void* clientDrawingContext, float baselineOriginX, float baselineOriginY, DWRITE_STRIKETHROUGH const* strikethrough, IUnknown* clientDrawingEffect) {
        D2D1_RECT_F rect = D2D1::RectF(
            baselineOriginX,
            baselineOriginY + strikethrough->offset,
            baselineOriginX + strikethrough->width,
            baselineOriginY + strikethrough->offset + strikethrough->thickness
        );
        m_context->FillRectangle(rect, m_fillBrush);
        return S_OK;
    }

    IFACEMETHODIMP DrawInlineObject(void* clientDrawingContext, float originX, float originY, IDWriteInlineObject* inlineObject, BOOL isSideways, BOOL isRightToLeft, IUnknown* clientDrawingEffect) {
        return E_NOTIMPL;
    }
};

TextRenderer::TextRenderer(ID2D1DeviceContext* context) : m_context(context) {
    DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED, __uuidof(IDWriteFactory), &m_writeFactory);
}

TextRenderer::~TextRenderer() {}

HRESULT TextRenderer::DrawTextToTarget(
    ID2D1DeviceContext* context, 
    const std::wstring& text, 
    float x, float y, float w, float h, 
    const TextStyle& style
) {
    if (!context || !m_writeFactory) return E_POINTER;

    // Create Brushes
    ComPtr<ID2D1SolidColorBrush> fillBrush;
    HRESULT hr = context->CreateSolidColorBrush(style.color, &fillBrush);
    if (FAILED(hr)) return hr;

    ComPtr<ID2D1SolidColorBrush> strokeBrush;
    if (style.strokeWidth > 0.0f) {
        hr = context->CreateSolidColorBrush(style.strokeColor, &strokeBrush);
        if (FAILED(hr)) return hr;
    }

    ComPtr<ID2D1SolidColorBrush> shadowBrush;
    if (style.hasShadow) {
        hr = context->CreateSolidColorBrush(style.shadowColor, &shadowBrush);
        if (FAILED(hr)) return hr;
    }

    // Determine font weight and style
    DWRITE_FONT_WEIGHT weight = style.bold ? DWRITE_FONT_WEIGHT_BOLD : DWRITE_FONT_WEIGHT_NORMAL;
    DWRITE_FONT_STYLE fontStyle = style.italic ? DWRITE_FONT_STYLE_ITALIC : DWRITE_FONT_STYLE_NORMAL;

    // Create Text Format
    ComPtr<IDWriteTextFormat> textFormat;
    hr = m_writeFactory->CreateTextFormat(
        style.fontFamily.c_str(),
        nullptr,
        weight,
        fontStyle,
        DWRITE_FONT_STRETCH_NORMAL,
        style.fontSize,
        L"en-US",
        &textFormat
    );
    if (FAILED(hr)) return hr;

    // Setup Alignments
    textFormat->SetTextAlignment(style.hAlign);
    textFormat->SetParagraphAlignment(style.vAlign);

    // Create Text Layout
    ComPtr<IDWriteTextLayout> textLayout;
    hr = m_writeFactory->CreateTextLayout(
        text.c_str(),
        static_cast<UINT32>(text.length()),
        textFormat.Get(),
        w,
        h,
        &textLayout
    );
    if (FAILED(hr)) return hr;

    // Apply underlines if requested
    if (style.underline) {
        DWRITE_TEXT_RANGE range = { 0, static_cast<UINT32>(text.length()) };
        textLayout->SetUnderline(TRUE, range);
    }

    // Get the D2D factory from context for geometry generation
    ComPtr<ID2D1Factory> factory;
    context->GetFactory(&factory);

    // 1. Draw Drop Shadow (First layer, offset)
    if (style.hasShadow) {
        context->SaveDrawingState(nullptr);
        
        // Draw the text layout with shadow brush, shifted slightly
        // Since shadows are flat, we render standard text layout if no stroke.
        // If stroke exists, we render the stroke + fill in shadow color.
        if (style.strokeWidth > 0.0f) {
            CustomTextRenderer* shadowRenderer = new CustomTextRenderer(
                context, 
                factory.Get(), 
                shadowBrush.Get(), 
                shadowBrush.Get(), 
                style.strokeWidth
            );
            textLayout->Draw(nullptr, shadowRenderer, x + style.shadowOffsetX, y + style.shadowOffsetY);
            shadowRenderer->Release();
        } else {
            D2D1_POINT_2F origin = D2D1::Point2F(x + style.shadowOffsetX, y + style.shadowOffsetY);
            context->DrawTextLayout(origin, textLayout.Get(), shadowBrush.Get());
        }
        context->RestoreDrawingState(nullptr);
    }

    // 2. Draw Foreground Text
    if (style.strokeWidth > 0.0f) {
        CustomTextRenderer* textRenderer = new CustomTextRenderer(
            context, 
            factory.Get(), 
            fillBrush.Get(), 
            strokeBrush.Get(), 
            style.strokeWidth
        );
        hr = textLayout->Draw(nullptr, textRenderer, x, y);
        textRenderer->Release();
    } else {
        D2D1_POINT_2F origin = D2D1::Point2F(x, y);
        context->DrawTextLayout(origin, textLayout.Get(), fillBrush.Get());
        hr = S_OK;
    }

    return hr;
}
