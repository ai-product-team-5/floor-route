import { ArrowLeft, Loader2, MapPin, Search, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DestinationCandidate } from '../../../../backend/navigation/navigationBackend';

type NavigationWorkspaceBottom =
  | {
      type: 'status';
      label: string;
    }
  | {
      type: 'input';
      promptText: string;
      placeholder: string;
      disabled?: boolean;
      onPromptChange: (value: string) => void;
      onSubmit: () => void;
    }
  | {
      type: 'candidates';
      promptText: string;
      placeholder: string;
      message: string;
      candidates: DestinationCandidate[];
      disabled?: boolean;
      onPromptChange: (value: string) => void;
      onSubmit: () => void;
      onCandidateSelect: (candidate: DestinationCandidate) => void;
    }
  | {
      type: 'destination-search';
      promptText: string;
      placeholder: string;
      message?: string;
      candidates: DestinationCandidate[];
      isSearching?: boolean;
      hasSearched?: boolean;
      disabled?: boolean;
      onPromptChange: (value: string) => void;
      onSubmit: () => void;
      onCandidateSelect: (candidate: DestinationCandidate) => void;
      onBack: () => void;
    };

type NavigationWorkspaceStepProps = {
  imageUrl: string;
  bottom: NavigationWorkspaceBottom;
};

export function NavigationWorkspaceStep({
  imageUrl,
  bottom,
}: NavigationWorkspaceStepProps) {
  if (bottom.type === 'destination-search') {
    return <DestinationSearchScreen imageUrl={imageUrl} bottom={bottom} />;
  }

  return (
    <section className="agent-workspace">
      <div className="agent-workspace-map">
        <img src={imageUrl} alt="已选择的平面图" />
      </div>

      {bottom.type === 'status' ? (
        <div className="agent-bottom-status" aria-live="polite">
          <Loader2 aria-hidden="true" size={22} className="spin-icon" />
          <span>{bottom.label}</span>
        </div>
      ) : bottom.type === 'input' ? (
        <form
          className="agent-input-bar"
          onSubmit={(event) => {
            event.preventDefault();
            bottom.onSubmit();
          }}
        >
          <input
            value={bottom.promptText}
            disabled={bottom.disabled}
            placeholder={bottom.placeholder}
            onChange={(event) => bottom.onPromptChange(event.target.value)}
          />
          <button
            type="submit"
            disabled={bottom.disabled || !bottom.promptText.trim()}
            aria-label="发送"
          >
            <SendHorizontal aria-hidden="true" size={19} />
          </button>
        </form>
      ) : (
        <section className="destination-candidate-sheet">
          <form
            className="agent-input-bar"
            onSubmit={(event) => {
              event.preventDefault();
              bottom.onSubmit();
            }}
          >
            <input
              value={bottom.promptText}
              disabled={bottom.disabled}
              placeholder={bottom.placeholder}
              onChange={(event) => bottom.onPromptChange(event.target.value)}
            />
            <button
              type="submit"
              disabled={bottom.disabled || !bottom.promptText.trim()}
              aria-label="搜索目的地"
            >
              <SendHorizontal aria-hidden="true" size={19} />
            </button>
          </form>

          <div className="destination-candidate-panel">
            <p className="destination-candidate-message">{bottom.message}</p>
            {bottom.candidates.length ? (
              <div className="destination-candidate-list" aria-label="目的地候选列表">
                {bottom.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="destination-candidate-item"
                    onClick={() => bottom.onCandidateSelect(candidate)}
                  >
                    <span>
                      <strong>{candidate.title}</strong>
                      {candidate.subtitle && <small>{candidate.subtitle}</small>}
                    </span>
                    <em>{Math.round(candidate.confidence * 100)}%</em>
                  </button>
                ))}
              </div>
            ) : (
              <p className="destination-candidate-empty">换个关键词再试一次。</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function DestinationSearchScreen({
  imageUrl,
  bottom,
}: {
  imageUrl: string;
  bottom: Extract<NavigationWorkspaceBottom, { type: 'destination-search' }>;
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const blurTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (blurTimerRef.current !== undefined) {
      window.clearTimeout(blurTimerRef.current);
    }
  }, []);

  function handleSearchFocus() {
    if (blurTimerRef.current !== undefined) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = undefined;
    }

    setIsSearchFocused(true);
  }

  function handleSearchBlur() {
    blurTimerRef.current = window.setTimeout(() => {
      setIsSearchFocused(false);
      blurTimerRef.current = undefined;
    }, 120);
  }

  return (
    <section className="destination-search-screen">
      <header className="destination-search-header">
        <button
          type="button"
          className="destination-search-back"
          onClick={bottom.onBack}
          aria-label="返回重新拍摄"
        >
          <ArrowLeft aria-hidden="true" size={30} strokeWidth={2.5} />
        </button>
      </header>

      <form
        className="destination-search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          bottom.onSubmit();
        }}
      >
        <Search aria-hidden="true" size={25} strokeWidth={2.2} />
        <input
          value={bottom.promptText}
          disabled={bottom.disabled || bottom.isSearching}
          placeholder={bottom.placeholder}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onChange={(event) => bottom.onPromptChange(event.target.value)}
        />
      </form>

      {bottom.message && <p className="destination-search-message">{bottom.message}</p>}

      <div className="destination-search-map">
        <img src={imageUrl} alt="已校正的平面图" />
      </div>

      <section
        className={`destination-result-panel${isSearchFocused ? ' is-raised' : ''}`}
        aria-label="目的地候选列表"
      >
        {bottom.isSearching ? (
          <div className="destination-result-loading" aria-live="polite">
            <Loader2 aria-hidden="true" size={22} className="spin-icon" />
            <span>正在搜索</span>
          </div>
        ) : bottom.candidates.length ? (
          bottom.candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              className="destination-result-row"
              onClick={() => bottom.onCandidateSelect(candidate)}
              aria-label={`选择${candidate.title}，匹配度${Math.round(candidate.confidence * 100)}%`}
            >
              <span className="destination-result-pin" aria-hidden="true">
                <MapPin size={18} strokeWidth={3} />
              </span>
              <span className="destination-result-title">{candidate.title}</span>
            </button>
          ))
        ) : bottom.hasSearched && bottom.promptText.trim() ? (
          <p className="destination-result-empty">没有找到匹配目的地，请换个关键词。</p>
        ) : (
          <p className="destination-result-empty">输入目的地后开始搜索。</p>
        )}
      </section>
    </section>
  );
}
