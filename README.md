# webrtc-demos

Two browser demos of a **1:1 WebRTC video call**. Same media path (camera + mic over `RTCPeerConnection`); different signaling.

## Demos

| # | Demo | What it does |
|---|------|----------------|
| 1 | [manual-sdp-exchange](./manual-sdp-exchange/) | Two tabs exchange the offer and answer by **copy-pasting SDP JSON**. ICE candidates are embedded in that blob after gathering finishes — no server. |
| 2 | [websocket-signalling](./websocket-signalling/) | A tiny Node WebSocket relay forwards offer, answer, and **trickle ICE** between tabs. The call connects without pasting SDP. |

Each folder has its own run steps.

## Requirements

- Chromium-based browser (Chrome, Edge, Arc)
- Camera and microphone permission
- [Node.js](https://nodejs.org/) 18+ (WebSocket demo only)
