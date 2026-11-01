
export class WebRTCService {
  private peer: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  constructor() {
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302"
        }
      ]
    });
  }

  createDataChannel() {
    this.channel = this.peer.createDataChannel("clipboard");

    return this.channel;
  }

  onIncomingChannel(
    callback: (channel: RTCDataChannel) => void
  ) {
    this.peer.ondatachannel = (event) => {
      this.channel = event.channel;
      callback(event.channel);
    };
  }

  async createOffer() {
    const offer = await this.peer.createOffer();

    await this.peer.setLocalDescription(offer);

    await this.waitForIceGathering();

    return this.peer.localDescription;
  }

  async acceptOffer(offer: RTCSessionDescriptionInit) {
    await this.peer.setRemoteDescription(offer);

    const answer = await this.peer.createAnswer();

    await this.peer.setLocalDescription(answer);

    await this.waitForIceGathering();

    return this.peer.localDescription;
  }

  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.peer.setRemoteDescription(answer);
  }

  sendMessage(message: string) {
    if (this.channel?.readyState !== "open") {
      throw new Error("Data channel is not connected");
    }

    this.channel.send(message);
  }

  onMessage(callback: (message: string) => void) {
    if (!this.channel) {
      throw new Error("Data channel not initialized");
    }

    this.channel.onmessage = (event) => {
      callback(String(event.data));
    };
  }

  onConnectionState(
    callback: (state: RTCPeerConnectionState) => void
  ) {
    this.peer.onconnectionstatechange = () => {
      callback(this.peer.connectionState);
    };
  }

  private waitForIceGathering(): Promise<void> {
    if (this.peer.iceGatheringState === "complete") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("ICE gathering timed out"));
      }, 30000);

      const checkState = () => {
        if (this.peer.iceGatheringState === "complete") {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        this.peer.removeEventListener(
          "icegatheringstatechange",
          checkState
        );
      };

      this.peer.addEventListener(
        "icegatheringstatechange",
        checkState
      );
    });
  }

  disconnect() {
    this.channel?.close();
    this.peer.close();
  }
}
