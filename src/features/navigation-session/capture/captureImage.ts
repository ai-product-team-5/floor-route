import {
  Camera,
  CameraDirection,
  CameraErrorCode,
  MediaTypeSelection,
  type MediaResult,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

const cancelledCodes = new Set<string>([
  CameraErrorCode.TakePhotoCancelled,
  CameraErrorCode.ChooseMediaCancelled,
]);

export class CaptureCancelledError extends Error {
  constructor() {
    super('Capture cancelled.');
    this.name = 'CaptureCancelledError';
  }
}

type PluginLikeError = {
  code?: string;
  message?: string;
};

export function isCaptureCancelled(error: unknown) {
  return error instanceof CaptureCancelledError;
}

export function captureErrorMessage(error: unknown) {
  const pluginError = error as PluginLikeError;

  switch (pluginError.code) {
    case CameraErrorCode.CameraPermissionDenied:
      return '没有相机权限，请在系统设置中允许访问相机。';
    case CameraErrorCode.GalleryPermissionDenied:
      return '没有相册权限，请在系统设置中允许访问照片。';
    case CameraErrorCode.NoCameraAvailable:
      return '当前设备没有可用相机。';
    default:
      return pluginError.message || '图片获取失败，请重试。';
  }
}

export async function captureFromCamera() {
  try {
    const result = await Camera.takePhoto({
      quality: 90,
      includeMetadata: true,
      correctOrientation: true,
      cameraDirection: CameraDirection.Rear,
      webUseInput: true,
    });

    return mediaResultToDataUrl(result);
  } catch (error) {
    throw normalizeCaptureError(error);
  }
}

export async function chooseFromGallery() {
  try {
    const result = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      quality: 90,
      includeMetadata: true,
      correctOrientation: true,
      allowMultipleSelection: false,
      limit: 1,
      webUseInput: true,
    });

    const image = result.results[0];
    if (!image) {
      throw new CaptureCancelledError();
    }

    return mediaResultToDataUrl(image);
  } catch (error) {
    throw normalizeCaptureError(error);
  }
}

function normalizeCaptureError(error: unknown) {
  const pluginError = error as PluginLikeError;

  if (
    cancelledCodes.has(pluginError.code ?? '') ||
    /cancel/i.test(pluginError.message ?? '')
  ) {
    return new CaptureCancelledError();
  }

  return error;
}

async function mediaResultToDataUrl(media: MediaResult) {
  if (Capacitor.isNativePlatform() && media.uri) {
    try {
      const file = await Filesystem.readFile({ path: media.uri });
      const data = typeof file.data === 'string'
        ? file.data
        : await blobToBase64(file.data);

      return toDataUrl(data, media.metadata?.format);
    } catch {
      if (media.thumbnail) {
        return toDataUrl(media.thumbnail, media.metadata?.format);
      }
      if (media.webPath) {
        return webPathToDataUrl(media.webPath);
      }
      throw new Error('没有读取到图片数据。');
    }
  }

  if (media.thumbnail) {
    return toDataUrl(media.thumbnail, media.metadata?.format);
  }

  if (media.webPath) {
    return webPathToDataUrl(media.webPath);
  }

  if (media.uri) {
    const file = await Filesystem.readFile({ path: media.uri });
    const data = typeof file.data === 'string'
      ? file.data
      : await blobToBase64(file.data);

    return toDataUrl(data, media.metadata?.format);
  }

  throw new Error('没有读取到图片数据。');
}

function toDataUrl(base64: string, format?: string) {
  if (base64.startsWith('data:')) {
    return base64;
  }

  return `data:${mimeFromFormat(format)};base64,${base64}`;
}

function mimeFromFormat(format?: string) {
  const normalized = format?.toLowerCase();

  if (normalized === 'png') return 'image/png';
  if (normalized === 'gif') return 'image/gif';
  if (normalized === 'webp') return 'image/webp';

  return 'image/jpeg';
}

async function webPathToDataUrl(webPath: string) {
  const response = await fetch(webPath);
  const blob = await response.blob();

  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('图片读取结果无效。'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败。'));
    reader.readAsDataURL(blob);
  });
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await blobToDataUrl(blob);
  return dataUrl.split(',')[1] ?? '';
}
