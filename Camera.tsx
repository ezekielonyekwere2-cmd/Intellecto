import React, { useRef, useEffect, useState } from 'react';
import { CloseIcon, SwitchCameraIcon } from './icons/Icons';

interface CameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const Camera: React.FC<CameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check for multiple cameras on mount
  useEffect(() => {
    const checkCameras = async () => {
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            setHasMultipleCameras(videoInputs.length > 1);
        } catch(err) {
            console.error("Could not enumerate devices:", err);
        }
      }
    };
    checkCameras();
  }, []);

  // Effect to handle camera stream when facingMode changes
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        const constraints = { video: { facingMode } };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError(null);
      } catch (err) {
        console.error(`Error accessing ${facingMode} camera:`, err);
        setError("Could not access the camera. Please check your browser permissions.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        }
      }, 'image/jpeg');
    }
  };

  const switchCamera = () => {
    setFacingMode(prevMode => (prevMode === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div className="relative bg-gray-900 p-4 rounded-lg shadow-xl w-full max-w-2xl">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto rounded-md"></video>
        <canvas ref={canvasRef} className="hidden"></canvas>
        {error && <p className="text-red-400 text-center mt-2">{error}</p>}
        <div className="flex justify-center items-center mt-4 h-16">
           {hasMultipleCameras && (
            <button
                onClick={switchCamera}
                className="absolute left-4 bottom-4 text-white bg-gray-800 bg-opacity-50 rounded-full p-3 hover:bg-gray-700 transition-colors"
                aria-label="Switch camera"
            >
                <SwitchCameraIcon />
            </button>
           )}
          <button
            onClick={handleCapture}
            disabled={!!error}
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-400 hover:border-gray-200 focus:outline-none disabled:opacity-50 transition-colors"
            aria-label="Capture photo"
          ></button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700"
          aria-label="Close camera"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default Camera;