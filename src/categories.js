export const CATEGORIES = [
  { id: 'personal', en: 'Personal', es: 'Personal', className: 'lav-cat-personal' },
  { id: 'school', en: 'School', es: 'Escuela', className: 'lav-cat-school' },
  { id: 'work', en: 'Work', es: 'Trabajo', className: 'lav-cat-work' },
  { id: 'health', en: 'Health', es: 'Salud', className: 'lav-cat-health' },
  { id: 'other', en: 'Other', es: 'Otro', className: 'lav-cat-other' },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
