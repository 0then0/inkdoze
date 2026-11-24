// Display P3 and sRGB share this transfer curve and a D65 white point.
function linearValue(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

const linear = Float64Array.from({ length: 256 }, (_, byte) => linearValue(byte / 255));

function linearComponent(byte: number, alpha: number): number {
  // For associated RGB, undo the multiplication in encoded space. Compression
  // can leave a component above alpha, so clamp before linearizing.
  return alpha === 255 ? linear[byte]! : linearValue(Math.min(1, byte / alpha));
}

function srgbByte(v: number): number {
  // Component clipping is equivalent before or after the monotonic transfer curve.
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  const encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(255 * encoded);
}

/** Convert in place to straight sRGB RGBA for ImageData. */
export function displayP3ToSrgb(rgba: Uint8ClampedArray, premultiplied = false) {
  // CSS Color 4 sample matrices composed as XYZ_to_lin_sRGB × lin_P3_to_XYZ.
  // https://www.w3.org/TR/2026/CRD-css-color-4-20261123/#color-conversion-code
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = premultiplied ? rgba[i + 3]! : 255;
    if (alpha === 0) {
      rgba.fill(0, i, i + 3);
      continue;
    }
    const r = linearComponent(rgba[i]!, alpha);
    const g = linearComponent(rgba[i + 1]!, alpha);
    const b = linearComponent(rgba[i + 2]!, alpha);
    rgba[i] = srgbByte(1.2249401762805596 * r - 0.22494017628055993 * g);
    rgba[i + 1] = srgbByte(-0.04205695470968818 * r + 1.0420569547096883 * g);
    rgba[i + 2] = srgbByte(-0.019637554590334436 * r - 0.07863604555063189 * g + 1.0982736001409663 * b);
  }
}
