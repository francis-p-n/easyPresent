{
  "targets": [
    {
      "target_name": "propresenter_render",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "src/addon.cc",
        "src/render_engine.cc",
        "src/text_renderer.cc",
        "src/transition_engine.cc",
        "src/video_decoder.cc",
        "src/audio_engine.cc"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [ 
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "_UNICODE",
        "UNICODE"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [ "/std:c++20" ],
          "ExceptionHandling": 1
        }
      },
      "conditions": [
        ["OS=='win'", {
          "libraries": [
            "-ld3d11.lib",
            "-ldxgi.lib",
            "-ld2d1.lib",
            "-ldwrite.lib",
            "-lmfplat.lib",
            "-lmfuuid.lib",
            "-lmfreadwrite.lib",
            "-lole32.lib"
          ]
        }]
      ]
    }
  ]
}
