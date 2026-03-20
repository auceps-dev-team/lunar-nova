import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAppStore from '../../store';
import Papa from 'papaparse';

export default function ContactImport() {
    const navigate = useNavigate();
    const showAppNotification = useAppStore(state => state.showAppNotification);

    // 1: Upload, 2: Map, 3: Success
    const [step, setStep] = useState(1);
    const [fileName, setFileName] = useState('');
    const [fileData, setFileData] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Mapping state: CSV Header -> DB Field
    // Possible DB fields: name, phone, category (segment), location (optional but we map to segments in DB if we want to)
    const [mapping, setMapping] = useState({});

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data;
                const fields = results.meta.fields || [];

                if (data.length === 0) {
                    showAppNotification('The CSV file is empty.', 'error');
                    return;
                }

                setFileData(data);
                setHeaders(fields);

                // Set default mapping to 'none'
                const initialMap = {};
                fields.forEach(f => initialMap[f] = 'none');
                setMapping(initialMap);

                setStep(2); // Auto-advance to mapping
            },
            error: (err) => {
                console.error("CSV Parse Error: ", err);
                showAppNotification('Failed to read the file.', 'error');
            }
        });
    };

    const handleMappingChange = (header, value) => {
        setMapping(prev => ({
            ...prev,
            [header]: value
        }));
    };

    const confirmImport = async () => {
        setIsSaving(true);

        try {
            // Process rows
            const payload = fileData.map(row => {
                const contact = {
                    name: '',
                    phone: '',
                    email: '',
                    address: '',
                    segment_name: '',
                };

                // Map header data to standard fields based on user selection
                headers.forEach(header => {
                    const mappedTo = mapping[header];
                    if (mappedTo === 'name') contact.name = row[header] || '';
                    if (mappedTo === 'phone') contact.phone = row[header] || '';
                    if (mappedTo === 'email') contact.email = row[header] || '';
                    if (mappedTo === 'address') contact.address = row[header] || '';
                    if (mappedTo === 'segment') contact.segment_name = row[header] || '';
                    // If multiple columns map to same (e.g., location), could append, but screenshot only uses Catégorie
                });

                // Auto-format phone: If 10 digits and starts with 0, or just 10 digits without '+', 
                // clean it up and inject +225 exactly as asked.
                if (contact.phone) {
                    let cleaned = contact.phone.replace(/[^0-9+]/g, '');
                    // Example formatting based on Ivory Coast standard logic (+225)
                    // If the user's number doesn't start with +, let's add +225
                    if (!cleaned.startsWith('+')) {
                        cleaned = '+225' + cleaned;
                    }
                    contact.phone = cleaned;
                }

                return contact;
            });

            // Filter out totally empty rows post-mapping
            const validPayload = payload.filter(p => p.phone || p.name);

            if (validPayload.length === 0) {
                showAppNotification('No valid data mapped.', 'error');
                setIsSaving(false);
                return;
            }

            const res = await fetch('http://localhost:3000/api/wa/contacts/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacts: validPayload })
            });

            if (!res.ok) throw new Error('API rejection');

            showAppNotification(`${validPayload.length} contacts imported successfully!`, 'success');
            setStep(3); // Success page

        } catch (error) {
            console.error(error);
            showAppNotification('An error occurred during import.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <Link to="/wa/contacts" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm flex items-center gap-1 mb-2 transition-colors">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
                        Back to Contacts
                    </Link>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Importer votre fichier</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Sélectionnez un fichier contenant vos contacts à importer.</p>
                </div>
            </div>

            {step === 1 && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm p-8 text-center mt-6">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div className="mt-4 flex text-sm text-gray-600 dark:text-zinc-400 justify-center">
                        <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none"
                        >
                            <span>Upload a file</span>
                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileUpload} />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">
                        CSV files only (max 5MB)
                    </p>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    {/* Success Banner matching screenshot */}
                    <div className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 p-4 rounded-lg flex justify-between items-center">
                        <div>
                            <p className="text-green-800 dark:text-green-300 font-semibold mb-1">Votre fichier a été importé !</p>
                            <p className="text-green-600 dark:text-green-400 text-sm">{fileName}</p>
                        </div>
                        <button onClick={() => setStep(1)} className="text-gray-700 dark:text-gray-300 underline font-medium text-sm hover:text-gray-900">
                            Annuler
                        </button>
                    </div>

                    {/* Preview Table */}
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Prévisualiser les premières 10 lignes de votre fichier.</h3>
                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-x-auto shadow-sm">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300">
                                    <tr>
                                        {headers.map((h, i) => (
                                            <th key={i} className="px-4 py-3 border-b border-r border-gray-200 dark:border-zinc-700 font-semibold">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {fileData.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            {headers.map((h, colIdx) => (
                                                <td key={colIdx} className="px-4 py-3 border-r border-gray-100 dark:border-zinc-800 text-gray-700 dark:text-zinc-300">
                                                    {row[h]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mapping Form matching Screenshot 2 */}
                    <div className="space-y-4 pt-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Mappage des données</h3>

                        {headers.map((header, idx) => (
                            <div key={idx} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row md:items-start gap-4 shadow-sm">
                                <div className="w-48 shrink-0 break-all font-medium text-gray-700 dark:text-zinc-300">
                                    {header.toUpperCase()}
                                </div>
                                <div className="flex-1 text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                                    {/* Show first 3 distinct values for context */}
                                    {Array.from(new Set(fileData.slice(0, 5).map(r => r[header]))).filter(Boolean).slice(0, 3).map((v, i) => (
                                        <div key={i}>{v}</div>
                                    ))}
                                </div>
                                <div className="w-64 shrink-0 flex flex-col gap-2">
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
                                        value={mapping[header]}
                                        onChange={(e) => handleMappingChange(header, e.target.value)}
                                    >
                                        <option value="none">Ne pas importer</option>
                                        <option value="name">Nom / Name</option>
                                        <option value="phone">Numéro / Phone</option>
                                        <option value="email">Email</option>
                                        <option value="address">Adresse / Address</option>
                                        <option value="segment">Catégorie / Segment</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-6">
                        <button
                            onClick={confirmImport}
                            disabled={isSaving}
                            className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                        >
                            {isSaving ? 'Importation en cours...' : 'Confirmer votre fichier'}
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm p-12 text-center mt-6">
                    <svg className="mx-auto h-16 w-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Importation réussie</h2>
                    <p className="mt-2 text-gray-600 dark:text-zinc-400">Vos contacts ont été ajoutés et peuvent maintenant être analysés.</p>
                    <button
                        onClick={() => navigate('/wa/contacts')}
                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                        Retourner aux contacts
                    </button>
                </div>
            )}
        </div>
    );
}
