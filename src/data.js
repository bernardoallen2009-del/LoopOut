export const appOptions = [
  { id: 'tiktok', name: 'TikTok', category: 'Short video', glyph: 'Tk', tone: '#111827' },
  { id: 'instagram', name: 'Instagram', category: 'Social', glyph: 'Ig', tone: '#F0447A' },
  { id: 'youtube', name: 'YouTube Shorts', category: 'Short video', glyph: 'Yt', tone: '#FF2D2D' },
  { id: 'snapchat', name: 'Snapchat', category: 'Messaging', glyph: 'Sc', tone: '#FACC15' },
  { id: 'x', name: 'X', category: 'News feed', glyph: 'X', tone: '#0B1220' },
  { id: 'netflix', name: 'Netflix', category: 'Streaming', glyph: 'Nf', tone: '#E50914' },
  { id: 'discord', name: 'Discord', category: 'Community', glyph: 'Dc', tone: '#5865F2' },
  { id: 'games', name: 'Games', category: 'Entertainment', glyph: 'Gm', tone: '#22C55E' },
  { id: 'custom', name: 'Custom app', category: 'Your choice', glyph: '+', tone: '#007AFF' },
];

export const purposeExamples = [
  'Reply to one message',
  'Post a story',
  'Check a specific update',
  'Relax for 10 minutes',
];

export const quickTimers = [5, 10, 15, 20];
export const lockDurations = [15, 30, 45, 60];

export const onboardingSlides = [
  {
    title: 'Use your apps with intention.',
    text: "Before opening a distracting app, LoopOut asks why you're opening it.",
  },
  {
    title: 'Set a clear limit.',
    text: 'Choose how long you want to use the app before the timer starts.',
  },
  {
    title: 'Go offline together.',
    text: 'When your time ends, see which friends are also offline and meet in phone-free places.',
  },
  {
    title: 'Connect with iPhone Automations.',
    text: 'Use Shortcuts to open LoopOut whenever you open distracting apps.',
  },
];

export const demoFriends = [
  {
    id: 'tomas',
    name: 'Tomas',
    avatar: 'T',
    status: 'Offline for 18 min',
    lockedApp: 'Instagram locked',
    area: 'Campo Grande',
    available: true,
    school: 'Nova SBE',
  },
  {
    id: 'maria',
    name: 'Maria',
    avatar: 'M',
    status: 'Offline for 31 min',
    lockedApp: 'TikTok locked',
    area: 'Saldanha',
    available: true,
    school: 'IST',
  },
  {
    id: 'francisco',
    name: 'Francisco',
    avatar: 'F',
    status: 'Available now',
    lockedApp: 'YouTube locked',
    area: 'Chiado',
    available: true,
    school: 'Universidade de Lisboa',
  },
  {
    id: 'ines',
    name: 'Ines',
    avatar: 'I',
    status: 'Offline today',
    lockedApp: 'Snapchat locked',
    area: 'Alvalade',
    available: false,
    school: 'Catolica',
  },
  {
    id: 'duarte',
    name: 'Duarte',
    avatar: 'D',
    status: 'Near Campo Grande',
    lockedApp: 'Discord locked',
    area: 'Campo Grande',
    available: false,
    school: 'Universidade de Lisboa',
  },
  {
    id: 'leonor',
    name: 'Leonor',
    avatar: 'L',
    status: 'Available in 15 min',
    lockedApp: 'X locked',
    area: 'Belem',
    available: true,
    school: 'IADE',
  },
];

export const lisbonPlaces = [
  {
    id: 'galveias',
    name: 'Biblioteca Palacio Galveias',
    type: 'Libraries',
    area: 'Campo Pequeno',
    description: 'A quiet library for focused study, reading and reset time.',
    activity: 'Study or read',
    suggestion: 'Put phones face down for 45 minutes.',
    score: 5,
  },
  {
    id: 'marvila',
    name: 'Biblioteca de Marvila',
    type: 'Libraries',
    area: 'Marvila',
    description: 'A generous study space with calm corners for group focus.',
    activity: 'Study together',
    suggestion: 'Use this as a quiet focus zone.',
    score: 4,
  },
  {
    id: 'alcantara',
    name: 'Biblioteca de Alcantara',
    type: 'Libraries',
    area: 'Alcantara',
    description: 'A practical meeting point for project work and reading.',
    activity: 'Study or project work',
    suggestion: 'Meet for a distraction-free work session.',
    score: 4,
  },
  {
    id: 'gulbenkian',
    name: 'Fundacao Calouste Gulbenkian Gardens',
    type: 'Parks & gardens',
    area: 'Praca de Espanha / Sao Sebastiao',
    description: 'A peaceful garden loop for short walks and deeper talks.',
    activity: 'Walk and talk',
    suggestion: 'Go for a 30-minute walk without phones.',
    score: 5,
  },
  {
    id: 'estrela',
    name: 'Jardim da Estrela',
    type: 'Parks & gardens',
    area: 'Estrela',
    description: 'A relaxed outdoor place to meet friends after class.',
    activity: 'Meet friends',
    suggestion: 'Talk, walk, sit outside.',
    score: 4,
  },
  {
    id: 'eduardo',
    name: 'Parque Eduardo VII',
    type: 'Parks & gardens',
    area: 'Marques de Pombal',
    description: 'Open space, long views and easy movement through the city.',
    activity: 'Walk',
    suggestion: 'Replace scrolling with movement.',
    score: 4,
  },
  {
    id: 'campo-grande',
    name: 'Jardim do Campo Grande',
    type: 'Parks & gardens',
    area: 'Campo Grande',
    description: 'A student-friendly meeting spot near university areas.',
    activity: 'Meet near school/university areas',
    suggestion: 'Good for students in Lisbon.',
    score: 4,
  },
  {
    id: 'ccb',
    name: 'CCB / Belem area',
    type: 'Cultural spaces',
    area: 'Belem',
    description: 'A clean cultural route for a slow walk and conversation.',
    activity: 'Walk, talk, culture',
    suggestion: 'Explore without scrolling.',
    score: 5,
  },
];

export const setupSteps = [
  'Open the Shortcuts app on iPhone.',
  'Go to Automation.',
  'Create a new personal automation.',
  'Choose App as the trigger.',
  'Select distracting apps like TikTok, Instagram or YouTube.',
  'Choose When opened.',
  'Add an action to open a URL.',
  'Paste the LoopOut website URL.',
  'Set it to run immediately if available.',
  'Now LoopOut opens first and asks for purpose and timer.',
];

export const weeklySaved = [18, 24, 12, 35, 22, 42, 27];
export const sessionsByApp = [
  { label: 'Instagram', value: 38 },
  { label: 'TikTok', value: 25 },
  { label: 'YouTube', value: 18 },
  { label: 'X', value: 10 },
];
