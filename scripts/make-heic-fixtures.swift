// Generates the HEIC test fixtures with Apple's ImageIO encoder, the same encoder
// family that writes iPhone photos (tiled `grid` items, `irot` plus EXIF orientation).
// The images are synthetic, so the fixtures can be redistributed with the project.
//
// macOS only:  swift scripts/make-heic-fixtures.swift tests/fixtures
import CoreGraphics
import Foundation
import ImageIO

typealias RGB = (UInt8, UInt8, UInt8)

let red: RGB = (230, 30, 30)
let green: RGB = (30, 200, 60)
let blue: RGB = (30, 60, 220)
let yellow: RGB = (240, 220, 40)
let black: RGB = (0, 0, 0)
let swatches: [RGB] = [
  black, (12, 12, 12), (128, 128, 128), (255, 255, 255),
  (188, 67, 72), (95, 173, 101), (79, 110, 198), (205, 141, 61),
  (240, 50, 28), (36, 205, 46), (240, 21, 156), (58, 221, 231),
]

func swatchPixel(_ x: Int, _ y: Int, _ w: Int, _ h: Int) -> RGB {
  swatches[(y * 3 / h) * 4 + x * 4 / w]
}

/// Pixel colour in display orientation: four coloured quadrants and a black "F" in the
/// middle. Any rotation or mirroring moves the quadrants or flips the glyph.
func portraitPixel(_ x: Int, _ y: Int, _ w: Int, _ h: Int) -> RGB {
  let u = Double(x) / Double(w), v = Double(y) / Double(h)
  // "F": vertical bar and two horizontal bars, open to the right.
  let inStem = u >= 0.38 && u < 0.46 && v >= 0.32 && v < 0.68
  let inTop = u >= 0.38 && u < 0.64 && v >= 0.32 && v < 0.38
  let inMid = u >= 0.38 && u < 0.58 && v >= 0.47 && v < 0.53
  if inStem || inTop || inMid { return black }
  if v < 0.5 { return u < 0.5 ? red : green }
  return u < 0.5 ? blue : yellow
}

/// For EXIF orientation 6, store the display image rotated 90° counter-clockwise.
func storedImage(displayWidth w: Int, displayHeight h: Int, space: CFString = CGColorSpace.sRGB,
                 orientation: Int = 6, pixel: (Int, Int, Int, Int) -> RGB) -> CGImage {
  let rotated = orientation == 6
  let sw = rotated ? h : w, sh = rotated ? w : h
  var bytes = [UInt8](repeating: 255, count: sw * sh * 4)
  for dy in 0..<h {
    for dx in 0..<w {
      let (r, g, b) = pixel(dx, dy, w, h)
      // Orientation 6 displays the stored image rotated 90° clockwise, so display
      // (dx, dy) comes from stored (dy, w - 1 - dx).
      let sx = rotated ? dy : dx, sy = rotated ? w - 1 - dx : dy
      let o = (sy * sw + sx) * 4
      bytes[o] = r; bytes[o + 1] = g; bytes[o + 2] = b
    }
  }
  let provider = CGDataProvider(data: Data(bytes) as CFData)!
  return CGImage(
    width: sw, height: sh, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: sw * 4,
    space: CGColorSpace(name: space)!,
    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
    provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
}

func writeHeic(_ image: CGImage, orientation: Int, quality: Double, to url: URL) {
  let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.heic" as CFString, 1, nil)!
  let props: [CFString: Any] = [
    kCGImagePropertyOrientation: orientation,
    kCGImageDestinationLossyCompressionQuality: quality,
    kCGImagePropertyExifDictionary: [kCGImagePropertyExifUserComment: "InkDoze test fixture"],
  ]
  CGImageDestinationAddImage(dest, image, props as CFDictionary)
  guard CGImageDestinationFinalize(dest) else { fatalError("could not write \(url.path)") }
  let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
  print("\(url.lastPathComponent): \(image.width)x\(image.height) stored, orientation \(orientation), \(size) bytes")
}

let out = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ".")
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

// Portrait photo with the iPhone layout: 3024×4032 displayed, 4032×3024 stored as a grid.
writeHeic(storedImage(displayWidth: 3024, displayHeight: 4032, pixel: portraitPixel),
          orientation: 6, quality: 0.5, to: out.appendingPathComponent("portrait-iphone-layout.heic"))
// Small portrait photo for fast end-to-end tests.
writeHeic(storedImage(displayWidth: 600, displayHeight: 800, pixel: portraitPixel),
          orientation: 6, quality: 0.8, to: out.appendingPathComponent("portrait-small.heic"))
// Capability probe embedded in the worker: 16×32 displayed, top half red, bottom half blue.
writeHeic(storedImage(displayWidth: 16, displayHeight: 32) { _, y, _, h in y < h / 2 ? red : blue },
          orientation: 6, quality: 0.9, to: out.appendingPathComponent("probe.heic"))

// Matching patch values in two RGB spaces, plus a four-tile P3 grid with stored rotation.
writeHeic(storedImage(displayWidth: 128, displayHeight: 96, space: CGColorSpace.displayP3, orientation: 1, pixel: swatchPixel),
          orientation: 1, quality: 1, to: out.appendingPathComponent("display-p3-swatches.heic"))
writeHeic(storedImage(displayWidth: 128, displayHeight: 96, orientation: 1, pixel: swatchPixel),
          orientation: 1, quality: 1, to: out.appendingPathComponent("srgb-swatches.heic"))
writeHeic(storedImage(displayWidth: 1024, displayHeight: 768, space: CGColorSpace.displayP3, pixel: swatchPixel),
          orientation: 6, quality: 1, to: out.appendingPathComponent("display-p3-grid.heic"))
