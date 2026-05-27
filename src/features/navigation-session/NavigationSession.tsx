import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import type { RouteHistoryItem } from '../../core/types';
import {
  CaptureCorrectionFlow,
  type CaptureCorrectionFlowHandle,
} from './capture/CaptureCorrectionFlow';
import { NavigationFlow, type NavigationFlowHandle } from './flow/NavigationFlow';

type NavigationSessionProps = {
  initialRoute?: RouteHistoryItem;
  onClose: () => void;
};

export type NavigationSessionHandle = {
  handleBack: () => boolean;
};

type SessionState =
  | { stage: 'capture' }
  | { stage: 'navigation'; imageDataUrl: string }
  | { stage: 'history-result'; route: RouteHistoryItem };

export const NavigationSession = forwardRef<NavigationSessionHandle, NavigationSessionProps>(function NavigationSession({
  initialRoute,
  onClose,
}, ref) {
  const captureFlowRef = useRef<CaptureCorrectionFlowHandle | null>(null);
  const navigationFlowRef = useRef<NavigationFlowHandle | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>(
    initialRoute ? { stage: 'history-result', route: initialRoute } : { stage: 'capture' },
  );

  function restartCapture() {
    setSessionState({ stage: 'capture' });
  }

  useImperativeHandle(ref, () => ({
    handleBack() {
      if (sessionState.stage === 'capture') {
        return captureFlowRef.current?.handleBack() ?? false;
      }

      if (sessionState.stage === 'navigation') {
        return navigationFlowRef.current?.handleBack() ?? false;
      }

      return false;
    },
  }), [sessionState.stage]);

  if (sessionState.stage === 'capture') {
    return (
      <CaptureCorrectionFlow
        ref={captureFlowRef}
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
        ref={navigationFlowRef}
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
});
