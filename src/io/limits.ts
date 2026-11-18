export const LIMITS = {
  /** Files accepted per batch. */
  maxFiles: 40,
  /** Raw file size before decoding. */
  maxFileBytes: 40 * 1024 * 1024,
  /** Decoded pixels per input image (width × height), checked from the header before decoding. */
  maxInputPixels: 40_000_000,
  /** Longest side of a decoded input image. */
  maxInputSide: 16_384,
  /** Longest side of an output image (custom and original targets). */
  maxOutputSide: 8192,
  /** Output pixels per image. */
  maxOutputPixels: 33_554_432,
  /** Concurrent decode/encode jobs. */
  concurrency: 2,
  /** Idle time after which the WebAssembly HEIC decoder is shut down to return its memory. */
  heicDecoderIdleMs: 60_000,
} as const;

/** True when an input image is above the pixel or side limits. `decodePixels` covers tiled HEIC grids. */
export function overInputLimits(width: number, height: number, decodePixels = width * height): boolean {
  return (
    width * height > LIMITS.maxInputPixels ||
    decodePixels > LIMITS.maxInputPixels ||
    Math.max(width, height) > LIMITS.maxInputSide
  );
}
