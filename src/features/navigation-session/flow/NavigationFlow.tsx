import { useEffect, useReducer, useState } from 'react';
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

function createHistoryId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NavigationFlow({
  initialRoute,
  initialImageDataUrl,
  onRetake,
}: NavigationFlowProps) {
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

  async function handleIntentSubmit() {
    if (!state.imageDataUrl || !state.promptText.trim()) {
      return;
    }

    const prompt = state.promptText.trim();
    setIsSaved(false);
    dispatch({ type: 'intent-analysis-started' });

    let response;
    try {
      response = await navigationBackend.resolveNavigationIntent({
        imageDataUrl: state.imageDataUrl,
        prompt,
        previousPrompt: state.destinationText || undefined,
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
              type: 'input',
              promptText: state.promptText,
              placeholder: '请描述您的目的地',
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleIntentSubmit(),
            }}
          />
        );
      case 'analyzing-intent':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{ type: 'status', label: '正在分析路线' }}
          />
        );
      case 'needs-more-info':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'input',
              promptText: state.promptText,
              placeholder: state.agentMessage || '请补充目的地信息',
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleIntentSubmit(),
            }}
          />
        );
      case 'unsupported-intent':
        if (!state.imageDataUrl) return null;

        return (
          <NavigationWorkspaceStep
            imageUrl={state.imageDataUrl}
            bottom={{
              type: 'input',
              promptText: state.promptText,
              placeholder: state.agentMessage || '请告诉我你想去哪里',
              onPromptChange: (value) =>
                dispatch({ type: 'intent-text-changed', value }),
              onSubmit: () => void handleIntentSubmit(),
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
}
