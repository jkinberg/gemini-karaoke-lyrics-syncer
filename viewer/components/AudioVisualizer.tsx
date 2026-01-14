import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  width?: number;
  height?: number;
}

export function AudioVisualizer({
  analyserNode,
  isPlaying,
  width = 400,
  height = 200,
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
    const gradientStart = 'rgba(168, 85, 247, 0.8)'; // purple-500
    const gradientEnd = 'rgba(139, 92, 246, 0.6)';   // violet-500

    const draw = () => {
      if (!isPlaying) {
        // Fade out when paused
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      // Clear canvas with transparency
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate bar dimensions
      const barCount = 32; // Number of bars to display
      const barWidth = canvas.width / barCount - 2;
      const barSpacing = 2;

      // Sample frequency data to reduce to barCount bars
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        // Average the frequency data for this bar
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const average = sum / step;

        // Calculate bar height (scale to canvas height)
        const barHeight = (average / 255) * canvas.height * 0.8;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(
          0,
          canvas.height - barHeight,
          0,
          canvas.height
        );
        gradient.addColorStop(0, gradientStart);
        gradient.addColorStop(1, gradientEnd);

        // Draw bar from bottom
        const x = i * (barWidth + barSpacing);
        const y = canvas.height - barHeight;

        // Rounded rectangle for smoother look
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    if (isPlaying) {
      draw();
    } else {
      // Clear canvas when not playing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying]);

  // Update canvas dimensions when size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
