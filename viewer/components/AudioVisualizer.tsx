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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !analyserNode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    updateCanvasSize();

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Purple gradient colors to match vocab highlight theme
    const purpleLight = 'rgba(192, 132, 252, 0.9)'; // purple-400
    const purpleDark = 'rgba(139, 92, 246, 0.6)';   // violet-500

    const draw = () => {
      if (!isPlaying) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);

      analyserNode.getByteFrequencyData(dataArray);

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Create a smooth waveform visualization that spans full width
      const sliceWidth = width / bufferLength;

      // Draw filled waveform from bottom
      ctx.beginPath();
      ctx.moveTo(0, height);

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255;
        // Use exponential scaling for more dynamic response
        const scaledV = Math.pow(v, 0.8);
        const y = height - (scaledV * height * 0.7);
        const x = i * sliceWidth;

        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          // Use quadratic curves for smoother waveform
          const prevX = (i - 1) * sliceWidth;
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(prevX, ctx.getLineDash.length > 0 ? y : y, cpX, y);
          ctx.lineTo(x, y);
        }
      }

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
      ctx.moveTo(0, height);

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 255;
        const scaledV = Math.pow(v, 0.8);
        const y = height - (scaledV * height * 0.7);
        const x = i * sliceWidth;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    if (isPlaying) {
      draw();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Handle resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [analyserNode, isPlaying]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
}
