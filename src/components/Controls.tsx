import type { FC } from "react";

type ControlsProps = {
  callActive: boolean;
  isConnected: boolean;
  isMicOn: boolean;
  onStart: () => void;
  onStop: () => void;
  onMute: () => void;
};

const Controls: FC<ControlsProps> = ({
  callActive,
  isConnected,
  isMicOn,
  onStart,
  onStop,
  onMute,
}) => (
  <div className="controls">
    <button className="btn-start" disabled={callActive} onClick={onStart}>
      Start
    </button>
    <button className="btn-stop" disabled={!callActive} onClick={onStop}>
      Stop
    </button>
    <button className="btn-mute" disabled={!isConnected} onClick={onMute}>
      {isMicOn ? "Mute" : "Unmute"}
    </button>
  </div>
);

export default Controls;
