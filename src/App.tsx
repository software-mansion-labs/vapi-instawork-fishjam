import type { FC } from "react";
import { useCall } from "./hooks/useCall";
import Controls from "./components/Controls";
import StatusBar from "./components/StatusBar";
import AudioMeters from "./components/AudioMeters";

const App: FC = () => {
  const call = useCall();

  return (
    <div id="app">
      <audio
        ref={call.audioRef}
        autoPlay
        playsInline
        style={{ display: "none" }}
      />
      <h1>Trivia Agent</h1>
      <Controls
        callActive={call.callActive}
        isConnected={call.isConnected}
        isMicOn={call.isMicrophoneOn}
        onStart={call.handleStart}
        onStop={call.handleStop}
        onMute={call.handleMute}
      />
      <StatusBar text={call.status.text} level={call.status.level} />
      <AudioMeters micLevel={call.micLevel} agentLevel={call.agentLevel} />
    </div>
  );
};

export default App;
