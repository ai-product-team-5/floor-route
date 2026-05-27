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
        case 'generating-path':
          dispatch({ type: 'destination-search-reset' });
          return true;
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
    dispatch({ type: 'path-generation-started' });

    try {
      const result = await navigationBackend.generatePath({
        imageDataUrl: state.imageDataUrl,
        destination: candidate.title,
      });

      dispatch({
        type: 'path-generated',
        destinationText: candidate.title,
        resultImageUrl: result.resultImageUrl,
        message: result.message,
      });
    } catch (error) {
      dispatch({
        type: 'path-generation-failed',
        message: error instanceof Error ? error.message : '路径生成失败，请重试。',
      });
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
      mode: state.mode,
    };

    await addItem(item);
    setIsSaved(true);
  }

  function renderStep() {
    switch (state.stage) {
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
      case 'generating-path':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在生成路线' }}
          />
        );
      case 'show-result':
        if (!state.resultImageUrl) return null;

        return (
          <AgentRouteResultStep
            imageUrl={state.resultImageUrl}
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
          />
        );
    }
  }

  return <div className="page-stack">{renderStep()}</div>;
});
