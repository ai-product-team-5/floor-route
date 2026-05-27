import { forwardRef, useEffect, useImperativeHandle, useReducer, useState } from 'react';
import type { DestinationCandidate } from '../../../backend/navigation/navigationBackend';
import type { RouteHistoryItem } from '../../../core/types';
import { useHistoryStore } from '../../../store/historyStore';
import { navigationBackend } from '../../../backend/navigation/navigationBackend';
import {
  createNavigationFlowState,
  navigationFlowReducer,
} from './navigationFlowReducer';
import { AgentRouteResultStep } from './steps/AgentRouteResultStep';
import { NavigationWorkspaceStep } from './steps/NavigationWorkspaceStep';

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

  useEffect(() => {
    if (!isHydrated) {
      void loadHistory();
    }
  }, [isHydrated, loadHistory]);

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
        case 'analyzing-intent':
        case 'needs-more-info':
        case 'unsupported-intent':
          dispatch({ type: 'destination-search-reset' });
          return true;
        case 'analyzing-map':
        case 'map-analysis-failed':
        case 'awaiting-intent':
          onRetake();
          return true;
      }
    },
  }), [initialRoute, onRetake, state.stage]);

  useEffect(() => {
    if (state.stage !== 'analyzing-map' || !state.imageDataUrl) {
      return undefined;
    }

    let isCurrent = true;

    async function analyzeImage() {
      if (!state.imageDataUrl) return;

      try {
        const analysis = await navigationBackend.analyzeFloorPlan({
          imageDataUrl: state.imageDataUrl,
        });
        if (isCurrent) {
          dispatch({ type: 'map-analysis-finished', message: analysis.message });
        }
      } catch (error) {
        if (isCurrent) {
          dispatch({
            type: 'map-analysis-failed',
            message:
              error instanceof Error
                ? error.message
                : '平面图分析失败，请检查图片模型配置后重试。',
          });
        }
      }
    }

    void analyzeImage();

    return () => {
      isCurrent = false;
    };
  }, [state.stage, state.imageDataUrl]);

  async function handleDestinationSearch() {
    if (!state.imageDataUrl || !state.promptText.trim()) {
      return;
    }

    const query = state.promptText.trim();
    setIsSaved(false);
    dispatch({ type: 'destination-search-started' });

    try {
      const result = await navigationBackend.searchDestinationCandidates({
        imageDataUrl: state.imageDataUrl,
        query,
        limit: 5,
      });

      dispatch({
        type: 'destination-search-finished',
        candidates: result.candidates,
        message: result.message,
      });
    } catch (error) {
      dispatch({
        type: 'destination-search-failed',
        message: error instanceof Error ? error.message : '目的地搜索失败，请重试。',
      });
    }
  }

  async function handleCandidateSelect(candidate: DestinationCandidate) {
    if (!state.imageDataUrl) {
      return;
    }

    setIsSaved(false);
    dispatch({ type: 'intent-analysis-started' });

    let response;
    try {
      response = await navigationBackend.resolveNavigationIntent({
        imageDataUrl: state.imageDataUrl,
        prompt: candidate.title,
        previousPrompt: state.promptText || undefined,
        destinationCandidate: candidate,
      });
    } catch (error) {
      dispatch({
        type: 'intent-analysis-failed',
        message: error instanceof Error ? error.message : '意图识别失败，请检查配置后重试。',
      });
      return;
    }

    switch (response.type) {
      case 'route-found':
        dispatch({
          type: 'route-found',
          destinationText: response.destinationText,
          resultImageUrl: response.resultImageUrl,
          path: response.path,
          message: response.message,
        });
        return;
      case 'need-more-info':
        dispatch({
          type: 'more-info-requested',
          destinationText: response.destinationText,
          message: response.message,
        });
        return;
      case 'unsupported-intent':
        dispatch({
          type: 'unsupported-intent',
          message: response.message,
        });
        return;
    }
  }

  async function handleSave() {
    if (!state.imageDataUrl || !state.resultImageUrl || !state.destinationText) {
      return;
    }

    const item: RouteHistoryItem = {
      id: createHistoryId(),
      createdAt: Date.now(),
      startText: '当前位置',
      endText: state.destinationText,
      originalImageUrl: state.imageDataUrl,
      resultImageUrl: state.resultImageUrl,
      path: state.path,
      mode: state.mode,
    };

    await addItem(item);
    setIsSaved(true);
  }

  function renderStep() {
    switch (state.stage) {
      case 'analyzing-map':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在分析平面图' }}
          />
        );
      case 'map-analysis-failed':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: state.agentMessage }}
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
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'analyzing-intent':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在生成路线' }}
          />
        );
      case 'needs-more-info':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'destination-search',
              promptText: state.promptText,
              placeholder: '搜索一下',
              message: state.agentMessage || '请补充目的地信息',
              candidates: [],
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'unsupported-intent':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'destination-search',
              promptText: state.promptText,
              placeholder: '搜索一下',
              message: state.agentMessage || '请告诉我你想去哪里',
              candidates: [],
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleDestinationSearch(),
              onCandidateSelect: (candidate) => void handleCandidateSelect(candidate),
              onBack: onRetake,
            }}
          />
        );
      case 'show-result':
        if (!state.resultImageUrl) return null;

        return (
          <AgentRouteResultStep
            imageUrl={state.resultImageUrl}
            path={state.path}
            destinationText={state.destinationText}
            isSaved={isSaved}
            onSave={() => void handleSave()}
            onRevise={() =>
              dispatch({
                type: 'more-info-requested',
                destinationText: state.destinationText,
                message: '请补充或重新描述你的目的地。',
              })
            }
            onReset={onRetake}
          />
        );
    }
  }

  return <div className="page-stack">{renderStep()}</div>;
});
