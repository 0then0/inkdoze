/** The subset of libheif-js (embind bindings of libheif) that the HEIC worker uses. */
declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  /** Enum values are embind objects with a numeric `value`. */
  type Enum = unknown;

  export interface LibHeifError {
    code: Enum;
    subcode?: Enum;
    message?: string;
  }

  export interface LibHeifChannel {
    id: Enum;
    width: number;
    height: number;
    stride: number;
    data: Uint8Array;
  }

  export interface LibHeifDecoded {
    image: unknown;
    channels: LibHeifChannel[];
  }

  type Context = object;
  type Handle = object;

  export interface LibHeif {
    heif_get_version(): string;
    heif_context_alloc(): Context | null;
    heif_context_free(ctx: Context): void;
    heif_context_read_from_memory(ctx: Context, data: Uint8Array): LibHeifError;
    heif_js_context_get_primary_image_handle(ctx: Context): Handle | LibHeifError | null;
    heif_image_handle_get_width(handle: Handle): number;
    heif_image_handle_get_height(handle: Handle): number;
    heif_image_handle_release(handle: Handle): void;
    heif_js_decode_image2(handle: Handle, colorspace: Enum, chroma: Enum): LibHeifDecoded | LibHeifError | null;
    heif_image_release(image: unknown): void;
    heif_colorspace: { heif_colorspace_RGB: Enum };
    heif_chroma: { heif_chroma_interleaved_RGBA: Enum };
    heif_channel: { heif_channel_interleaved: Enum };
  }

  const factory: (options?: Record<string, unknown>) => LibHeif | Promise<LibHeif>;
  export default factory;
}
