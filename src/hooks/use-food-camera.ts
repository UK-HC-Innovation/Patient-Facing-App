"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type CameraStatus = "idle" | "starting" | "active" | "denied" | "unavailable";

const MAX_EDGE = 768;
export const DETAILED_MAX_EDGE = 2048;
export const DETAILED_MAX_DATA_URL_CHARS = 3_600_000;

const DETAILED_QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58] as const;
const RASTER_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif"
]);

type DetailedImageSource = CanvasImageSource & { width: number; height: number };

type BrowserImageCapture = {
  takePhoto: () => Promise<Blob>;
};

type BrowserImageCaptureConstructor = new (track: MediaStreamTrack) => BrowserImageCapture;

async function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", finish);
      video.removeEventListener("canplay", finish);
      video.removeEventListener("resize", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, 2_000);
    video.addEventListener("loadeddata", finish, { once: true });
    video.addEventListener("canplay", finish, { once: true });
    video.addEventListener("resize", finish, { once: true });
  });
}

function detailedDimensions(width: number, height: number, maxEdge = DETAILED_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function decodedBlobSource(
  blob: Blob
): Promise<{ source: DetailedImageSource; release: () => void } | null> {
  if (!RASTER_IMAGE_TYPES.has(blob.type.toLowerCase())) return null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      return { source: bitmap, release: () => bitmap.close() };
    } catch {
      // Some browsers expose createImageBitmap but reject formats their native image
      // decoder can still open (notably HEIC/HEIF on Safari). Fall through to <img>.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  try {
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image_decode_failed"));
    });
    image.src = objectUrl;
    await loaded;
    return {
      source: image as DetailedImageSource,
      release: () => {
        image.src = "";
        URL.revokeObjectURL(objectUrl);
      }
    };
  } catch {
    image.src = "";
    URL.revokeObjectURL(objectUrl);
    return null;
  }
}

/**
 * Draws a decoded source onto a fresh canvas. That strips source metadata and gives the
 * provider one bounded JPEG regardless of the device/file format.
 */
export function normalizeDetailedImageSource(
  source: CanvasImageSource,
  dimensions?: { width: number; height: number }
): string | null {
  const sourceWidth = dimensions?.width ?? (source as DetailedImageSource).width;
  const sourceHeight = dimensions?.height ?? (source as DetailedImageSource).height;
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth < 1 ||
    sourceHeight < 1
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  let target = detailedDimensions(sourceWidth, sourceHeight);
  try {
    for (let resizeAttempt = 0; resizeAttempt < 6; resizeAttempt += 1) {
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(source, 0, 0, target.width, target.height);

      for (const quality of DETAILED_QUALITIES) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (
          dataUrl.startsWith("data:image/jpeg;base64,") &&
          dataUrl.length <= DETAILED_MAX_DATA_URL_CHARS
        ) {
          return dataUrl;
        }
      }

      target = detailedDimensions(target.width, target.height, Math.floor(Math.max(target.width, target.height) * 0.82));
    }
    return null;
  } catch {
    return null;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function normalizeFoodLabelImage(blob: Blob): Promise<string | null> {
  const decoded = await decodedBlobSource(blob);
  if (!decoded) return null;
  try {
    return normalizeDetailedImageSource(decoded.source);
  } finally {
    decoded.release();
  }
}

export function useFoodCamera(): {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  start: () => Promise<void>;
  stop: () => void;
  grabFrame: () => string | null;
  captureDetailedFrame: () => Promise<string | null>;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const clearCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    clearCamera();
    if (mountedRef.current) setStatus("idle");
  }, [clearCamera]);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      if (mountedRef.current) setStatus("unavailable");
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: DETAILED_MAX_EDGE } },
        audio: false
      });
      if (!mountedRef.current || generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      clearCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
        await waitForVideoFrame(videoRef.current);
      }
      if (!mountedRef.current || generationRef.current !== generation) {
        if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        return;
      }
      setStatus("active");
    } catch {
      if (mountedRef.current && generationRef.current === generation) setStatus("denied");
    }
  }, [clearCamera]);

  const grabFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1 || document.hidden) {
      return null;
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    try {
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(video, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch {
      return null;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }, []);

  const captureDetailedFrame = useCallback(async (): Promise<string | null> => {
    const generation = generationRef.current;
    const stream = streamRef.current;
    const track = stream?.getVideoTracks()[0];
    const ImageCaptureConstructor = (globalThis as typeof globalThis & {
      ImageCapture?: BrowserImageCaptureConstructor;
    }).ImageCapture;
    if (track && ImageCaptureConstructor) {
      try {
        const photo = await new ImageCaptureConstructor(track).takePhoto();
        const normalized = await normalizeFoodLabelImage(photo);
        if (normalized && mountedRef.current && generationRef.current === generation) return normalized;
      } catch {
        // Some browsers expose ImageCapture but reject takePhoto for a live track.
      }
    }

    const video = videoRef.current;
    if (
      !mountedRef.current ||
      generationRef.current !== generation ||
      !video ||
      video.videoWidth < 1 ||
      video.videoHeight < 1
    ) return null;
    const normalized = normalizeDetailedImageSource(video, {
      width: video.videoWidth,
      height: video.videoHeight
    });
    return mountedRef.current && generationRef.current === generation ? normalized : null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearCamera();
    };
  }, [clearCamera]);

  return { videoRef, status, start, stop, grabFrame, captureDetailedFrame };
}
