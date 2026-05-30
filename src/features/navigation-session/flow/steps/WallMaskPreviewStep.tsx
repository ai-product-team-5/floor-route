import { useEffect, useState } from 'react';

type WallMaskPreviewStepProps = {
  imageUrl: string;
  wallMaskUrl: string;
  /** 自动推进的总时长（毫秒）。为 0 则不自动推进 */
  autoAdvanceMs?: number;
  onContinue: () => void;
};

/**
 * "AI 识别墙体" 展示步骤。
 * 自动推进 + 进度条动画。视觉上把原图淡出 → 墙体掩码淡入。
 */
export function WallMaskPreviewStep({
  imageUrl,
  wallMaskUrl,
  autoAdvanceMs = 2000,
  onContinue,
}: WallMaskPreviewStepProps) {
  const [phase, setPhase] = useState<'enter' | 'reveal'>('enter');

  useEffect(() => {
    const revealTimer = setTimeout(() => setPhase('reveal'), 50);
    return () => clearTimeout(revealTimer);
  }, []);

  useEffect(() => {
    if (autoAdvanceMs <= 0) return;
    const advanceTimer = setTimeout(onContinue, autoAdvanceMs);
    return () => clearTimeout(advanceTimer);
    // onContinue 由父组件通过 useCallback 稳定引用，但保险起见忽略
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceMs]);

  return (
    <section className="wall-mask-preview-stage">
      <div>
        <p className="section-kicker">墙体识别</p>
        <h2>AI 已识别平面图墙体</h2>
        <p className="wall-mask-preview-subtitle">
          基于墙体结构，本地算法将自动规划路径
        </p>
      </div>

      <div className={`wall-mask-preview-frame ${phase === 'reveal' ? 'is-revealed' : ''}`}>
        <img
          className="wall-mask-preview-original"
          src={imageUrl}
          alt="原始平面图"
        />
        <img
          className="wall-mask-preview-mask"
          src={wallMaskUrl}
          alt="墙体掩码"
        />
        <div className="wall-mask-preview-scan" aria-hidden="true" />
      </div>

      <div
        className="wall-mask-preview-progress"
        aria-hidden="true"
        style={{ ['--auto-advance-ms' as string]: `${autoAdvanceMs}ms` }}
      >
        <span />
      </div>
    </section>
  );
}
