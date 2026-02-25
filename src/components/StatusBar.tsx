import type { FC } from "react";
import type { CallStatus } from "../types/call";

type StatusBarProps = CallStatus;

const StatusBar: FC<StatusBarProps> = ({ text, level }) => (
  <div className="status" data-level={level}>
    {text}
  </div>
);

export default StatusBar;
