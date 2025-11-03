import React, { useState, useCallback } from 'react';
import { combineImages, fileToBase64 } from '../services/geminiService';
import Spinner from './Spinner';
import { CloseIcon } from './icons/Icons';

const ImageEditor: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setGeneratedImage(null);
      
      newFiles.forEach(file => {
          // FIX: Cast file to Blob to resolve TypeScript error where the `file` argument was inferred as `unknown`.
          // `File` is a subtype of `Blob`, so this is a safe and correct cast.
          setSourceImages(prev => [...prev, URL.createObjectURL(file as Blob)]);
      });
      e.target.value = ''; // Allow selecting the same file again
    }
  }, []);
  
  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setSourceImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || uploadedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const imagePayloads = await Promise.all(
          uploadedFiles.map(file => 
              fileToBase64(file).then(base64 => ({ base64, mimeType: file.type }))
          )
      );
      
      const image = await combineImages(prompt, imagePayloads);
      setGeneratedImage(image);
    } catch (err: any) {
      let errorMessage = 'Failed to generate image. Please try again.';
      const errorString = err.toString();
      if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('quota')) {
          errorMessage = "It looks like the free tier quota for image generation has been exceeded. Please check your API key's plan and billing details.";
      } else if (errorString.includes('billing')) {
          errorMessage = "This feature may require a billed account. Please check your API key's plan and billing details.";
      }
      setError(errorMessage);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6 overflow-y-auto">
      <div className="p-4 bg-gray-900 border-b border-gray-700 mb-6 rounded-t-lg">
        <h2 className="text-xl font-bold">Image Studio</h2>
        <p className="text-sm text-gray-400">Upload one or more images and describe how you want to combine or edit them.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Left Side: Controls & Upload */}
        <div className="flex flex-col">
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="mb-4">
              <label htmlFor="image-upload" className="block text-gray-300 text-sm font-bold mb-2">
                Upload Image(s)
              </label>
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600 cursor-pointer"
                disabled={isLoading}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="edit-prompt" className="block text-gray-300 text-sm font-bold mb-2">
                Instruction
              </label>
              <textarea
                id="edit-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Combine these into a collage, place the cat in the car"
                className="w-full h-24 p-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isLoading || sourceImages.length === 0}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !prompt.trim() || sourceImages.length === 0}
              className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              {isLoading ? 'Generating...' : 'Generate Image'}
            </button>
          </form>
          {error && <p className="text-red-400 text-center">{error}</p>}
        </div>

        {/* Right Side: Image Display */}
        <div className="flex flex-col gap-4 min-h-[400px]">
            <div className="bg-gray-900 rounded-lg p-3 flex flex-col border border-gray-700 flex-1 min-h-0">
                <h3 className="text-sm font-semibold mb-2 text-gray-400 flex-shrink-0">Source Image(s)</h3>
                {sourceImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto pr-1">
                        {sourceImages.map((src, index) => (
                            <div key={`${src.substring(0, 20)}-${index}`} className="relative group aspect-square">
                                <img src={src} alt={`Source ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                                <button 
                                    onClick={() => handleRemoveImage(index)}
                                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                    aria-label="Remove image"
                                    disabled={isLoading}
                                >
                                    <CloseIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-center p-4">Upload one or more images to start</div>
                )}
            </div>
            <div className="bg-gray-900 rounded-lg p-3 flex flex-col items-center justify-center border border-gray-700 h-80 flex-shrink-0">
                <h3 className="text-sm font-semibold mb-2 text-gray-400 self-start">Generated Image</h3>
                 <div className="flex-1 flex items-center justify-center w-full h-full">
                    {isLoading ? (
                        <Spinner />
                    ) : generatedImage ? (
                        <img src={generatedImage} alt="Generated" className="max-w-full max-h-full object-contain rounded-md" />
                    ) : (
                        <div className="text-gray-500 text-center p-4">Your generated image will appear here</div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;