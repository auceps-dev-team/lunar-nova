import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import useAppStore from '../store';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';


const Profile = () => {
    const { t } = useTranslation();
    const userProfile = useAppStore(state => state.userProfile) || {};
    const updateUserProfile = useAppStore(state => state.updateUserProfile);
    const logoutUser = useAppStore(state => state.logoutUser);

    const [loginForm, setLoginForm] = useState({ email: '', password: '' });

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

    const navigate = useNavigate();

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const handleEmailSubmit = (e) => {
        e.preventDefault();
        setAuthLoading(true);
        // Simulation d'une vérification d'email et mot de passe (1 seconde)
        setTimeout(() => {
            updateUserProfile({
                isAuthenticated: true,
                authMethod: 'email',
                email: loginForm.email
            });

            setProfileForm(prev => ({
                ...prev,
                email: loginForm.email
            }));
            setAuthLoading(false);
        }, 1000);
    };

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

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await res.json();

                updateUserProfile({
                    isAuthenticated: true,
                    authMethod: 'google',
                    email: userInfo.email,
                    firstName: userInfo.given_name || userProfile.firstName,
                    lastName: userInfo.family_name || userProfile.lastName,
                });

                setProfileForm(prev => ({
                    ...prev,
                    email: userInfo.email,
                    firstName: userInfo.given_name || prev.firstName,
                    lastName: userInfo.family_name || prev.lastName,
                }));
            } catch (error) {
                console.error("Failed to fetch Google user info:", error);
                alert(t('errorGoogleProfile'));
            }
        },
        onError: (error) => console.error('Google Login Failed', error)
    });

    const [authLoading, setAuthLoading] = useState(false);

    const handleNativeGoogleLogin = async () => {
        // If not in Electron, use standard @react-oauth/google popup
        if (!window.electronAPI || !window.electronAPI.openExternalUrl) {
            return loginWithGoogle();
        }

        const stateId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        // Remplace import.meta pour éviter les erreurs de compilation dans l'environnement
        const clientId = "VITE_GOOGLE_CLIENT_ID_PLACEHOLDER";
        const redirectUri = API_BASE_URL + '/api/auth/google/callback';
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile&state=${stateId}&prompt=select_account`;

        setAuthLoading(true);
        // Open default browser via Electron main process
        await window.electronAPI.openExternalUrl(url);

        // Poll backend for the OAuth result
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/google/status?session_id=${stateId}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.status === 'success' && data.data) {
                    clearInterval(pollInterval);
                    const userInfo = data.data;

                    updateUserProfile({
                        isAuthenticated: true,
                        authMethod: 'google',
                        email: userInfo.email,
                        firstName: userInfo.given_name || userProfile.firstName,
                        lastName: userInfo.family_name || userProfile.lastName,
                    });

                    setProfileForm(prev => ({
                        ...prev,
                        email: userInfo.email,
                        firstName: userInfo.given_name || prev.firstName,
                        lastName: userInfo.family_name || prev.lastName,
                    }));
                    setAuthLoading(false);
                }
            } catch (err) {
                console.error("Auth Polling error", err);
            }
        }, 3000);

        // Stop polling after 3 minutes to avoid infinite loops
        setTimeout(() => {
            clearInterval(pollInterval);
            setAuthLoading(false);
        }, 180000);
    };

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

    if (!userProfile.isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-md mx-auto">
                <div className="bg-white p-8 rounded-xl shadow-card border border-gray-100 w-full">
                    <div className="text-center mb-8">
                        <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">{t('signInToAccount')}</h2>
                        <p className="text-sm text-gray-500 mt-2">{t('accessWorkspacePreferences')}</p>
                    </div>

                    <button
                        onClick={handleNativeGoogleLogin}
                        disabled={authLoading}
                        className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-50 transition-colors mb-6 disabled:opacity-75 disabled:cursor-wait"
                    >
                        {authLoading ? (
                            <span className="size-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {authLoading ? t('openingBrowser') : t('continueWithGoogle')}
                    </button>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors underline-offset-4 hover:underline"
                        >
                            {t('continueWithoutSignIn')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t('userAccountSpace')}</h1>
                    <p className="text-gray-500 text-sm mt-1">{t('managePersonalBusinessDetails')}</p>
                </div>
                <button
                    onClick={logoutUser}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    {t('signOut')}
                </button>
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
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all bg-gray-50"
                                    readOnly={userProfile.authMethod === 'google'}
                                />
                                {userProfile.authMethod === 'google' && (
                                    <p className="text-xs text-gray-500 mt-1">{t('managedByGoogleAccount')}</p>
                                )}
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
