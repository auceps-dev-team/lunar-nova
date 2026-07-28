import React, { useState, useEffect } from 'react';
import { Trash2, Download, Wand2, RefreshCw, Info, FileImage, Camera, Sparkles, AlertCircle, Undo2, Redo2, FileText, Eraser } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import piexif from 'piexifjs';
import { API_BASE_URL } from '../../config';


const ensureJpeg = (base64) => {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = reject;
        img.src = base64;
    });
};

const toSafeExifString = (str) => {
    try {
        return unescape(encodeURIComponent(str || ''));
    } catch {
        return str || '';
    }
};

export function ImageEditor({ image, onUpdateImage, onRemove }) {
    const [error, setError] = useState(null);

    // Tab states
    const [activeTab, setActiveTab] = useState('ai');       // 'ai' | 'exif' | 'metadata'
    const [isProcessing, setIsProcessing] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');

    const { t } = useTranslation();

    // Image editing always uses Gemini (image-to-image)

    // Undo/Redo State
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Initialize history when a new image is selected
    useEffect(() => {
        setHistory([image]);
        setHistoryIndex(0);
        
        return () => {
            // Cleanup blob URLs from history when component unmounts or image changes
            history.forEach(histImg => {
                // Don't revoke the initial image URL as it might be used by the workspace
                if (histImg.id !== image.id && histImg.previewUrl && histImg.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(histImg.previewUrl);
                }
            });
        };
    }, [image.id]);

    const pushToHistory = (newImage) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newImage);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onUpdateImage(newImage);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            onUpdateImage(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            onUpdateImage(history[newIndex]);
        }
    };

    // EXIF State
    const [exifData, setExifData] = useState(null);
    const [allMetadata, setAllMetadata] = useState([]);
    const [exifForm, setExifForm] = useState({
        artist: '',
        copyright: '',
        software: '',
        dateTime: '',
        make: '',
        model: '',
        description: '',
    });

    useEffect(() => {
        setError(null);

        // Always extract basic metadata
        const basicMetadata = [
            { key: t('fileName'), value: image.name },
            { key: t('fileSize'), value: image.file ? `${(image.file.size / 1024).toFixed(2)} kB` : '—' },
            { key: t('fileType'), value: image.mimeType.split('/')[1].toUpperCase() },
            { key: t('mimeType'), value: image.mimeType },
        ];

        if (image.mimeType === 'image/jpeg' || image.mimeType === 'image/jpg') {
            let exifObj;
            try {
                let jpegData = image.base64;
                if (jpegData.startsWith('data:')) {
                    jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
                }
                exifObj = piexif.load(jpegData);
            } catch {
                console.debug('Non-JPEG file — EXIF not applicable, initializing empty EXIF');
                exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'Interop': {} };
            }

            setExifData(exifObj);
            setExifForm({
                artist: exifObj['0th']?.[piexif.ImageIFD.Artist] || '',
                copyright: exifObj['0th']?.[piexif.ImageIFD.Copyright] || '',
                software: exifObj['0th']?.[piexif.ImageIFD.Software] || '',
                dateTime: exifObj['0th']?.[piexif.ImageIFD.DateTime] || '',
                make: exifObj['0th']?.[piexif.ImageIFD.Make] || '',
                model: exifObj['0th']?.[piexif.ImageIFD.Model] || '',
                description: exifObj['0th']?.[piexif.ImageIFD.ImageDescription] || '',
            });

            // Extract all EXIF data for the table
            const extractedMetadata = [];
            const exifObjAny = exifObj;
            for (const ifd in exifObjAny) {
                if (ifd === 'thumbnail') continue;
                for (const tag in exifObjAny[ifd]) {
                    const tagId = parseInt(tag);
                    const tagName = piexif.TAGS[ifd]?.[tagId]?.name || `Unknown Tag (${tag})`;
                    let value = exifObjAny[ifd][tag];

                    if (typeof value === 'string') {
                        value = value.replace(/\0/g, '');
                    } else if (Array.isArray(value)) {
                        if (value.length > 10) {
                            value = `[Array of ${value.length} items]`;
                        } else {
                            value = value.map(v => {
                                if (Array.isArray(v) && v.length === 2) {
                                    return `${v[0]}/${v[1]}`;
                                }
                                return v;
                            }).join(', ');
                        }
                    } else if (typeof value === 'object') {
                        value = JSON.stringify(value);
                    }

                    extractedMetadata.push({ key: tagName, value: String(value) });
                }
            }
            setAllMetadata([...basicMetadata, ...extractedMetadata]);
        } else {
            setExifData(null);
            setAllMetadata(basicMetadata);
        }
    }, [image, t]);

    const handleAIEdit = async (prompt) => {
        setIsProcessing(true);
        setError(null);
        try {
            // Connect to our local Express backend instead of Next.js lib
            const genBody = {
                prompt: prompt,
                editMode: true,
                imageParams: {
                    data: image.base64.split(',')[1],
                    mimeType: image.mimeType
                },
                mode: 'product',
                // Gemini gère exclusivement l'édition d'image (image-to-image)
                provider: 'gemini',
            };

            const resProxy = await fetch(API_BASE_URL + '/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(genBody)
            });

            const genData = await resProxy.json();

            if (genData.status === 'success' && genData.imageStore) {
                let newBase64 = genData.imageStore.startsWith('data:')
                    ? genData.imageStore
                    : `data:image/jpeg;base64,${genData.imageStore}`;

                const actualMimeType = newBase64.substring(5, newBase64.indexOf(';'));

                // If original was JPEG, try to keep it JPEG and restore EXIF
                if (image.mimeType === 'image/jpeg' || image.mimeType === 'image/jpg') {
                    if (actualMimeType !== 'image/jpeg') {
                        newBase64 = await ensureJpeg(newBase64);
                    }
                    if (exifData) {
                        try {
                            const exifBytes = piexif.dump(exifData);
                            newBase64 = piexif.insert(exifBytes, newBase64);
                        } catch (e) {
                            console.warn('Failed to restore EXIF after AI edit', e);
                        }
                    }
                }

                const resImg = await fetch(newBase64);
                const blob = await resImg.blob();
                const finalMimeType = newBase64.substring(5, newBase64.indexOf(';'));
                const newFile = new File([blob], image.name, { type: finalMimeType });

                const newImage = {
                    ...image,
                    mimeType: finalMimeType,
                    file: newFile,
                    previewUrl: URL.createObjectURL(newFile),
                    base64: newBase64,
                };
                pushToHistory(newImage);
            } else {
                setError('Failed to edit image. No image returned.');
            }
        } catch (e) {
            console.error('AI Edit failed', e);
            setError(e.message || 'Failed to edit image. Check console for details.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveExif = async () => {
        if (!exifData || (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/jpg')) return;

        try {
            const newExifObj = { ...exifData };
            if (!newExifObj['0th']) newExifObj['0th'] = {};

            if (exifForm.artist) newExifObj['0th'][piexif.ImageIFD.Artist] = toSafeExifString(exifForm.artist);
            else delete newExifObj['0th'][piexif.ImageIFD.Artist];

            if (exifForm.copyright) newExifObj['0th'][piexif.ImageIFD.Copyright] = toSafeExifString(exifForm.copyright);
            else delete newExifObj['0th'][piexif.ImageIFD.Copyright];

            if (exifForm.software) newExifObj['0th'][piexif.ImageIFD.Software] = toSafeExifString(exifForm.software);
            else delete newExifObj['0th'][piexif.ImageIFD.Software];

            if (exifForm.dateTime) newExifObj['0th'][piexif.ImageIFD.DateTime] = toSafeExifString(exifForm.dateTime);
            else delete newExifObj['0th'][piexif.ImageIFD.DateTime];

            if (exifForm.make) newExifObj['0th'][piexif.ImageIFD.Make] = toSafeExifString(exifForm.make);
            else delete newExifObj['0th'][piexif.ImageIFD.Make];

            if (exifForm.model) newExifObj['0th'][piexif.ImageIFD.Model] = toSafeExifString(exifForm.model);
            else delete newExifObj['0th'][piexif.ImageIFD.Model];

            if (exifForm.description) newExifObj['0th'][piexif.ImageIFD.ImageDescription] = toSafeExifString(exifForm.description);
            else delete newExifObj['0th'][piexif.ImageIFD.ImageDescription];

            const exifBytes = piexif.dump(newExifObj);

            let jpegData = image.base64;
            if (jpegData.startsWith('data:')) {
                jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
            }

            try {
                piexif.insert(exifBytes, jpegData);
            } catch (e) {
                if (e.message === "Given data isn't JPEG.") {
                    jpegData = await ensureJpeg(image.base64);
                    if (jpegData.startsWith('data:')) {
                        jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
                    }
                } else {
                    throw e;
                }
            }

            const newBase64 = piexif.insert(exifBytes, jpegData);

            fetch(newBase64)
                .then(res => res.blob())
                .then(blob => {
                    const newFile = new File([blob], image.name, { type: image.mimeType });
                    const newImage = {
                        ...image,
                        file: newFile,
                        previewUrl: URL.createObjectURL(newFile),
                        base64: newBase64,
                    };
                    pushToHistory(newImage);
                });
        } catch (e) {
            console.error('Failed to save EXIF', e);
            setError(e.message || 'Failed to save EXIF data.');
        }
    };

    const handleRemoveAllMetadata = async () => {
        if (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/jpg') return;
        try {
            const emptyExif = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'Interop': {} };
            const exifBytes = piexif.dump(emptyExif);

            let jpegData = image.base64;
            if (jpegData.startsWith('data:')) {
                jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
            }

            try {
                piexif.insert(exifBytes, jpegData);
            } catch (e) {
                if (e.message === "Given data isn't JPEG.") {
                    jpegData = await ensureJpeg(image.base64);
                    if (jpegData.startsWith('data:')) {
                        jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
                    }
                } else {
                    throw e;
                }
            }

            const newBase64 = piexif.insert(exifBytes, jpegData);

            fetch(newBase64)
                .then(res => res.blob())
                .then(blob => {
                    const newFile = new File([blob], image.name, { type: image.mimeType });
                    const newImage = {
                        ...image,
                        file: newFile,
                        previewUrl: URL.createObjectURL(newFile),
                        base64: newBase64,
                    };
                    pushToHistory(newImage);
                });
        } catch (e) {
            console.error('Failed to remove metadata', e);
            setError(e.message || 'Failed to remove metadata.');
        }
    };

    const handleQuickDescription = async () => {
        if (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/jpg') {
            setError(t('exifEditingOnlyJpeg'));
            return;
        }

        setIsProcessing(true);
        setError(null);
        try {
            // Connect to our local Express backend agent for image description
            const agentRes = await fetch(API_BASE_URL + '/api/ai/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    persona: 'creative',
                    promptFormat: 'json',
                    message: 'Analyze this image and return a JSON object with exactly two keys: "title" (a concise 3-4 word title) and "description" (a detailed description).',
                    imageParams: {
                        data: image.base64.split(',')[1],
                        mimeType: image.mimeType
                    }
                })
            });
            const agentData = await agentRes.json();

            let title = "Described Image";
            let description = "Description not available.";

            if (agentData.status === 'success' && agentData.response) {
                try {
                    const parsed = typeof agentData.response === 'string'
                        ? JSON.parse(agentData.response)
                        : agentData.response;
                    title = parsed.title || title;
                    description = parsed.description || agentData.response;
                } catch {
                    description = agentData.response;
                }
            }

            const combinedDescription = `${title}\n\n${description}`;

            // Update EXIF
            const newExifObj = exifData ? { ...exifData } : { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {}, 'Interop': {} };
            if (!newExifObj['0th']) newExifObj['0th'] = {};

            newExifObj['0th'][piexif.ImageIFD.ImageDescription] = toSafeExifString(combinedDescription);

            const exifBytes = piexif.dump(newExifObj);

            let jpegData = image.base64;
            if (jpegData.startsWith('data:')) {
                jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
            }

            try {
                piexif.insert(exifBytes, jpegData);
            } catch (e) {
                if (e.message === "Given data isn't JPEG.") {
                    jpegData = await ensureJpeg(image.base64);
                    if (jpegData.startsWith('data:')) {
                        jpegData = 'data:image/jpeg;base64,' + jpegData.split(',')[1];
                    }
                } else {
                    throw e;
                }
            }

            const newBase64 = piexif.insert(exifBytes, jpegData);

            const res = await fetch(newBase64);
            const blob = await res.blob();
            const newFile = new File([blob], image.name, { type: image.mimeType });

            const newImage = {
                ...image,
                file: newFile,
                previewUrl: URL.createObjectURL(newFile),
                base64: newBase64,
            };

            pushToHistory(newImage);

            // Switch to EXIF tab to show the result
            setActiveTab('exif');

        } catch (e) {
            console.error('Quick description failed', e);
            setError(e.message || 'Failed to generate description.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = image.base64;
        a.download = `edited_${image.name}`;
        a.click();
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
            {/* Toolbar */}
            <div className="h-16 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10">
                <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                        <FileImage className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate max-w-[300px]">{image.name}</h2>
                        <div className="flex items-center text-xs text-gray-500 dark:text-zinc-500 mt-0.5 space-x-2">
                            <span className="uppercase tracking-wider font-semibold text-gray-600 dark:text-zinc-400">{image.mimeType.split('/')[1]}</span>
                            <span>•</span>
                            <span>{image.file ? (image.file.size / 1024 / 1024).toFixed(2) + ' MB' : '—'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 mr-2">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={t('undo')}
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={t('redo')}
                        >
                            <Redo2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-1"></div>
                    <button
                        onClick={handleDownload}
                        className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-medium rounded-lg dark:text-zinc-200 transition-colors shadow-sm border border-gray-200 dark:border-zinc-700/50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {t('download')}
                    </button>
                    <div className="w-px h-6 bg-gray-200 dark:bg-zinc-800 mx-1"></div>
                    <button
                        onClick={onRemove}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title={t('removeImage')}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Image Preview */}
                <div className="flex-1 p-8 flex items-center justify-center bg-gray-100/50 dark:bg-zinc-950/80 relative overflow-hidden">
                    {/* Subtle grid background */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHYxSDB6TTAgMHY0MGgxdi00MHoiIGZpbGw9InJnYmEoMTIzLDEyMywxMjMsMC4wMykiLz4KPC9zdmc+')] dark:bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMGg0MHYxSDB6TTAgMHY0MGgxdi00MHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz4KPC9zdmc+')] opacity-50"></div>

                    <div className="relative z-10 max-w-full max-h-full flex items-center justify-center">
                        <img
                            src={image.previewUrl}
                            alt={image.name}
                            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
                        />
                    </div>

                    {isProcessing && (
                        <div className="absolute inset-0 z-20 bg-white/60 dark:bg-zinc-950/60 flex items-center justify-center backdrop-blur-md transition-all duration-300">
                            <div className="flex flex-col items-center space-y-5 p-8 bg-white/90 dark:bg-zinc-900/80 rounded-2xl border border-gray-200 dark:border-zinc-800/50 shadow-2xl">
                                <div className="relative flex items-center justify-center">
                                    <div className="w-16 h-16 border-4 border-[#0b9f84]/20 border-t-[#0b9f84] rounded-full animate-spin"></div>
                                    <Sparkles className="w-6 h-6 text-[#0b9f84] absolute animate-pulse pointer-events-none" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-200">{t('processing')}</h3>
                                    <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">{t('processingDesc')}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tools Panel */}
                <div className="w-80 border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex flex-col shadow-2xl z-10">
                    <div className="flex p-2 border-b border-gray-200 dark:border-zinc-800/50">
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center ${activeTab === 'ai'
                                ? 'bg-gray-100 dark:bg-zinc-800 text-[#0b9f84] shadow-sm'
                                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                            {t('ai')}
                        </button>
                        <div className="w-1"></div>
                        <button
                            onClick={() => setActiveTab('exif')}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center ${activeTab === 'exif'
                                ? 'bg-gray-100 dark:bg-zinc-800 text-[#0b9f84] shadow-sm'
                                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <Camera className="w-3.5 h-3.5 mr-1.5" />
                            {t('exif')}
                        </button>
                        <div className="w-1"></div>
                        <button
                            onClick={() => setActiveTab('metadata')}
                            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 flex items-center justify-center ${activeTab === 'metadata'
                                ? 'bg-gray-100 dark:bg-zinc-800 text-[#0b9f84] shadow-sm'
                                : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                }`}
                        >
                            <Info className="w-3.5 h-3.5 mr-1.5" />
                            {t('allData')}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                        {error && (
                            <div className="mb-6 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start space-x-3">
                                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800 dark:text-red-300/90 leading-relaxed">{error}</p>
                            </div>
                        )}

                        {activeTab === 'ai' && (
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center">
                                        {t('actions')}
                                    </h3>
                                    {/* Model Info Badge */}
                                    <div className="mb-4 space-y-1">
                                        <label className="text-[10px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                                            {t('model') || 'Edit Model'}
                                        </label>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Google Gemini (Image-to-Image)</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2.5">
                                        <button
                                            onClick={handleQuickDescription}
                                            disabled={isProcessing || (image.mimeType !== 'image/jpeg' && image.mimeType !== 'image/jpg')}
                                            className="w-full py-3 px-4 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium text-gray-800 dark:text-zinc-200 rounded-xl transition-all duration-200 text-left disabled:opacity-50 border border-gray-200 dark:border-zinc-700/50 flex items-center group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center mr-3 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800 transition-colors border border-gray-100 dark:border-transparent">
                                                <FileText className="w-4 h-4 text-gray-400 dark:text-zinc-400 group-hover:text-[#0b9f84]" />
                                            </div>
                                            {t('description')}
                                        </button>
                                        <button
                                            onClick={() => handleAIEdit('Remove the background from this image. Make the background transparent or solid white.')}
                                            disabled={isProcessing}
                                            className="w-full py-3 px-4 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium text-gray-800 dark:text-zinc-200 rounded-xl transition-all duration-200 text-left disabled:opacity-50 border border-gray-200 dark:border-zinc-700/50 flex items-center group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center mr-3 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800 transition-colors border border-gray-100 dark:border-transparent">
                                                <Eraser className="w-4 h-4 text-gray-400 dark:text-zinc-400 group-hover:text-[#0b9f84]" />
                                            </div>
                                            {t('removeBg')}
                                        </button>

                                        <button
                                            onClick={() => handleAIEdit('Improve the image quality, enhance colors, sharpen details, and reduce noise.')}
                                            disabled={isProcessing}
                                            className="w-full py-3 px-4 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium text-gray-800 dark:text-zinc-200 rounded-xl transition-all duration-200 text-left disabled:opacity-50 border border-gray-200 dark:border-zinc-700/50 flex items-center group"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 flex items-center justify-center mr-3 group-hover:bg-gray-50 dark:group-hover:bg-zinc-800 transition-colors border border-gray-100 dark:border-transparent">
                                                <Sparkles className="w-4 h-4 text-gray-400 dark:text-zinc-400 group-hover:text-[#0b9f84]" />
                                            </div>
                                            {t('improveQuality')}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">{t('customEdit')}</h3>
                                    <div className="relative">
                                        <textarea
                                            value={customPrompt}
                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                            placeholder={t('editPlaceholder')}
                                            className="w-full h-28 bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-3.5 text-sm text-gray-800 dark:text-zinc-200 resize-none focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all placeholder:text-gray-400 dark:placeholder:text-zinc-600"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleAIEdit(customPrompt)}
                                        disabled={isProcessing || !customPrompt.trim()}
                                        className="w-full py-3 bg-[#0b9f84] hover:bg-[#088b73] text-white text-sm font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-[#0b9f84]/20"
                                    >
                                        {t('apply')}
                                    </button>
                                </div>

                                <div className="p-4 bg-[#0b9f84]/5 border border-[#0b9f84]/10 rounded-xl flex items-start space-x-3">
                                    <Info className="w-5 h-5 text-[#0b9f84] shrink-0" />
                                    <p className="text-xs text-[#0b9f84]/80 leading-relaxed">
                                        {t('poweredBy')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'exif' && (
                            <div className="space-y-6">
                                {image.mimeType === 'image/jpeg' || image.mimeType === 'image/jpg' ? (
                                    exifData ? (
                                        <div className="space-y-5">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifArtist')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.artist}
                                                    onChange={(e) => setExifForm({ ...exifForm, artist: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifCopyright')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.copyright}
                                                    onChange={(e) => setExifForm({ ...exifForm, copyright: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifSoftware')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.software}
                                                    onChange={(e) => setExifForm({ ...exifForm, software: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifDateTime')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.dateTime}
                                                    onChange={(e) => setExifForm({ ...exifForm, dateTime: e.target.value })}
                                                    placeholder={t('placeholderYyyyMmDd')}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifMake')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.make}
                                                    onChange={(e) => setExifForm({ ...exifForm, make: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifModel')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.model}
                                                    onChange={(e) => setExifForm({ ...exifForm, model: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 ml-1">{t('exifDesc')}</label>
                                                <input
                                                    type="text"
                                                    value={exifForm.description}
                                                    onChange={(e) => setExifForm({ ...exifForm, description: e.target.value })}
                                                    className="w-full bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-zinc-200 focus:outline-none focus:border-[#0b9f84] focus:ring-1 focus:ring-[#0b9f84] transition-all"
                                                />
                                            </div>
                                            <div className="pt-2">
                                                <button
                                                    onClick={handleSaveExif}
                                                    className="w-full py-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-800 dark:text-white text-sm font-semibold rounded-xl transition-all duration-200 border border-gray-200 dark:border-zinc-700/50"
                                                >
                                                    {t('saveExifData')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                                                <Camera className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
                                            </div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t('noExifDataFound')}</p>
                                            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{t('noExifMetadata')}</p>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                                            <AlertCircle className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{t('unsupportedFormat')}</p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{t('exifEditingOnlyJpeg')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'metadata' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2 pb-4 border-b border-gray-200 dark:border-zinc-800/50">
                                    <button onClick={() => setActiveTab('metadata')} className="px-2 py-2 bg-[#0b9f84]/10 text-[#0b9f84] border border-[#0b9f84]/20 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors text-center">
                                        {t('viewMetadata')}
                                    </button>
                                    <button onClick={handleRemoveAllMetadata} className="px-2 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors text-center">
                                        {t('deleteMetadata')}
                                    </button>
                                    <button onClick={() => setActiveTab('exif')} className="px-2 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors text-center">
                                        {t('editMetadata')}
                                    </button>
                                    <button className="px-2 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-500 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors opacity-50 cursor-not-allowed text-center" title={t('comingSoon')}>
                                        {t('compareMetadata')}
                                    </button>
                                    <button onClick={() => setActiveTab('exif')} className="px-2 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors text-center">
                                        {t('addMeta')}
                                    </button>
                                    <button className="px-2 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-500 text-[10px] uppercase tracking-wider font-semibold rounded-lg transition-colors opacity-50 cursor-not-allowed text-center" title={t('comingSoon')}>
                                        {t('copyMetadata')}
                                    </button>
                                </div>

                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                                        {t('allMetadata')}
                                    </h3>
                                    <span className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                                        {allMetadata.length} {t('items')}
                                    </span>
                                </div>

                                <div className="bg-gray-50 dark:bg-zinc-950/50 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                    <div className="max-h-[60vh] overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-100 dark:bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800">
                                                <tr>
                                                    <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-zinc-400 text-xs uppercase tracking-wider w-1/3">{t('property')}</th>
                                                    <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-zinc-400 text-xs uppercase tracking-wider">{t('value')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 dark:divide-zinc-800/50">
                                                {allMetadata.map((item, index) => (
                                                    <tr key={index} className="hover:bg-gray-100 dark:hover:bg-zinc-900/50 transition-colors">
                                                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-zinc-300 text-xs break-words align-top">
                                                            {item.key}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-500 text-xs break-words font-mono">
                                                            {item.value}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
