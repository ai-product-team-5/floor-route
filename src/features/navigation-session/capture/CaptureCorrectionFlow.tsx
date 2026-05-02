import { useState } from 'react';
import {
  captureErrorMessage,
  captureFromCamera,
  chooseFromGallery,
  isCaptureCancelled,
} from './captureImage';
import { CameraCaptureView } from './CameraCaptureView';
import { PerspectiveCorrectionView } from '../correction/PerspectiveCorrectionView';

type CaptureCorrectionFlowProps = {
  onCancel: () => void;
  onConfirm: (correctedImageDataUrl: string) => void;
};

type CaptureStep = 'camera' | 'correction';

export function CaptureCorrectionFlow({
  onCancel,
  onConfirm,
}: CaptureCorrectionFlowProps) {
  const [step, setStep] = useState<CaptureStep>('camera');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [captureError, setCaptureError] = useState('');

  function handleImageCaptured(nextImageDataUrl: string) {
    setCaptureError('');
    setImageDataUrl(nextImageDataUrl);
    setStep('correction');
  }

  async function handleSystemCapture(source: 'camera' | 'gallery') {
    setCaptureError('');

    try {
      const image = source === 'camera'
        ? await captureFromCamera()
        : await chooseFromGallery();
      handleImageCaptured(image);
    } catch (error) {
      if (!isCaptureCancelled(error)) {
        setCaptureError(captureErrorMessage(error));
      }
    }
  }

  if (step === 'correction' && imageDataUrl) {
    return (
      <PerspectiveCorrectionView
        key={imageDataUrl}
        imageDataUrl={imageDataUrl}
        onCancel={onCancel}
        onRetake={() => setStep('camera')}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <CameraCaptureView
      errorMessage={captureError}
      onCapture={handleImageCaptured}
      onChooseFromGallery={() => void handleSystemCapture('gallery')}
      onUseSystemCamera={() => void handleSystemCapture('camera')}
      onCancel={onCancel}
    />
  );
}
