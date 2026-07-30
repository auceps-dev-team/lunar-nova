import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageEditor } from './ImageEditor';
import { UploadCloud, Image as ImageIcon, Wand2 } from 'lucide-react';
import useAppStore from '../../store';
import { useTranslation } from 'react-i18next';

export function ImageWorkspace() {
    const { t } = useTranslation();
    const [images, setImages] = useState([]);
    const [selectedImageId, setSelectedImageId] = useState(null);

    const pendingEditImage = useAppStore(state => state.pendingEditImage);
    const clearPendingEditImage = useAppStore(state => state.clearPendingEditImage);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            images.forEach(img => {
                if (img.previewUrl && img.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(img.previewUrl);
                }
            });
        };
    }, [images]);

    // Auto-load image passed from Product Photo / Photo Shoot
    useEffect(() => {
        if (pendingEditImage && pendingEditImage.data) {
            const id = Math.random().toString(36).substring(7);
            const newImage = {
                id,
                file: null,
                previewUrl: pendingEditImage.data,
                base64: pendingEditImage.data,
                mimeType: pendingEditImage.mimeType || 'image/jpeg',
                name: pendingEditImage.name || t('importedImageName'),
            };
            // Synchronisation d'un signal ponctuel venu d'une autre page (Studio
            // Photo, Génération d'images) vers l'état local. Le store joue ici le
            // rôle de système externe, ce qui est l'usage prévu d'un effet.
            //
            // Le rendu supplémentaire que la règle signale se produit une seule
            // fois par image transférée : au passage suivant, pendingEditImage
            // vaut null et la garde ci-dessus court-circuite l'effet.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setImages(prev => [newImage, ...prev]);
            setSelectedImageId(id);
            clearPendingEditImage();
        }
    }, [pendingEditImage, t, clearPendingEditImage]);

    const onDrop = useCallback((acceptedFiles) => {
        // Limit to 20 images total
        const newFiles = acceptedFiles.slice(0, 20 - images.length);

        newFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result;
                const newImage = {
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
        <div className="flex-1 flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm h-[calc(100vh-100px)]">
            {/* Sidebar Gallery */}
            <div className="w-72 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-slate-50 dark:bg-zinc-900/30 shadow-xl">
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800/50">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${isDragActive
                            ? 'border-primary bg-primary/10 scale-[1.02]'
                            : 'border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800/50'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <UploadCloud className={`w-8 h-8 mx-auto mb-3 transition-colors ${isDragActive ? 'text-primary' : 'text-gray-400 dark:text-zinc-400'}`} />
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t('dropImagesHere')}</p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{t('supportedFormatsMax')}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{t('gallery')} ({images.length}/20)</h2>
                    </div>

                    {images.map((img) => (
                        <div
                            key={img.id}
                            onClick={() => setSelectedImageId(img.id)}
                            className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 group ${selectedImageId === img.id
                                ? 'border-primary ring-4 ring-primary/20'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-zinc-600'
                                }`}
                        >
                            <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            <div className="absolute inset-x-0 bottom-0 p-2 text-xs font-medium text-white truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {img.name}
                            </div>
                        </div>
                    ))}

                    {images.length === 0 && (
                        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                                <ImageIcon className="w-6 h-6 text-gray-500 dark:text-zinc-500" />
                            </div>
                            <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">{t('noImagesUploaded')}</p>
                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{t('uploadImagesToStartEditing')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col bg-gray-100 dark:bg-zinc-950 relative overflow-hidden">
                {selectedImage ? (
                    <ImageEditor
                        image={selectedImage}
                        onUpdateImage={(updatedImage) => {
                            setImages((prev) => prev.map((img) => img.id === updatedImage.id ? updatedImage : img));
                        }}
                        onRemove={() => {
                            if (selectedImage.previewUrl && selectedImage.previewUrl.startsWith('blob:')) {
                                URL.revokeObjectURL(selectedImage.previewUrl);
                            }
                            setImages((prev) => prev.filter((img) => img.id !== selectedImage.id));
                            setSelectedImageId(null);
                        }}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md px-6">
                            <div className="w-20 h-20 bg-white dark:bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-gray-100 dark:border-zinc-800/50">
                                <Wand2 className="w-10 h-10 text-gray-400 dark:text-zinc-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-200 mb-2">{t('selectImageToEdit')}</h2>
                            <p className="text-sm text-gray-500 dark:text-zinc-500">
                                {t('chooseImageFromGalleryDesc')}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
