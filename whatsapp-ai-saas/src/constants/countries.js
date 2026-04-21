export const COUNTRIES = [
    { value: '+225', label: '🇨🇮 Côte d\'Ivoire (+225)', code: 'CI' },
    { value: '+221', label: '🇸🇳 Sénégal (+221)', code: 'SN' },
    { value: '+223', label: '🇲🇱 Mali (+223)', code: 'ML' },
    { value: '+229', label: '🇧🇯 Bénin (+229)', code: 'BJ' },
    { value: '+226', label: '🇧🇫 Burkina Faso (+226)', code: 'BF' },
    { value: '+228', label: '🇹🇬 Togo (+228)', code: 'TG' },
    { value: '+224', label: '🇬🇳 Guinée (+224)', code: 'GN' },
    { value: '+237', label: '🇨🇲 Cameroun (+237)', code: 'CM' },
    { value: '+241', label: '🇬🇦 Gabon (+241)', code: 'GA' },
    { value: '+242', label: '🇨🇬 Congo (+242)', code: 'CG' },
    { value: '+243', label: '🇨🇩 RDC (+243)', code: 'CD' },
    { value: '+222', label: '🇲🇷 Mauritanie (+222)', code: 'MR' },
    { value: '+212', label: '🇲🇦 Maroc (+212)', code: 'MA' },
    { value: '+213', label: '🇩🇿 Algérie (+213)', code: 'DZ' },
    { value: '+216', label: '🇹🇳 Tunisie (+216)', code: 'TN' },
    { value: '+33',  label: '🇫🇷 France (+33)', code: 'FR' },
    { value: '+32',  label: '🇧🇪 Belgique (+32)', code: 'BE' },
    { value: '+41',  label: '🇨🇭 Suisse (+41)', code: 'CH' },
    { value: '+1',   label: '🇺🇸/🇨🇦 USA/Canada (+1)', code: 'US' },
];

export const getCountryByValue = (val) => COUNTRIES.find(c => c.value === val);
export const getCountryByIndicator = (indicator) => COUNTRIES.find(c => indicator.startsWith(c.value));
