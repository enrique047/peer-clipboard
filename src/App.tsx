
import { useEffect, useRef, useState } from "react";
import { WebRTCService } from "./services/webrtc";
import "./App.css";

function encodeCode(data: RTCSessionDescriptionInit) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));

  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return "P2P1." + btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function decodeCode(code: string): RTCSessionDescriptionInit {
  if (!code.startsWith("P2P1.")) {
    throw new Error("Invalid connection code");
  }

  let base64 = code.slice(5)
    .replace(/-/g, "+")
    .replace(/\//g, "/");

  base64 += "=".repeat((4 - base64.length % 4) % 4);

  const binary = atob(base64);

  const bytes = Uint8Array.from(
    binary,
    character => character.charCodeAt(0)
  );

  return JSON.parse(
    new TextDecoder().decode(bytes)
  ) as RTCSessionDescriptionInit;
}

function App() {
  const service = useRef<WebRTCService | null>(null);

  const [offerCode, setOfferCode] = useState("");
  const [answerCode, setAnswerCode] = useState("");
  const [offerInput, setOfferInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");

  const [status, setStatus] = useState("Disconnected");
  const [message, setMessage] = useState("");
  const [received, setReceived] = useState("");
  const [error, setError] = useState("");

  // Clipboard synchronization
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncError, setSyncError] = useState("");

  const pollingRef = useRef<number | null>(null);
  const lastClipboardRef = useRef("");

  function stopClipboardSync() {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setSyncEnabled(false);
  }

  async function startClipboardSync() {
    try {
      setSyncError("");

      if (!navigator.clipboard?.readText) {
        throw new Error("Clipboard reading is not supported.");
      }

      if (status !== "connected") {
        throw new Error("Connect your devices first.");
      }

      // Read existing clipboard without sending it.
      const initialText = await navigator.clipboard.readText();

      lastClipboardRef.current = initialText;

      setSyncEnabled(true);

      let checking = false;

      pollingRef.current = window.setInterval(async () => {
        if (
          document.visibilityState !== "visible" ||
          checking
        ) {
          return;
        }

        checking = true;

        try {
          const currentText = await navigator.clipboard.readText();

          if (currentText === lastClipboardRef.current) {
            return;
          }

          lastClipboardRef.current = currentText;

          if (currentText.length > 100000) {
            setSyncError("Clipboard text exceeds the 100 KB limit.");
            return;
          }

          service.current?.sendMessage(currentText);

        } catch {
          setSyncError(
            "Clipboard access failed. Check browser permissions."
          );

          stopClipboardSync();

        } finally {
          checking = false;
        }
      }, 1000);

    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Unable to start sync."
      );
    }
  }

  useEffect(() => {
    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
      }

      service.current?.disconnect();
    };
  }, []);

  function initializeService() {
    stopClipboardSync();

    service.current?.disconnect();

    const connection = new WebRTCService();

    service.current = connection;

    connection.onConnectionState(state => {
      setStatus(state);

      if (state !== "connected") {
        stopClipboardSync();
      }
    });

    return connection;
  }

  async function createRoom() {
    try {
      setError("");

      const connection = initializeService();

      connection.createDataChannel();

      const offer = await connection.createOffer();

      if (!offer) {
        throw new Error("Offer generation failed");
      }

      setOfferCode(encodeCode(offer.toJSON()));

      setStatus("Waiting for second device");

      connection.onMessage((text) => {
        setReceived(text);
      });

    } catch (err) {
      setError(String(err));
    }
  }

  async function joinRoom() {
    try {
      setError("");

      const connection = initializeService();

      const offer = decodeCode(offerInput);

      connection.onIncomingChannel(channel => {
        channel.onmessage = event => {
          setReceived(String(event.data));
        };
      });

      const answer = await connection.acceptOffer(offer);

      if (!answer) {
        throw new Error("Answer generation failed");
      }

      setAnswerCode(encodeCode(answer.toJSON()));

      setStatus("Answer generated");

    } catch (err) {
      setError(String(err));
    }
  }

  async function completeConnection() {
    try {
      if (!service.current) {
        throw new Error("Create a room first");
      }

      const answer = decodeCode(answerInput);

      await service.current.acceptAnswer(answer);

      setStatus("Connecting...");

    } catch (err) {
      setError(String(err));
    }
  }

  function sendMessage() {
    try {
      service.current?.sendMessage(message);
      setMessage("");
    } catch (err) {
      setError(String(err));
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      setError("Could not copy code. Check clipboard permissions.");
    }
  }

  async function copyReceived() {
    try {
      await navigator.clipboard.writeText(received);

      // Prevent this copied content from being sent back.
      lastClipboardRef.current = received;

      setSyncError("");

    } catch {
      setSyncError("Unable to copy received text.");
    }
  }

  return (
    <main className="app">
      <h1>Peer Clipboard.</h1>
      <h1></h1>
      <p>
        Your clipboard, everywhere. Share text instantly
        between devices with private peer-to-peer connections.
      </p>

      <section>
        <h2>Create a session</h2>

        <button onClick={createRoom}>
          Create room
        </button>

        {offerCode && (
          <>
            <textarea readOnly value={offerCode} />

            <button onClick={() => copyCode(offerCode)}>
              Copy offer code
            </button>
          </>
        )}
      </section>

      <section>
        <h2>Join a session</h2>

        <textarea
          placeholder="Paste offer code here"
          value={offerInput}
          onChange={e => setOfferInput(e.target.value)}
        />

        <button onClick={joinRoom}>
          Generate answer
        </button>

        {answerCode && (
          <>
            <textarea readOnly value={answerCode} />

            <button onClick={() => copyCode(answerCode)}>
              Copy answer code
            </button>
          </>
        )}
      </section>

      <section>
        <h2>Complete connection</h2>

        <textarea
          placeholder="Paste answer code here"
          value={answerInput}
          onChange={e => setAnswerInput(e.target.value)}
        />

        <button onClick={completeConnection}>
          Connect
        </button>
      </section>

      <section>
        <h2>Clipboard</h2>

        <p>Connection status: {status}</p>

        <textarea
          placeholder="Enter text to send manually"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />

        <button
          onClick={sendMessage}
          disabled={status !== "connected"}
        >
          Send
        </button>

        <hr />

        <h3>Automatic Clipboard Sync</h3>

        <p>
          Sync status: {syncEnabled ? "Active 🟢" : "Inactive ⚪"}
        </p>

        {!syncEnabled ? (
          <button
            onClick={startClipboardSync}
            disabled={status !== "connected"}
          >
            Enable Clipboard Sync
          </button>
        ) : (
          <button onClick={stopClipboardSync}>
            Stop Clipboard Sync
          </button>
        )}

        {syncError && (
          <p className="error">{syncError}</p>
        )}

        <h3>Received text</h3>

        <textarea
          readOnly
          value={received}
          placeholder="Received clipboard content appears here"
        />

        <button
          onClick={copyReceived}
          disabled={!received}
        >
          Copy Received Text
        </button>
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}

export default App;
