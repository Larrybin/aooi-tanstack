export function buildBinaryMaskPixels(
  sourcePixels: Uint8ClampedArray
): Uint8ClampedArray {
  const maskPixels = new Uint8ClampedArray(sourcePixels.length);

  for (let index = 0; index < sourcePixels.length; index += 4) {
    const value = sourcePixels[index + 3] > 0 ? 255 : 0;
    maskPixels[index] = value;
    maskPixels[index + 1] = value;
    maskPixels[index + 2] = value;
    maskPixels[index + 3] = 255;
  }

  return maskPixels;
}
