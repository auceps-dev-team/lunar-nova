'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageEditor } from './ImageEditor';
import { UploadCloud, Image as ImageIcon, Wand2 } from 'lucide-react';

export type ImageFile = {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  name: string;
};

export function ImageWorkspace() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Limit to 20 images total
    const newFiles = acceptedFiles.slice(0, 20 - images.length);
    
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newImage: ImageFile = {
          id: Math.random().toString(36).substring(7),
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType: file.type,
          name: file.name,
        };
        setImages((prev) => [...prev, newImage]);
      };
      reader.readAsDataURL(file);
    });
  }, [images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/svg+xml': ['.svg'],
    },
    maxFiles: 20,
  });

  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar Gallery */}
      <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-900/30 z-10 shadow-xl">
        <div className="p-4 border-b border-zinc-800/50">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
              isDragActive 
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className={`w-8 h-8 mx-auto mb-3 transition-colors ${isDragActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
            <p className="text-sm font-medium text-zinc-300">Drop images here</p>
            <p className="text-xs text-zinc-500 mt-1">PNG, JPG, SVG (Max 20)</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Gallery ({images.length}/20)</h2>
          </div>
          
          {images.map((img) => (
            <div
              key={img.id}
              onClick={() => setSelectedImageId(img.id)}
              className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 group ${
                selectedImageId === img.id 
                  ? 'border-indigo-500 ring-4 ring-indigo-500/20' 
                  : 'border-transparent hover:border-zinc-600'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <div className="absolute inset-x-0 bottom-0 p-2 text-xs font-medium text-white truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {img.name}
              </div>
            </div>
          ))}
          
          {images.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-3">
                <ImageIcon className="w-6 h-6 text-zinc-500" />
              </div>
              <p className="text-sm font-medium text-zinc-400">No images uploaded</p>
              <p className="text-xs text-zinc-500 mt-1">Upload images to start editing</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
        {selectedImage ? (
          <ImageEditor 
            image={selectedImage} 
            onUpdateImage={(updatedImage) => {
              setImages((prev) => prev.map((img) => img.id === updatedImage.id ? updatedImage : img));
            }}
            onRemove={() => {
              setImages((prev) => prev.filter((img) => img.id !== selectedImage.id));
              setSelectedImageId(null);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-20 h-20 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-zinc-800/50">
                <Wand2 className="w-10 h-10 text-zinc-600" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-200 mb-2">Select an image to edit</h2>
              <p className="text-sm text-zinc-500">
                Choose an image from the gallery on the left to remove watermarks, view EXIF data, or enhance quality using AI.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
