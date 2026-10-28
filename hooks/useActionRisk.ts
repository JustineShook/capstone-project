import { useEffect, useState } from "react";
import { subscribeToMyActionRiskCount, type RiskActor } from "../services/actionRiskService";

export function useActionRisk(actor: RiskActor) {
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    let stop: (() => void) | undefined;
    try {
      stop = subscribeToMyActionRiskCount(actor, setCount, (cause) => {
        setError(cause.message || "Could not load recent account activity.");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load recent account activity.");
    }
    return () => stop?.();
  }, [actor]);

  return { count, error };
}
