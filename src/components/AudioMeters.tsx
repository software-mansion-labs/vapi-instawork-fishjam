import type { FC } from "react";

type AudioMetersProps = {
  micLevel: number;
  agentLevel: number;
};

const AudioMeters: FC<AudioMetersProps> = ({ micLevel, agentLevel }) => (
  <div className="meters">
    <div className="meter">
      <span className="meter-label">You</span>
      <div className="meter-track">
        <div className="meter-fill mic" style={{ width: `${micLevel}%` }} />
      </div>
    </div>
    <div className="meter">
      <span className="meter-label">Agent</span>
      <div className="meter-track">
        <div
          className="meter-fill agent"
          style={{ width: `${agentLevel}%` }}
        />
      </div>
    </div>
  </div>
);

export default AudioMeters;
