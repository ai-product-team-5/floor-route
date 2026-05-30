import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react';
import type { DestinationCandidate } from '../../../backend/navigation/navigationBackend';
import type { NormalizedPoint, RouteHistoryItem } from '../../../core/types';
import { useHistoryStore } from '../../../store/historyStore';
import { navigationBackend } from '../../../backend/navigation/navigationBackend';
import { buildWallGridFromMask } from '../../path-planning/wallMaskProcessing';
import { planPath } from '../../path-planning/pathPlanning';
import {
  createNavigationFlowState,
  navigationFlowReducer,
} from './navigationFlowReducer';
import { AgentRouteResultStep } from './steps/AgentRouteResultStep';
import { NavigationWorkspaceStep } from './steps/NavigationWorkspaceStep';
import { WallMaskPreviewStep } from './steps/WallMaskPreviewStep';

const ENDPOINT_CONFIDENCE_THRESHOLD = 0.3;

type NavigationFlowProps = {
  initialRoute?: RouteHistoryItem;
  initialImageDataUrl?: string;
  onRetake: () => void;
};

export type NavigationFlowHandle = {
  handleBack: () => boolean;
};

function createHistoryId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const NavigationFlow = forwardRef<NavigationFlowHandle, NavigationFlowProps>(function NavigationFlow({
  initialRoute,
  initialImageDataUrl,
  onRetake,
}, ref) {
  const [state, dispatch] = useReducer(
    navigationFlowReducer,
    { initialRoute, initialImageDataUrl },
    createNavigationFlowState,
  );
  const [isSaved, setIsSaved] = useState(Boolean(initialRoute));
  const addItem = useHistoryStore((history) => history.addItem);
  const isHydrated = useHistoryStore((history) => history.isHydrated);
  const loadHistory = useHistoryStore((history) => history.loadHistory);

  // 取消标志，避免 unmount 后还 dispatch
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      void loadHistory();
    }
  }, [isHydrated, loadHistory]);

  // 校正完成后立刻请求墙体掩码（无 wallMask 时）
  useEffect(() => {
    if (!state.imageDataUrl || state.wallMaskDataUrl) return;
    if (initialRoute) return; // 历史回看不重新生成
    if (state.stage !== 'generating-walls') return;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const result = await navigationBackend.generateWallMask(
          { imageDataUrl: state.imageDataUrl! },
          { signal: controller.signal },
        );
        if (cancelled || !aliveRef.current) return;
        dispatch({
          type: 'walls-generation-finished',
          wallMaskDataUrl: result.wallMaskDataUrl,
        });
      } catch (error) {
        if (cancelled || !aliveRef.current) return;
        if ((error as DOMException)?.name === 'AbortError') return;
        const message = error instanceof Error ? error.message : '墙体生成失败，请重试。';
        dispatch({ type: 'walls-generation-failed', message });
        if (typeof window !== 'undefined') {
          window.alert(message);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.imageDataUrl, state.wallMaskDataUrl, state.stage, initialRoute]);

  useImperativeHandle(ref, () => ({
    handleBack() {
      if (initialRoute) {
        return false;
      }

      switch (state.stage) {
        case 'show-result':
          setIsSaved(false);
          dispatch({
            type: 'destination-search-reset',
            message: '请重新搜索目的地。',
          });
          return true;
        case 'searching-destinations':
        case 'destination-candidates':
        case 'locating-endpoints':
        case 'planning-path':
          dispatch({ type: 'destination-search-reset' });
          return true;
        case 'generating-walls':
        case 'showing-walls':
        case 'awaiting-intent':
          onRetake();
          return true;
      }
    },
  }), [initialRoute, onRetake, state.stage]);

  async function handleDestinationSearch() {
    if (!state.imageDataUrl || !state.promptText.trim()) {
      return;
    }

    const query = state.promptText.trim();
    setIsSaved(false);
    dispatch({ type: 'destination-search-started' });

    try {
      const result = await navigationBackend.searchDestinations({
        imageDataUrl: state.imageDataUrl,
        query,
        limit: 5,
      });

      if (!aliveRef.current) return;
      dispatch({
        type: 'destination-search-finished',
        candidates: result.candidates,
        message: result.message,
      });
    } catch (error) {
      if (!aliveRef.current) return;
      dispatch({
        type: 'destination-search-failed',
        message: error instanceof Error ? error.message : '目的地搜索失败，请重试。',
      });
    }
  }

  async function handleCandidateSelect(candidate: DestinationCandidate) {
    if (!state.imageDataUrl || !state.wallMaskDataUrl) {
      const msg = '墙体掩码尚未就绪，请稍后再试。';
      dispatch({ type: 'endpoints-location-failed', message: msg });
      window.alert(msg);
      return;
    }

    setIsSaved(false);
    dispatch({
      type: 'endpoints-location-started',
      destinationText: candidate.title,
    });

    let endpoints;
    try {
      endpoints = await navigationBackend.locateEndpoints({
        imageDataUrl: state.imageDataUrl,
        destination: candidate.title,
      });
    } catch (error) {
      if (!aliveRef.current) return;
      const msg = error instanceof Error ? error.message : '起终点定位失败，请重试。';
      dispatch({ type: 'endpoints-location-failed', message: msg });
      window.alert(msg);
      return;
    }
    if (!aliveRef.current) return;

    if (
      endpoints.start.confidence < ENDPOINT_CONFIDENCE_THRESHOLD ||
      endpoints.end.confidence < ENDPOINT_CONFIDENCE_THRESHOLD
    ) {
      const msg =
        endpoints.message ||
        '没法准确识别起点或终点，请换个目的地或重新拍摄平面图。';
      dispatch({ type: 'endpoints-location-failed', message: msg });
      window.alert(msg);
      return;
    }

    dispatch({
      type: 'endpoints-location-finished',
      start: endpoints.start,
      end: endpoints.end,
      message: endpoints.message,
    });

    // 本地寻路
    try {
      const grid = await buildWallGridFromMask(state.wallMaskDataUrl);
      const planned = planPath({
        grid,
        start: { x: endpoints.start.x, y: endpoints.start.y },
        end: { x: endpoints.end.x, y: endpoints.end.y },
      });
      if (!aliveRef.current) return;
      dispatch({
        type: 'path-planned',
        destinationText: candidate.title,
        pathPoints: planned.pathPoints,
        startPoint: planned.snappedStart,
        endPoint: planned.snappedEnd,
      });
    } catch (error) {
      if (!aliveRef.current) return;
      const msg = error instanceof Error ? error.message : '路径规划失败，请重试。';
      dispatch({ type: 'path-planning-failed', message: msg });
      window.alert(msg);
    }
  }

  async function handleSave() {
    if (
      !state.imageDataUrl ||
      !state.destinationText ||
      !state.pathPoints ||
      !state.startPoint ||
      !state.endPoint
    ) {
      return;
    }

    const item: RouteHistoryItem = {
      id: createHistoryId(),
      createdAt: Date.now(),
      startText: '当前位置',
      endText: state.destinationText,
      originalImageUrl: state.imageDataUrl,
      mode: 'astar',
      wallMaskDataUrl: state.wallMaskDataUrl,
      startPoint: state.startPoint,
      endPoint: state.endPoint,
      pathPoints: state.pathPoints,
    };

    await addItem(item);
    setIsSaved(true);
  }

  const handleWallsAcknowledged = useCallback(() => {
    dispatch({ type: 'walls-acknowledged' });
  }, []);

  function renderStep() {
    switch (state.stage) {
      case 'generating-walls':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: state.agentMessage || '正在分析墙体结构…' }}
          />
        );
      case 'showing-walls':
        if (!state.imageDataUrl || !state.wallMaskDataUrl) return null;
        return (
          <WallMaskPreviewStep
            imageUrl={state.imageDataUrl}
            wallMaskUrl={state.wallMaskDataUrl}
            autoAdvanceMs={2000}
            onContinue={handleWallsAcknowledged}
          />
        );
      case 'awaiting-intent':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'destination-search',
              promptText: state.promptText,
              placeholder: '搜索一下',
              message: state.agentMessage,
              candidates: [],
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'searching-destinations':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'destination-search',
              promptText: state.promptText,
              placeholder: '搜索一下',
              candidates: [],
              isSearching: true,
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'destination-candidates':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'destination-search',
              promptText: state.promptText,
              placeholder: '搜索一下',
              message: state.agentMessage || '请选择最匹配的目的地。',
              candidates: state.destinationCandidates,
              hasSearched: true,
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'locating-endpoints':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在定位起点和终点…' }}
          />
        );
      case 'planning-path':
        if (!state.imageDataUrl) return null;
        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在规划路径…' }}
          />
        );
      case 'show-result': {
        if (!state.imageDataUrl) return null;

        return (
          <AgentRouteResultStep
            imageUrl={state.imageDataUrl}
            destinationText={state.destinationText}
            isSaved={isSaved}
            onSave={() => void handleSave()}
            onRevise={() =>
              dispatch({
                type: 'destination-search-reset',
                message: '请重新搜索目的地。',
              })
            }
            onReset={onRetake}
            pathPoints={state.pathPoints as NormalizedPoint[] | undefined}
            startPoint={state.startPoint}
            endPoint={state.endPoint}
            legacyResultImageUrl={state.resultImageUrl}
          />
        );
      }
    }
  }

  return <div className="page-stack">{renderStep()}</div>;
});
