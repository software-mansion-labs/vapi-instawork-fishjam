# Vapi + Fishjam

## Setup

1. Install dependencies:

```sh
npm install
```

2. Copy `.env.example` to `.env` and fill in the values:

```sh
cp .env.example .env
```

| Variable                   | Description                    |
| -------------------------- | ------------------------------ |
| `VITE_FISHJAM_ID`          | Fishjam Cloud app ID           |
| `FISHJAM_MANAGEMENT_TOKEN` | Fishjam Cloud management token |
| `VAPI_PRIVATE_API_KEY`     | Vapi API key                   |
| `VAPI_ASSISTANT_ID`        | Vapi assistant ID              |

3. Start the server:

```sh
npm run dev:server
```

4. In a separate terminal, start the client:

```sh
npm run dev:client
```

Open the URL printed in the terminal (default `http://localhost:5173`).
