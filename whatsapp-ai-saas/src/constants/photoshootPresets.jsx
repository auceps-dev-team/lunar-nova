/**
 * Données statiques du Studio Photo (extrait de src/pages/PhotoShoot.jsx lors du
 * refactor de découpage — aucun changement de comportement).
 */

export const MODELS = [
    { id: 'ethan', name: 'Ethan', gender: 'Male', desc: 'Athletic build, short dark hair, strong jawline, chiseled features', img: './assets/models/ethan.png' },
    { id: 'mia', name: 'Mia', gender: 'Female', desc: 'Slim, blonde bob hair, blue eyes, fair skin, classic elegance', img: './assets/models/mia.jpg' },
    { id: 'sophie', name: 'Sophie', gender: 'Female', desc: 'Tan olive skin, dark hair pulled back, strong features, warm tones', img: './assets/models/sophie.jpg' },
    { id: 'ella', name: 'Ella', gender: 'Female', desc: 'Dark brown skin, natural afro-textured hair, elegant and radiant', img: './assets/models/ella.jpg' },
    { id: 'olivia', name: 'Olivia', gender: 'Female', desc: 'Auburn hair pulled back, light freckles, blue eyes, natural beauty', img: './assets/models/olivia.png' },
    { id: 'chloe', name: 'Chloe', gender: 'Female', desc: 'East Asian features, long black hair with bangs, porcelain skin', img: './assets/models/chloe.jpg' },
    { id: 'emma', name: 'Emma', gender: 'Female', desc: 'Short brown hair, freckles, blue-green eyes, modern European look', img: './assets/models/emma.jpg' },
    { id: 'lucas', name: 'Lucas', gender: 'Male', desc: 'Mature, salt-and-pepper hair, trimmed beard, blue eyes, distinguished', img: './assets/models/lucas.jpg' },
    { id: 'liam', name: 'Liam', gender: 'Male', desc: 'Young, blonde wavy hair, fair skin, youthful look', img: './assets/models/liam.jpg' },
    { id: 'noah', name: 'Noah', gender: 'Male', desc: 'Dark brown skin, short curly afro hair, strong build, confident', img: './assets/models/noah.jpg' },
    { id: 'oliver', name: 'Oliver', gender: 'Male', desc: 'East Asian features, slicked-back dark hair, sharp jawline, lean build', img: './assets/models/oliver.jpg' },
];

export const POSES = [
    { id: 'standing_pockets', name: 'Standing, hands in pockets', desc: 'Relaxed standing pose with both hands in pockets', img: './assets/poses/standing_pockets.jpg' },
    { id: 'hands_back', name: 'Hands in pockets', desc: 'Standing with both hands casually in front pockets', img: './assets/poses/hands_in_pockets.jpg' },
    { id: 'sitting_stool', name: 'Sitting on stool', desc: 'Sitting casually on a high stool, legs crossed', img: './assets/poses/sitting_stool.jpg' },
    { id: 'neutral_standing', name: 'Neutral standing', desc: 'Relaxed neutral standing, arms at sides, face forward', img: './assets/poses/neutral_standing.jpg' },
    { id: 'walking', name: 'Walking forward', desc: 'Dynamic walking pose, mid-stride, natural movement', img: './assets/poses/walking.jpg' },
    { id: 'side_profile', name: 'Side profile', desc: 'Elegant side profile view, standing straight', img: './assets/poses/side_profile.jpg' },
    { id: 'arms_crossed', name: 'Arms crossed', desc: 'Confident standing pose with arms crossed over chest', img: './assets/poses/arms_crossed.jpg' },
    { id: 'natural', name: 'Natural', desc: 'Natural relaxed pose, one hand in pocket, looking at camera', img: './assets/poses/natural.jpg' },
    { id: 'spinning', name: 'Spinning / twist', desc: 'Dynamic spinning pose with hair flowing, arms outstretched', img: './assets/poses/spinning.jpg' },
    { id: 'kneeling', name: 'Kneeling', desc: 'Kneeling on the ground, arms crossed, editorial pose', img: './assets/poses/kneeling.jpg' },
    { id: 'adjusting_hair', name: 'Adjusting hair', desc: 'Both hands adjusting hair, arms up, relaxed expression', img: './assets/poses/adjusting_hair.jpg' },
    { id: 'neutral_arms_down', name: 'Neutral, arms down', desc: 'Relaxed full-body standing, arms naturally at sides', img: './assets/poses/neutral_arms_down.jpg' },
];

export const BACKGROUNDS = [
    { id: 'studio_white', name: 'Studio White', category: 'studio', desc: 'Clean pure white cyclorama studio background', img: './assets/backgrounds/studio_white.png' },
    { id: 'studio_dark', name: 'Studio Dark', category: 'studio', desc: 'Deep dark moody studio with dramatic shadows', img: './assets/backgrounds/studio_dark.jpg' },
    { id: 'studio_red', name: 'Studio Red', category: 'studio', desc: 'Rich deep red velvet studio with dramatic spotlight and warm tones', img: './assets/backgrounds/studio_red.jpg' },
    { id: 'beach', name: 'Beach', category: 'outdoor', desc: 'Golden hour beach cabana with soft warm light and sand', img: './assets/backgrounds/beach.jpg' },
    { id: 'urban', name: 'NYC', category: 'city', desc: 'New York City street with yellow taxi and brownstone buildings', img: './assets/backgrounds/nyc.jpg' },
    { id: 'european_city', name: 'European City', category: 'city', desc: 'Parisian cobblestone street with classic Haussmann architecture and terrace', img: './assets/backgrounds/european_city.jpg' },
    { id: 'cozy', name: 'Cozy Studio', category: 'studio', desc: 'Warm studio interior with herringbone floor, stool, and natural sunlight', img: './assets/backgrounds/cozy.jpg' },
    { id: 'shadow', name: 'Shadow', category: 'studio', desc: 'Warm sandy wall with dramatic diagonal light and shadow play', img: './assets/backgrounds/shadow.jpg' },
    { id: 'leaf_shadow', name: 'Leaf Shadow', category: 'outdoor', desc: 'Warm terracotta wall with organic leaf shadow patterns', img: './assets/backgrounds/leaf_shadow.jpg' },
    { id: 'minimal', name: 'Minimalist', category: 'studio', desc: 'Dark navy gradient studio with smooth floor and soft ambient light', img: './assets/backgrounds/minimalist.jpg' },
    { id: 'floral', name: 'Floral Garden', category: 'outdoor', desc: 'Enchanted floral garden with wisteria, roses, and dreamy fabrics', img: './assets/backgrounds/floral.jpg' },
];

// ── Color helpers for the category badges ──
export const CATEGORY_COLORS = {
    studio: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    outdoor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    city: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Male: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Female: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

export const getModelInitials = (name) => name.slice(0, 2).toUpperCase();

export const getPoseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="4" r="2"></circle>
        <path d="M12 6v6m-4 4l4-4 4 4m-8-6l-2 6m10-6l2 6"></path>
    </svg>
);
