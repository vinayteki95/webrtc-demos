(() => {
    // -------------------------------------------------------------------------
    // Vanilla ICE, two-tab paste signaling.
    //   1. UI helpers — tabs, copy, views, sidebar (no WebRTC).
    //   2. SDP exchange — snapshot localDescription AFTER gathering completes.
    //      createOffer()/createAnswer() is too early: no a=candidate lines yet.
    //
    // One RTCPeerConnection per page. Open two tabs: one Creates, one Accepts.
    // -------------------------------------------------------------------------

    const $ = (id) => document.getElementById(id);

    const els = {
        status: $("hud-status"),
        viewHome: $("view-home"),
        viewCall: $("view-call"),
        tabCreate: $("tab-create"),
        tabAccept: $("tab-accept"),
        panelCreate: $("panel-create"),
        panelAccept: $("panel-accept"),
        btnStartCall: $("btn-start-call"),
        createStage: $("create-sdp-stage"),
        createSdpCode: $("create-sdp-code"),
        createSdpType: $("create-sdp-type"),
        createRemoteSdp: $("create-remote-sdp"),
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

        /**
         * Show the local offer code block + remote-answer textarea (Create tab).
         * `desc` should be an RTCSessionDescription-like { type, sdp }.
         */
        showLocalOffer(desc) {
            renderSdp(els.createSdpCode, els.createSdpType, desc);
            els.createStage.hidden = false;
            els.btnStartCall.hidden = true;
            ui.setStatus("OFFER READY");
        },

        /**
         * Show the local answer code block (Accept tab).
         */
        showLocalAnswer(desc) {
            renderSdp(els.acceptSdpCode, els.acceptSdpType, desc);
            els.acceptForm.hidden = true;
            els.acceptStage.hidden = false;
            ui.setStatus("ANSWER READY");
        },

        getCreateRemoteSdpText() {
            return els.createRemoteSdp.value.trim();
        },

        getAcceptRemoteSdpText() {
            return els.acceptRemoteSdp.value.trim();
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
            els.createRemoteSdp.value = "";
            els.acceptRemoteSdp.value = "";
            els.createSdpCode.textContent = "";
            els.acceptSdpCode.textContent = "";
            els.createSdpType.textContent = "—";
            els.acceptSdpType.textContent = "—";
            els.videoLocal.srcObject = null;
            els.videoRemote.srcObject = null;
            setState("connection", "—");
            setState("gathering", "—");
            setState("signaling", "—");
            ui.setTab("create");
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

    function renderSdp(codeEl, typeEl, desc) {
        const { type, sdp } = normalizeDesc(desc);
        typeEl.textContent = type || "—";
        codeEl.textContent = sdp || "";
        codeEl.dataset.clipboard = JSON.stringify({ type, sdp });
    }

    function normalizeDesc(desc) {
        if (desc == null) return { type: "", sdp: "" };
        if (typeof desc === "string") {
            try {
                return normalizeDesc(JSON.parse(desc));
            } catch {
                return { type: "", sdp: desc };
            }
        }
        return { type: desc.type || "", sdp: desc.sdp || "" };
    }

    async function copyFrom(codeEl) {
        const payload = codeEl.dataset.clipboard || codeEl.textContent;
        await navigator.clipboard.writeText(payload);
    }

    // ----- chrome event wiring (UI only) -----

    els.tabCreate.addEventListener("click", () => ui.setTab("create"));
    els.tabAccept.addEventListener("click", () => ui.setTab("accept"));

    document.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const codeEl = $(btn.dataset.copy);
            await copyFrom(codeEl);
            const prev = btn.textContent;
            btn.textContent = "Copied";
            btn.classList.add("is-copied");
            setTimeout(() => {
                btn.textContent = prev;
                btn.classList.remove("is-copied");
            }, 1200);
        });
    });

    els.btnStartCall.addEventListener("click", () => onStartCall());
    els.btnSubmitAnswer.addEventListener("click", () => onSubmitRemoteAnswer());
    els.btnAcceptCall.addEventListener("click", () => onAcceptCall());
    els.btnHangup.addEventListener("click", async () => {
        await onHangUp();
        ui.reset();
    });

    // =========================================================================
    // SDP exchange — vanilla ICE (candidates embedded in the SDP blob).
    // Copy-paste JSON { type, sdp } between two tabs. ui helpers above.
    // =========================================================================

    let pc;
    let localStream = null;

    function createPeer() {
        pc = new RTCPeerConnection();
        ui.bindPeer(pc);
        pc.ontrack = (event) => {
            ui.setRemoteStream(event.streams[0]);
        };
    }

    /**
     * Gathering starts after setLocalDescription. The object returned by
     * createOffer()/createAnswer() does not yet contain a=candidate lines.
     * Resolve only once iceGatheringState is complete (null icecandidate is
     * the same signal). Then pc.localDescription is the blob to paste.
     */
    function waitForIceGathering(peer) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                peer.removeEventListener("icegatheringstatechange", onGathering);
                peer.removeEventListener("icecandidate", onCandidate);
                resolve();
            };
            const onGathering = () => {
                if (peer.iceGatheringState === "complete") finish();
            };
            const onCandidate = (event) => {
                if (event.candidate === null) finish();
            };
            if (peer.iceGatheringState === "complete") {
                finish();
                return;
            }
            peer.addEventListener("icegatheringstatechange", onGathering);
            peer.addEventListener("icecandidate", onCandidate);
            onGathering();
        });
    }

    async function captureAndAddTracks() {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        ui.setLocalStream(localStream);
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    createPeer();

    /**
     * Create Call → Start Call
     *
     * getUserMedia → addTrack → createOffer → setLocalDescription
     * → wait for gathering → show pc.localDescription (the pasteable offer).
     */
    async function onStartCall() {
        await captureAndAddTracks();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);
        ui.showLocalOffer(pc.localDescription);
    }

    /**
     * Create Call → Submit Remote SDP
     *
     * Paste the callee's answer. ui.bindPeer switches to the two-video
     * view when connectionState becomes "connected".
     */
    async function onSubmitRemoteAnswer() {
        const { type, sdp } = JSON.parse(ui.getCreateRemoteSdpText());
        await pc.setRemoteDescription({ type, sdp });
    }

    /**
     * Accept Call → Accept Call
     *
     * setRemoteDescription(offer) → getUserMedia → addTrack
     * → createAnswer → setLocalDescription → wait for gathering
     * → show pc.localDescription (the pasteable answer).
     */
    async function onAcceptCall() {
        const { type, sdp } = JSON.parse(ui.getAcceptRemoteSdpText());
        await pc.setRemoteDescription({ type, sdp });

        await captureAndAddTracks();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGathering(pc);
        ui.showLocalAnswer(pc.localDescription);
    }

    /**
     * In-call → Cancel Call
     *
     * close() is terminal. Chrome calls ui.reset() after this returns.
     */
    async function onHangUp() {
        pc.getSenders().forEach((sender) => pc.removeTrack(sender));
        localStream?.getTracks().forEach((track) => track.stop());
        pc.close();
        localStream = null;
        createPeer();
    }
})();
