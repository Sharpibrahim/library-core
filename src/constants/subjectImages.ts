export const SUBJECT_COVERS: Record<string, string> = {
  'Mathematics': 'https://images.unsplash.com/photo-1509228468518-180dd4864904?q=80&w=800&auto=format&fit=crop',
  'Physics': 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=800&auto=format&fit=crop',
  'Chemistry': 'https://images.unsplash.com/photo-1532187875605-132938a16773?q=80&w=800&auto=format&fit=crop',
  'Biology': 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?q=80&w=800&auto=format&fit=crop',
  'History': 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?q=80&w=800&auto=format&fit=crop',
  'Geography': 'https://images.unsplash.com/photo-1521295121980-82c219451d8b?q=80&w=800&auto=format&fit=crop',
  'Economics': 'https://images.unsplash.com/photo-1611974714608-2c40c115723b?q=80&w=800&auto=format&fit=crop',
  'Literature': 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?q=80&w=800&auto=format&fit=crop',
  'Entrepreneurship': 'https://images.unsplash.com/photo-1507679799987-c73774071b9b?q=80&w=800&auto=format&fit=crop',
  'Religious Education': 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=800&auto=format&fit=crop',
  'Kiswahili': 'https://images.unsplash.com/photo-1544650039-202c6d482c11?q=80&w=800&auto=format&fit=crop',
  'Fine Art': 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=800&auto=format&fit=crop',
  'Computer Studies': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800&auto=format&fit=crop',
  'General Paper': 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32?q=80&w=800&auto=format&fit=crop'
};

export const getSubjectCover = (subject?: string): string => {
  if (!subject) return 'https://images.unsplash.com/photo-1497633762265-9a177c8098a2?q=80&w=800&auto=format&fit=crop';
  return SUBJECT_COVERS[subject] || 'https://images.unsplash.com/photo-1497633762265-9a177c8098a2?q=80&w=800&auto=format&fit=crop';
};
