import React, { useState } from 'react';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';


const Profile = () => {
    const { t } = useTranslation();
    const userProfile = useAppStore(state => state.userProfile) || {};
    const updateUserProfile = useAppStore(state => state.updateUserProfile);


    // Form state for profile details
    const [profileForm, setProfileForm] = useState({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        companyName: userProfile.companyName || '',
        address: userProfile.address || '',
        profilePicture: userProfile.profilePicture || '',
        companyLogo: userProfile.companyLogo || ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    // Un handler de connexion par e-mail existait ici, rattaché à aucun
    // formulaire. Il marquait l'utilisateur comme authentifié après un délai d'une
    // seconde, sans vérifier ni l'adresse ni le mot de passe — son propre
    // commentaire parlait de « simulation ». Retiré : du code mort qui serait
    // devenu un contournement d'authentification si quelqu'un l'avait rebranché.
    // Une vraie connexion par e-mail demande une vérification côté serveur.

    const handleImageUpload = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileForm(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    // La connexion Google a été retirée (pour l'instant, décision du
    // 26/11/2026). Dans cette application de bureau, elle ne servait qu'à
    // pré-remplir le nom et l'adresse : le profil se renseigne désormais
    // directement, sans écran de connexion préalable.

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            updateUserProfile(profileForm);
            setIsSaving(false);
            setSaveMessage(t('profileSavedSuccess'));
            setTimeout(() => setSaveMessage(''), 3000);
        }, 800);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfileForm(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('userAccountSpace')}</h1>
                    <p className="text-gray-500 text-sm mt-1">{t('managePersonalBusinessDetails')}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
                <div className="p-6 sm:p-8">
                    <form onSubmit={handleProfileSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div className="md:col-span-2 pb-4 border-b border-gray-100 mb-2">
                                <h3 className="text-lg font-medium text-gray-900">{t('personalInformation')}</h3>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('profilePicture')}</label>
                                <div className="flex items-center gap-4">
                                    <div className="size-16 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {profileForm.profilePicture ? (
                                            <img src={profileForm.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={(e) => handleImageUpload(e, 'profilePicture')}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                                        id="profilePictureUpload"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstNameLabel')}</label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={profileForm.firstName}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder={t('firstNamePlaceholder')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastNameLabel')}</label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={profileForm.lastName}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder={t('lastNamePlaceholder')}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailAddress')}</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={profileForm.email}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneNumber')}</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={profileForm.phone}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder={t('phonePlaceholder')}
                                />
                            </div>

                            <div className="md:col-span-2 pb-4 border-b border-gray-100 mt-6 mb-2">
                                <h3 className="text-lg font-medium text-gray-900">{t('businessDetails')}</h3>
                                <p className="text-sm text-gray-500">{t('infoAutoFillInvoice')}</p>
                            </div>

                            <div className="md:col-span-2 mt-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('companyLogo')}</label>
                                <div className="flex items-center gap-4">
                                    <div className="w-24 h-16 rounded bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 p-1">
                                        {profileForm.companyLogo ? (
                                            <img src={profileForm.companyLogo} alt="Logo" className="w-full h-full object-contain" />
                                        ) : (
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={(e) => handleImageUpload(e, 'companyLogo')}
                                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                                        id="companyLogoUpload"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyName')}</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={profileForm.companyName}
                                    onChange={handleChange}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                                    placeholder={t('acmeCorp')}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('businessAddressLabel')}</label>
                                <textarea
                                    name="address"
                                    value={profileForm.address}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all resize-none"
                                    placeholder={t('placeholderAddress')}
                                ></textarea>
                            </div>

                        </div>

                        <div className="mt-8 flex items-center justify-end gap-4 pt-6 border-t border-gray-100">
                            {saveMessage && (
                                <span className="text-sm font-medium text-primary flex items-center gap-1.5">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    {saveMessage}
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="bg-primary text-white font-medium rounded-lg px-6 py-2.5 hover:bg-primary-dark transition-colors flex items-center gap-2 min-w-[120px] justify-center"
                            >
                                {isSaving ? (
                                    <>
                                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        {t('saving')}
                                    </>
                                ) : t('saveChanges')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
