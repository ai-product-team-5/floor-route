import { useState } from 'react';
import type { RouteHistoryItem } from '../../core/types';
import { CaptureCorrectionFlow } from './capture/CaptureCorrectionFlow';
import { NavigationFlow } from './flow/NavigationFlow';

type NavigationSessionProps = {
  initialRoute?: RouteHistoryItem;
  onClose: () => void;
};

type SessionState =
  | { stage: 'capture' }
  | { stage: 'navigation'; imageDataUrl: string }
  | { stage: 'history-result'; route: RouteHistoryItem };

export function NavigationSession({
  initialRoute,
  onClose,
}: NavigationSessionProps) {
  const [sessionState, setSessionState] = useState<SessionState>(
    initialRoute ? { stage: 'history-result', route: initialRoute } : { stage: 'capture' },
  );

  function restartCapture() {
    setSessionState({ stage: 'capture' });
  }

  if (sessionState.stage === 'capture') {
    return (
      <CaptureCorrectionFlow
        onCancel={onClose}
        onConfirm={(imageDataUrl) =>
          setSessionState({ stage: 'navigation', imageDataUrl })
        }
      />
    );
  }

  return (
    <div className="navigation-session">
      <NavigationFlow
        initialRoute={
          sessionState.stage === 'history-result' ? sessionState.route : undefined
        }
        initialImageDataUrl={
          sessionState.stage === 'navigation' ? sessionState.imageDataUrl : undefined
        }
        onRetake={restartCapture}
      />
    </div>
  );
}
