import { useRef, useState } from "react";
import { imageToRGBGrid } from "../encoders/utils";

export default function QRExtractor() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageURL, setImageURL] = useState<string | null>(null);

  // Crop UI state
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);

  const [croppedURL, setCroppedURL] = useState<string | null>(null);

  // Upload handler
  const loadImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    const data = await imageToRGBGrid(url);
    console.log(data)
    setImageURL(url);
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLImageElement).getBoundingClientRect();
    e.preventDefault();
    setStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setEnd(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!start) return;
    const rect = (e.target as HTMLImageElement).getBoundingClientRect();
    setEnd({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseUp = () => {
    if (!start || !end) return;
    cropImage();
  };

  // Crop + color correct
  const cropImage = () => {
    if (!start || !end || !imgRef.current || !canvasRef.current) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(start.x - end.x);
    const h = Math.abs(start.y - end.y);

    canvas.width = w;
    canvas.height = h;

    // draw crop
    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

    // COLOR CORRECTION
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;

    // Simple normalize to boost contrast
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];

      // normalize brightness
      const avg = (r + g + b) / 3;

      // optional: push extremes to black/white
      if (avg > 150) {
        px[i] = px[i + 1] = px[i + 2] = 255;
      } else {
        px[i] = px[i + 1] = px[i + 2] = 0;
      }
    }

    ctx.putImageData(data, 0, 0);

    // export
    const finalURL = canvas.toDataURL("image/png");
    setCroppedURL(finalURL);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>QR Extractor</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadImage(f);
        }}
      />

      {/* original image */}
      {imageURL && (
        <div style={{ position: "relative", marginTop: 20 }}>
          <img
            src={imageURL}
            ref={imgRef}
            style={{
              maxWidth: "100%",
              border: "1px solid #aaa",
              cursor: "crosshair"
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />

          {/* draw live selection box */}
          {start && end && (
            <div
              style={{
                position: "absolute",
                pointerEvents: "none",
                border: "2px dashed red",
                left: Math.min(start.x, end.x),
                top: Math.min(start.y, end.y),
                width: Math.abs(start.x - end.x),
                height: Math.abs(start.y - end.y)
              }}
            />
          )}
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* cropped output */}
      {croppedURL && (
        <div style={{ marginTop: 20 }}>
          <h2>Cropped + Corrected QR</h2>
          <img
            src={croppedURL}
            style={{ border: "2px solid black", maxWidth: 300 }}
          />
        </div>
      )}
    </div>
  );
}
