# WebSocket signalling

Two-tab 1:1 video call. A Node relay carries offer, answer, and trickle ICE — no paste.

## Run

```bash
cd websocket-signalling
npm install
```

**Terminal 1** — signaling relay (`ws://localhost:8080`):

```bash
node signaling-server.mjs
```

**Terminal 2** — static page:

```bash
npx --yes serve .
```

Open the printed URL in **two tabs**. Allow camera and microphone on both.

1. Copy **YOUR ID** from the callee tab header.
2. On the caller tab, paste that ID into the peer field and click **Start Call**.

The relay only forwards JSON. It does not parse SDP or ICE.
