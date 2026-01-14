import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

export function AudioVisualizer({
  analyserNode,
  isPlaying,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Purple gradient colors to match vocab highlight theme
    const purpleLight = 'rgba(192, 132, 252, 0.9)'; // purple-400
    const purpleDark = 'rgba(139, 92, 246, 0.6)';   // violet-500

    // Number of bars to display across the full width
    const barCount = 64;

    const draw = () => {
      // Always request next frame to keep animation loop alive
      animationFrameRef.current = requestAnimationFrame(draw);

      // Get canvas dimensions from its display size
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Set canvas internal resolution to match display size
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (!isPlaying) {
        return;
      }

      analyserNode.getByteFrequencyData(dataArray);

      // Only use the lower frequencies where music energy is concentrated
      // Use first 1/4 of the frequency bins (most music content is here)
      const usableBins = Math.floor(bufferLength / 4);
      const binsPerBar = Math.max(1, Math.floor(usableBins / barCount));

      // Calculate bar width to span full screen width
      const barWidth = width / barCount;

      const points: { x: number; y: number }[] = [];

      for (let i = 0; i < barCount; i++) {
        // Average the frequency data for this bar
        let sum = 0;
        for (let j = 0; j < binsPerBar; j++) {
          const index = i * binsPerBar + j;
          if (index < bufferLength) {
            sum += dataArray[index];
          }
        }
        const average = sum / binsPerBar;

        const v = average / 255;
        // Use exponential scaling for more dynamic response
        const scaledV = Math.pow(v, 0.7);
        const barHeight = scaledV * height * 0.75;
        const y = height - barHeight;
        const x = i * barWidth + barWidth / 2;

        points.push({ x, y });
      }

      // Draw filled waveform from bottom
      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          const cpX = (current.x + next.x) / 2;
          ctx.quadraticCurveTo(current.x, current.y, cpX, (current.y + next.y) / 2);
        }

        // Final point - extend to right edge
        const lastPoint = points[points.length - 1];
        ctx.lineTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(width, lastPoint.y);
        ctx.lineTo(width, height);
        ctx.closePath();

        // Fill with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, purpleLight);
        gradient.addColorStop(1, purpleDark);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Add a glowing top line
        ctx.beginPath();
        ctx.moveTo(0, points[0].y);

        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          const cpX = (current.x + next.x) / 2;
          ctx.quadraticCurveTo(current.x, current.y, cpX, (current.y + next.y) / 2);
        }

        const last = points[points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineTo(width, last.y);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    // Start animation loop
    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
