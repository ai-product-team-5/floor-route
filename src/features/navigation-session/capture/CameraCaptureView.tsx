import { Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Image, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type CameraCaptureViewProps = {
  errorMessage: string;
  onCapture: (imageDataUrl: string) => void;
  onChooseFromGallery: () => void;
  onUseSystemCamera: () => void;
  onCancel: () => void;
};

export function CameraCaptureView({
  errorMessage,
  onCapture,
  onChooseFromGallery,
  onUseSystemCamera,
  onCancel,
}: CameraCaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('当前环境不支持实时相机预览。');
        return;
      }

      try {
        if (Capacitor.isNativePlatform()) {
          const permissions = await Camera.requestPermissions({
            permissions: ['camera'],
          });

          if (permissions.camera !== 'granted') {
            setCameraError('需要相机权限才能打开实时预览。');
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1920 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsReady(true);
      } catch {
        setCameraError('无法打开相机。你可以改用系统相机或从图库选择。');
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.92));
  }

  const status = errorMessage || cameraError;

  return (
    <section className="camera-capture-view">
      <video ref={videoRef} className="camera-preview" playsInline muted />
      <div className="camera-scrim" />
      <div className="camera-scan-frame" aria-hidden="true" />

      {status && (
        <div className="camera-fallback-panel">
          <p>{status}</p>
          <button type="button" className="secondary-button full-width" onClick={onUseSystemCamera}>
            打开系统相机
          </button>
        </div>
      )}

      <div className="camera-controls">
        <button
          type="button"
          className="camera-control-button camera-cancel-button"
          onClick={onCancel}
          aria-label="返回"
        >
          <Undo2 aria-hidden="true" size={29} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="camera-shutter-button"
          disabled={!isReady}
          onClick={captureFrame}
          aria-label="拍摄"
        />
        <button
          type="button"
          className="camera-control-button camera-gallery-button"
          onClick={onChooseFromGallery}
          aria-label="从图库选择"
        >
          <Image aria-hidden="true" size={27} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  );
}
