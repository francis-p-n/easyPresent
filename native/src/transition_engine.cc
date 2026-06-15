#include "transition_engine.h"

using Microsoft::WRL::ComPtr;

TransitionEngine::TransitionEngine(ID3D11Device* d3dDevice, ID3D11DeviceContext* d3dContext)
    : m_d3dDevice(d3dDevice), m_d3dContext(d3dContext) {}

TransitionEngine::~TransitionEngine() {}

HRESULT TransitionEngine::RenderTransition(
    ID2D1DeviceContext* d2dContext,
    ID2D1Bitmap1* sourceBitmap,
    ID2D1Bitmap1* targetBitmap,
    float progress,
    TransitionType type,
    int width,
    int height
) {
    if (!d2dContext || !sourceBitmap || !targetBitmap) return E_POINTER;

    D2D1_RECT_F fullRect = D2D1::RectF(0.0f, 0.0f, static_cast<float>(width), static_cast<float>(height));
    D2D1_POINT_2F centerPoint = D2D1::Point2F(width / 2.0f, height / 2.0f);

    // Save previous transform state
    D2D1_MATRIX_3X2_F originalTransform;
    d2dContext->GetTransform(&originalTransform);

    // Perform the transitions using Direct2D 2D transformation matrix operations
    switch (type) {
        case TransitionType::Cut: {
            if (progress < 1.0f) {
                d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            } else {
                d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            }
            break;
        }

        case TransitionType::Dissolve: {
            // Draw background source fading out
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f - progress, D2D1_INTERPOLATION_MODE_LINEAR);
            // Draw target slide fading in
            d2dContext->DrawBitmap(targetBitmap, &fullRect, progress, D2D1_INTERPOLATION_MODE_LINEAR);
            break;
        }

        case TransitionType::WipeRight: {
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            
            // Clip target to slide in from left to right
            D2D1_RECT_F clipRect = D2D1::RectF(0.0f, 0.0f, width * progress, static_cast<float>(height));
            d2dContext->PushAxisAlignedClip(&clipRect, D2D1_ANTIALIAS_MODE_ALIASED);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            d2dContext->PopAxisAlignedClip();
            break;
        }

        case TransitionType::WipeLeft: {
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);

            // Clip target to slide in from right to left
            D2D1_RECT_F clipRect = D2D1::RectF(width * (1.0f - progress), 0.0f, static_cast<float>(width), static_cast<float>(height));
            d2dContext->PushAxisAlignedClip(&clipRect, D2D1_ANTIALIAS_MODE_ALIASED);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            d2dContext->PopAxisAlignedClip();
            break;
        }

        case TransitionType::WipeTop: {
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);

            // Clip target to slide in from top to bottom
            D2D1_RECT_F clipRect = D2D1::RectF(0.0f, 0.0f, static_cast<float>(width), height * progress);
            d2dContext->PushAxisAlignedClip(&clipRect, D2D1_ANTIALIAS_MODE_ALIASED);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            d2dContext->PopAxisAlignedClip();
            break;
        }

        case TransitionType::WipeBottom: {
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);

            // Clip target to slide in from bottom to top
            D2D1_RECT_F clipRect = D2D1::RectF(0.0f, height * (1.0f - progress), static_cast<float>(width), static_cast<float>(height));
            d2dContext->PushAxisAlignedClip(&clipRect, D2D1_ANTIALIAS_MODE_ALIASED);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            d2dContext->PopAxisAlignedClip();
            break;
        }

        case TransitionType::PushLeft: {
            // Translate source out to the left
            d2dContext->SetTransform(D2D1::Matrix3x2F::Translation(-progress * width, 0.0f) * originalTransform);
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);

            // Translate target in from the right
            d2dContext->SetTransform(D2D1::Matrix3x2F::Translation((1.0f - progress) * width, 0.0f) * originalTransform);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            break;
        }

        case TransitionType::PushRight: {
            // Translate source out to the right
            d2dContext->SetTransform(D2D1::Matrix3x2F::Translation(progress * width, 0.0f) * originalTransform);
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);

            // Translate target in from the left
            d2dContext->SetTransform(D2D1::Matrix3x2F::Translation(-(1.0f - progress) * width, 0.0f) * originalTransform);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, 1.0f, D2D1_INTERPOLATION_MODE_LINEAR);
            break;
        }

        case TransitionType::ZoomIn: {
            // Fade out source static
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f - progress, D2D1_INTERPOLATION_MODE_LINEAR);

            // Scale target from center
            d2dContext->SetTransform(D2D1::Matrix3x2F::Scale(progress, progress, centerPoint) * originalTransform);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, progress, D2D1_INTERPOLATION_MODE_LINEAR);
            break;
        }

        case TransitionType::ZoomOut: {
            // Scale source down towards center
            d2dContext->SetTransform(D2D1::Matrix3x2F::Scale(1.0f - progress, 1.0f - progress, centerPoint) * originalTransform);
            d2dContext->DrawBitmap(sourceBitmap, &fullRect, 1.0f - progress, D2D1_INTERPOLATION_MODE_LINEAR);

            // Restore transform and fade in target
            d2dContext->SetTransform(originalTransform);
            d2dContext->DrawBitmap(targetBitmap, &fullRect, progress, D2D1_INTERPOLATION_MODE_LINEAR);
            break;
        }
    }

    // Restore original transform state before returning
    d2dContext->SetTransform(originalTransform);

    return S_OK;
}
