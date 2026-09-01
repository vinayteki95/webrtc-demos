(() => {
    const $ = (id) => document.getElementById(id);

    const els = {
        status: $("hud-status"),
        clientId: $("client-id"),
        btnCopyId: $("btn-copy-id"),
        viewHome: $("view-home"),
        viewCall: $("view-call"),
        btnStartCall: $("btn-start-call"),
        peerId: $("peer-id"),
        videoLocal: $("video-local"),
        videoRemote: $("video-remote"),
        btnHangup: $("btn-hangup"),
        stateConnection: $("state-connection"),
        stateGathering: $("state-gathering"),
        stateSignaling: $("state-signaling"),
        cardConnection: $("card-connection"),
        cardGathering: $("card-gathering"),
        cardSignaling: $("card-signaling"),
    };

    // -------------------------------------------------------------------------
    // UI — no WebRTC
    // -------------------------------------------------------------------------

    const ui = {
        setStatus(text) {
            els.status.textContent = text;
        },

        setClientId(id) {
            els.clientId.textContent = id;
        },

        getPeerId() {
            return els.peerId.value.trim();
        },

        setLocalStream(stream) {
            els.videoLocal.srcObject = stream;
        },

        setRemoteStream(stream) {
            els.videoRemote.srcObject = stream;
        },

        renderPeerStates(pc) {
            setState("connection", pc.connectionState);
            setState("gathering", pc.iceGatheringState);
            setState("signaling", pc.signalingState);
        },

        bindPeer(pc) {
            const paint = () => {
                ui.renderPeerStates(pc);
                if (pc.connectionState === "connected") {
                    ui.enterCallView();
                }
            };
            pc.addEventListener("connectionstatechange", paint);
            pc.addEventListener("icegatheringstatechange", paint);
            pc.addEventListener("signalingstatechange", paint);
            paint();
        },

        enterCallView() {
            els.viewHome.hidden = true;
            els.viewCall.hidden = false;
            ui.setStatus("CONNECTED");
        },

        reset() {
            els.viewCall.hidden = true;
            els.viewHome.hidden = false;
            els.btnStartCall.hidden = false;
            els.videoLocal.srcObject = null;
            els.videoRemote.srcObject = null;
            setState("connection", "—");
            setState("gathering", "—");
            setState("signaling", "—");
            ui.setStatus("STANDBY");
        },
    };

    function setState(kind, value) {
        const label = {
            connection: els.stateConnection,
            gathering: els.stateGathering,
            signaling: els.stateSignaling,
        }[kind];
        const card = {
            connection: els.cardConnection,
            gathering: els.cardGathering,
            signaling: els.cardSignaling,
        }[kind];
        label.textContent = value;
        card.dataset.state = value;
    }

    els.btnCopyId.addEventListener("click", async () => {
        await navigator.clipboard.writeText(els.clientId.textContent);
        const prev = els.btnCopyId.textContent;
        els.btnCopyId.textContent = "Copied";
        setTimeout(() => {
            els.btnCopyId.textContent = prev;
        }, 1200);
    });

    els.btnStartCall.addEventListener("click", () => onStartCall());
    els.btnHangup.addEventListener("click", async () => {
        await onHangUp();
        ui.reset();
    });

    // -------------------------------------------------------------------------
    // Signaling + peer connection
    // -------------------------------------------------------------------------

    let pc = new RTCPeerConnection();
    ui.bindPeer(pc);

    let localStream = null;
    let remotePeerId = null;
    const pendingCandidates = [];

    const clientId = crypto.randomUUID();
    ui.setClientId(clientId);

    let recipientRetries = 0;
    const wss = new WebSocket("ws://localhost:8080");

    wss.addEventListener("open", () => {
        send({ type: "register", id: clientId });
        ui.setStatus("REGISTERED");
    });

    wss.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "offer") {
            onAcceptCall(msg);
        } else if (msg.type === "answer") {
            onRemoteAnswer(msg);
        } else if (msg.type === "icecandidate") {
            addRemoteCandidate(msg.data);
        } else if (msg.type === "wsserror") {
            recipientRetries += 1;
            if (recipientRetries < 3) {
                setTimeout(() => sendOffer(), 1000 * recipientRetries);
            }
        }
    });

    function send(payload) {
        wss.send(JSON.stringify(payload));
    }

    function sendToPeer(type, data, to) {
        send({ type, data, from: clientId, to });
    }

    function sendOffer() {
        const to = remotePeerId || ui.getPeerId();
        sendToPeer(pc.localDescription.type, pc.localDescription.sdp, to);
    }

    function sendAnswer(to) {
        sendToPeer(pc.localDescription.type, pc.localDescription.sdp, to);
    }

    function wireLocalIce(toPeerId) {
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendToPeer("icecandidate", event.candidate, toPeerId);
            }
        };
        pc.ontrack = (event) => {
            ui.setRemoteStream(event.streams[0]);
        };
    }

    async function addRemoteCandidate(data) {
        const candidate = new RTCIceCandidate(data);
        if (!pc.remoteDescription) {
            pendingCandidates.push(candidate);
            return;
        }
        await pc.addIceCandidate(candidate);
    }

    async function flushPendingCandidates() {
        while (pendingCandidates.length) {
            await pc.addIceCandidate(pendingCandidates.shift());
        }
    }

    async function captureAndAddTracks() {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        ui.setLocalStream(localStream);
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    async function onStartCall() {
        remotePeerId = ui.getPeerId();
        if (!remotePeerId) {
            ui.setStatus("NEED CALLEE ID");
            return;
        }

        recipientRetries = 0;
        wireLocalIce(remotePeerId);
        await captureAndAddTracks();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendOffer();
    }

    async function onRemoteAnswer(answer) {
        await pc.setRemoteDescription({ type: answer.type, sdp: answer.data });
        await flushPendingCandidates();
    }

    async function onAcceptCall(offer) {
        remotePeerId = offer.from;
        wireLocalIce(offer.from);
        await pc.setRemoteDescription({ type: offer.type, sdp: offer.data });
        await flushPendingCandidates();
        await captureAndAddTracks();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendAnswer(offer.from);
    }

    async function onHangUp() {
        pc.getSenders().forEach((sender) => pc.removeTrack(sender));
        localStream?.getTracks().forEach((track) => track.stop());
        pc.close();

        pendingCandidates.length = 0;
        remotePeerId = null;
        localStream = null;

        pc = new RTCPeerConnection();
        ui.bindPeer(pc);
    }
})();
