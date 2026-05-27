import { forwardRef, useImperativeHandle, useState } from 'react';
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

export type CaptureCorrectionFlowHandle = {
  handleBack: () => boolean;
};

type CaptureStep = 'camera' | 'correction';

export const CaptureCorrectionFlow = forwardRef<CaptureCorrectionFlowHandle, CaptureCorrectionFlowProps>(function CaptureCorrectionFlow({
  onCancel,
  onConfirm,
}, ref) {
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

  useImperativeHandle(ref, () => ({
    handleBack() {
      if (step === 'correction') {
        setStep('camera');
        return true;
      }

      return false;
    },
  }), [step]);

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
});
