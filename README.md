# Peer Clipboard

A backend-free peer-to-peer clipboard sharing application built using React, TypeScript and WebRTC.

## Features

- Peer-to-peer communication using WebRTC.
- Manual device pairing using offer and answer codes.
- Bidirectional text sharing.
- Clipboard synchronization between connected devices.
- No backend server or database required.

## Tech Stack

- React
- TypeScript
- Vite
- WebRTC
- RTCDataChannel
- CSS

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd peer-clipboard
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## How It Works

1. Device A generates an offer code.
2. Device B enters the offer code and generates an answer code.
3. Device A enters the answer code.
4. WebRTC establishes a peer-to-peer connection.
5. Both devices can exchange text.

## Architecture

The application uses WebRTC and RTCDataChannel for direct peer-to-peer communication.

A public STUN server is configured for connection discovery. No TURN server is currently configured, so connections may not work on certain restrictive networks.

## License

MIT