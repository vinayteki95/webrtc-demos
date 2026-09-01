(() => {
    // -------------------------------------------------------------------------
    // This file is split on purpose:
    //   1. UI helpers  — already wired (tabs, copy, views, sidebar).
    //   2. YOUR lab    — fill in the four stub functions at the bottom.
    //
    // Do not put a second RTCPeerConnection on this page. Open this file in
    // two browser tabs: one Creates, one Accepts.
    // -------------------------------------------------------------------------

    const $ = (id) => document.getElementById(id);

    const els = {
        status: $("hud-status"),
        clientId: $("client-id"),
        viewHome: $("view-home"),
        viewCall: $("view-call"),
        tabCreate: $("tab-create"),
        tabAccept: $("tab-accept"),
        panelCreate: $("panel-create"),
        panelAccept: $("panel-accept"),
        btnStartCall: $("btn-start-call"),
        peerId: $("peer-id"),
        btnSubmitAnswer: $("btn-submit-answer"),
        acceptForm: $("accept-form"),
        acceptRemoteSdp: $("accept-remote-sdp"),
        btnAcceptCall: $("btn-accept-call"),
        acceptStage: $("accept-sdp-stage"),
        acceptSdpCode: $("accept-sdp-code"),
        acceptSdpType: $("accept-sdp-type"),
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

    // =========================================================================
    // UI helpers — call these from your stubs. No WebRTC inside.
    // =========================================================================

    const ui = {
        setStatus(text) {
            els.status.textContent = text;
        },

        setTab(name) {
            const create = name === "create";
            els.tabCreate.classList.toggle("is-active", create);
            els.tabAccept.classList.toggle("is-active", !create);
            els.tabCreate.setAttribute("aria-selected", String(create));
            els.tabAccept.setAttribute("aria-selected", String(!create));
            els.panelCreate.hidden = !create;
            els.panelAccept.hidden = create;
            els.panelCreate.classList.toggle("is-active", create);
            els.panelAccept.classList.toggle("is-active", !create);
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

        /**
         * Wire the three sidebar readouts. Call this once after you construct `pc`.
         * When connectionState becomes "connected", the home tabs are replaced
         * by the two-video layout.
         */
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

        /**
         * Back to the Create/Accept home. Does NOT stop tracks or close the PC —
         * do that in onHangUp() before calling ui.reset().
         */
        reset() {
            els.viewCall.hidden = true;
            els.viewHome.hidden = false;
            els.btnStartCall.hidden = false;
            els.createStage.hidden = true;
            els.acceptForm.hidden = false;
            els.acceptStage.hidden = true;
            els.videoLocal.srcObject = null;
            els.videoRemote.srcObject = null;
            setState("connection", "—");
            setState("gathering", "—");
            setState("signaling", "—");
            ui.setTab("create");
            ui.setStatus("STANDBY");
            ui.setClientId("client-id");
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

    // ----- chrome event wiring (UI only) -----

    els.tabCreate.addEventListener("click", () => ui.setTab("create"));
    els.tabAccept.addEventListener("click", () => ui.setTab("accept"));

    els.btnStartCall.addEventListener("click", () => onStartCall());
    // els.btnSubmitAnswer.addEventListener("click", () => onSubmitRemoteAnswer());
    els.btnAcceptCall.addEventListener("click", () => onAcceptCall());
    els.btnHangup.addEventListener("click", async () => {
        await onHangUp();
        ui.reset();
    });

    // =========================================================================
    // YOUR LAB — fill these in. UI helpers are on `ui`.
    // Keep a single RTCPeerConnection for this tab.
    // =========================================================================

    let pc = new RTCPeerConnection();
    ui.bindPeer(pc);
    let localStream;
    let clientId = crypto.randomUUID();
    ui.setClientId(clientId);

    let recieverAvailabilityErrors = 0;

    let wssClient = new WebSocket('ws://localhost:8080');

    wssClient.onopen = () => {
        console.log('WebSocket connection opened');
        wssClient.send(JSON.stringify({ type: 'register', id: clientId }));
    };

    wssClient.onclose = () => {
        console.log('WebSocket connection closed');
    };

    wssClient.onerror = (event) => {
        console.log('WebSocket error:', event);
    };

    wssClient.onmessage = (event) => {
        console.log('Received message:', event);
        const parsedMessage = JSON.parse(event.data);
        if (parsedMessage.type === 'offer') {
            console.log('Received offer:', parsedMessage);
            onAcceptCall(parsedMessage);
        } else if (parsedMessage.type === 'answer') {
            console.log('Received answer:', parsedMessage);
            onSubmitRemoteAnswer(parsedMessage);
        } else if (parsedMessage.type === 'icecandidate') {
            console.log('Received icecandidate:', parsedMessage);
            const { data, from, to } = parsedMessage;
            pc.addIceCandidate(new RTCIceCandidate(data));
        } else if (parsedMessage.type === 'wsserror') {
            console.log('Received wsserror:', parsedMessage);
            recieverAvailabilityErrors++;
            if (recieverAvailabilityErrors < 3) {
                setTimeout(() => {
                    sendOffer();
                }, 1000 * recieverAvailabilityErrors);
            }
        }
    };

    /**
     * Create Call → Start Call
     *
     * 1. Construct `pc = new RTCPeerConnection()` (once).
     * 2. Call `ui.bindPeer(pc)` so the sidebar tracks the three states.
     * 3. getUserMedia({ video: true, audio: true }) → store on `localStream`.
     * 4. `ui.setLocalStream(localStream)` (local preview; element is already muted).
     * 5. addTrack() every track onto `pc`.
     * 6. createOffer() → setLocalDescription(offer).
     * 7. Wait until ICE gathering is done (onicecandidate with null candidate,
     *    or iceGatheringState === "complete"), then:
     *      ui.showLocalOffer(pc.localDescription)
     * 8. pc.ontrack → ui.setRemoteStream(event.streams[0])
     */
    async function onStartCall() {
        const peerId = ui.getPeerId();
        console.log('Starting call with peer:', peerId);

        // TODO: when gathering completes, ui.showLocalOffer(pc.localDescription)
        pc.onicecandidate = (event) => {
            if (event.candidate != null) {
                const peerId = ui.getPeerId();
                wssClient.send(JSON.stringify({ type: 'icecandidate', data: event.candidate, from: clientId, to: peerId }));
            }
        };
        pc.ontrack = (event) => {
            ui.setRemoteStream(event.streams[0]);
        };

        // TODO: getUserMedia → addTrack → createOffer → setLocalDescription
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        ui.setLocalStream(localStream);
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendOffer();
    }

    async function sendOffer() {
        const peerId = ui.getPeerId();
        await wssClient.send(JSON.stringify({ type: pc.localDescription.type, data: pc.localDescription.sdp, from: clientId, to: peerId }));
    }

    /**
     * Create Call → Submit Remote SDP
     *
     * 1. Read the pasted answer: ui.getCreateRemoteSdpText()
     * 2. JSON.parse it into { type, sdp }
     * 3. await pc.setRemoteDescription(...)
     *
     * ui.bindPeer already switches to the two-video view when
     * connectionState becomes "connected".
     */
    async function onSubmitRemoteAnswer(answer) {
        // TODO: setRemoteDescription(answer from the textarea)
        const { type, data } = answer;
        await pc.setRemoteDescription({ type, sdp: data });
    }

    /**
     * Accept Call → Accept Call button
     *
     * 1. Construct `pc` + ui.bindPeer(pc) if you have not already.
     * 2. JSON.parse(ui.getAcceptRemoteSdpText()) → setRemoteDescription(offer).
     * 3. getUserMedia → ui.setLocalStream → addTrack (bidirectional media).
     * 4. createAnswer() → setLocalDescription(answer).
     * 5. When gathering completes: ui.showLocalAnswer(pc.localDescription)
     * 6. pc.ontrack → ui.setRemoteStream(event.streams[0])
     */
    async function onAcceptCall(offer) {


        // TODO: setRemoteDescription(offer) → getUserMedia → addTrack
        console.log('Accepting call with offer:', offer);
        const { type, data, from } = offer;

        // TODO: when gathering completes, ui.showLocalAnswer(pc.localDescription)
        pc.onicecandidate = (event) => {
            if (event.candidate != null) {
                const peerId = from;
                wssClient.send(JSON.stringify({ type: 'icecandidate', data: event.candidate, from: clientId, to: peerId }));
            } else {
                console.log('No candidates left to send');
            }
        };
        pc.ontrack = (event) => {
            ui.setRemoteStream(event.streams[0]);
        };

        await pc.setRemoteDescription({ type, sdp: data });

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        ui.setLocalStream(localStream);
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendAnswer(from);
    }

    async function sendAnswer(peerId) {
        await wssClient.send(JSON.stringify({ type: pc.localDescription.type, data: pc.localDescription.sdp, from: clientId, to: peerId }));
    }

    /**
     * In-call → Cancel Call
     *
     * 1. Stop every local MediaStreamTrack (localStream.getTracks() → track.stop()).
     * 2. Stop sender tracks / removeTrack if you added them to `pc`.
     * 3. pc.close(); pc = null; localStream = null;
     *
     * ui.reset() runs after this returns (clears videos + returns to home).
     */
    async function onHangUp() {
        // TODO: stop tracks, close the peer connection
        pc.getSenders().forEach(sender => {
            pc.removeTrack(sender);
        });
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        pc.close();

        pc = new RTCPeerConnection();
        ui.bindPeer(pc);
        localStream = null;
    }
})();
