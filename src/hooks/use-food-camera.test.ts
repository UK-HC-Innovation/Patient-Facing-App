import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DETAILED_MAX_DATA_URL_CHARS,
  normalizeDetailedImageSource,
  normalizeFoodLabelImage,
  useFoodCamera
} from "./use-food-camera";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("detailed food-label image normalization", () => {
  it("clamps the long edge to 2048 and emits a bounded metadata-free JPEG", () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: () => "data:image/jpeg;base64,small"
    } as unknown as HTMLCanvasElement;
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) =>
      tagName === "canvas" ? canvas : originalCreate(tagName)
    );

    const source = {} as CanvasImageSource;
    expect(normalizeDetailedImageSource(source, { width: 4000, height: 2000 })).toBe(
      "data:image/jpeg;base64,small"
    );
    expect(drawImage).toHaveBeenCalledWith(source, 0, 0, 2048, 1024);
  });

  it("reduces quality and dimensions until the data URL fits", () => {
    const drawImage = vi.fn();
    const oversized = `data:image/jpeg;base64,${"A".repeat(DETAILED_MAX_DATA_URL_CHARS)}`;
    const toDataURL = vi.fn()
      .mockReturnValueOnce(oversized)
      .mockReturnValueOnce(oversized)
      .mockReturnValueOnce(oversized)
      .mockReturnValueOnce(oversized)
      .mockReturnValueOnce(oversized)
      .mockReturnValue("data:image/jpeg;base64,small");
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    expect(normalizeDetailedImageSource({} as CanvasImageSource, { width: 3000, height: 1500 })).toBe(
      "data:image/jpeg;base64,small"
    );
    expect(drawImage).toHaveBeenNthCalledWith(1, expect.anything(), 0, 0, 2048, 1024);
    expect(drawImage).toHaveBeenNthCalledWith(2, expect.anything(), 0, 0, 1679, 840);
  });

  it("rejects SVG before attempting browser decode", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    await expect(normalizeFoodLabelImage(new Blob(["<svg/>"] , { type: "image/svg+xml" }))).resolves.toBeNull();
    expect(bitmap).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the native image decoder when createImageBitmap rejects HEIC", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported")));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:heic-fixture"),
      revokeObjectURL
    });
    class TestImage {
      width = 1600;
      height = 1200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", TestImage);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => "data:image/jpeg;base64,native-fallback"
    } as unknown as HTMLCanvasElement;
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    await expect(normalizeFoodLabelImage(new Blob(["heic"], { type: "image/heic" }))).resolves.toBe(
      "data:image/jpeg;base64,native-fallback"
    );
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:heic-fixture");
  });
});

describe("camera start cancellation", () => {
  function deferredStream() {
    let resolve: (stream: MediaStream) => void = () => undefined;
    const promise = new Promise<MediaStream>((next) => {
      resolve = next;
    });
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
      getVideoTracks: () => []
    } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(() => promise) }
    });
    return { promise, resolve, stop, stream };
  }

  it("stops a stream that resolves after an explicit stop", async () => {
    const pending = deferredStream();
    const { result } = renderHook(() => useFoodCamera());
    let startPromise = Promise.resolve();
    act(() => {
      startPromise = result.current.start();
    });
    act(() => result.current.stop());

    await act(async () => {
      pending.resolve(pending.stream);
      await startPromise;
    });

    expect(pending.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("stops a stream that resolves after unmount", async () => {
    const pending = deferredStream();
    const { result, unmount } = renderHook(() => useFoodCamera());
    let startPromise = Promise.resolve();
    act(() => {
      startPromise = result.current.start();
    });
    unmount();

    pending.resolve(pending.stream);
    await startPromise;

    expect(pending.stop).toHaveBeenCalledTimes(1);
  });
});

describe("manual camera capture", () => {
  it("does not draw a frame until grabFrame is called", async () => {
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toDataURL: () => "data:image/jpeg;base64,manual"
    } as unknown as HTMLCanvasElement;
    const originalCreate = document.createElement.bind(document);
    const createElement = vi.spyOn(document, "createElement").mockImplementation((tagName: string) =>
      tagName === "canvas" ? canvas : originalCreate(tagName)
    );
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => []
    } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(async () => stream) }
    });
    const video = {
      readyState: 4,
      videoWidth: 1280,
      videoHeight: 720,
      srcObject: null,
      play: vi.fn(async () => undefined)
    } as unknown as HTMLVideoElement;
    const { result } = renderHook(() => useFoodCamera());
    result.current.videoRef.current = video;

    await act(async () => result.current.start());

    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(drawImage).not.toHaveBeenCalled();
    expect(result.current.grabFrame()).toBe("data:image/jpeg;base64,manual");
    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});
