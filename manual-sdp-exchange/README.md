# Manual SDP exchange

Two-tab 1:1 video call. Signaling is copy-paste — no server.

## Run

```bash
cd manual-sdp-exchange
npx --yes serve .
```

Open the printed URL in **two tabs**. Allow camera and microphone on both.

1. **Tab A** — Create Call → **Start Call** → **Copy** the offer JSON.
2. **Tab B** — Accept Call → paste the offer → **Accept Call** → **Copy** the answer JSON.
3. **Tab A** — paste the answer → **Submit Remote SDP**.

Both tabs should reach `connectionState: connected` with local + remote video. Hang up on both tabs to start another call without reloading.
