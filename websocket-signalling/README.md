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

1. On the callee tab, **Copy** **YOUR ID**.
2. On the caller tab, paste it into **Callee client-id** and click **Start Call**.

Incoming offers are answered automatically. The relay only forwards JSON — it does not parse SDP or ICE.
