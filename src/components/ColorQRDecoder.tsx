import { useRef, useState } from "react";

type RGB = { r: number; g: number; b: number };
type Cell = RGB;

interface DecodeResult {
    markers: {
        topLeft: RGB;
        topRight: RGB;
        bottomLeft: RGB;
        bottomRight: RGB;
    };
    grid: Cell[][];
}

const CELL_SIZE = 10; // pixel size of each cell in your QR
const GRID_SIZE = 33; // change according to your format

export default function QRGridDecoder() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [result, setResult] = useState<DecodeResult | null>(null);

    const getPixel = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number
    ): RGB => {
        const d = ctx.getImageData(x, y, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2] };
    };

    const sampleCell = (
        ctx: CanvasRenderingContext2D,
        cellX: number,
        cellY: number
    ): RGB => {
        const px = cellX * CELL_SIZE + CELL_SIZE / 2;
        const py = cellY * CELL_SIZE + CELL_SIZE / 2;
        return getPixel(ctx, px, py);
    };

    const loadImage = (file: File): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = URL.createObjectURL(file);
        });
    };

    const decode = async (file: File) => {
        const img = await loadImage(file);
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        // --- MARKER POSITIONS (using 5 cells with 50% edges as you said) ---
        const markers = {
            topLeft: sampleCell(ctx, 2, 2),
            topRight: sampleCell(ctx, GRID_SIZE - 3, 2),
            bottomLeft: sampleCell(ctx, 2, GRID_SIZE - 3),
            bottomRight: sampleCell(ctx, GRID_SIZE - 3, GRID_SIZE - 3),
        };

        // --- NORMAL GRID SAMPLING ---
        const grid: Cell[][] = [];

        for (let y = 0; y < GRID_SIZE; y++) {
            const row: Cell[] = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                row.push(sampleCell(ctx, x, y));
            }
            grid.push(row);
        }

        setResult({ markers, grid });
    };

    return (
        <div className="p-4">
            <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) decode(file);
                }}
            />

            <canvas ref={canvasRef} style={{ display: "none" }} />

            {result && (
                <pre style={{ marginTop: 20, background: "#eee", padding: 10 }}>
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    );
}
