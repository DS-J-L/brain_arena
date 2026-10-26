import { useEffect, useState } from "react";
import type { NumberCardValue } from "@brain-arena/shared";

interface Props {
  index: number;
  value: NumberCardValue | null;
  selectionOrder: number;
  disabled: boolean;
  onPick: () => void;
}

// Keep the outgoing face until its 600 ms CSS rotation has finished.
const FLIP_DURATION_MS = 600;

export function MemoryCard({ index, value, selectionOrder, disabled, onPick }: Props) {
  const [outgoingValue, setOutgoingValue] = useState(value);
  const faceUp = value !== null;
  const label = String.fromCharCode(65 + index);

  useEffect(() => {
    if (value !== null) {
      setOutgoingValue(value);
      return;
    }
    const timeout = window.setTimeout(() => setOutgoingValue(null), FLIP_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <button
      className={`memory-card ${faceUp ? "is-face-up" : ""} ${selectionOrder > 0 ? "selected" : ""}`}
      disabled={disabled}
      onClick={onPick}
      aria-label={`${label} 카드${faceUp ? `: ${value}` : ""}${selectionOrder > 0 ? `, ${selectionOrder}번째 선택` : ""}`}
      aria-pressed={selectionOrder > 0}
    >
      <span className="memory-card-inner" aria-hidden="true">
        <span className="memory-card-face memory-card-back">
          <small>{label}</small>
          <strong>{label}</strong>
        </span>
        <span className="memory-card-face memory-card-front">
          <small>{label}</small>
          <strong>{value ?? outgoingValue}</strong>
        </span>
      </span>
      {selectionOrder > 0 && <em aria-hidden="true">{selectionOrder}</em>}
    </button>
  );
}
