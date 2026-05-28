import { useEffect } from "react";

export default function Toast({ message, onClear }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onClear?.(), 2600);
    return () => clearTimeout(t);
  }, [message, onClear]);

  return <div className={`toast ${message ? "show" : ""}`}>{message || ""}</div>;
}

