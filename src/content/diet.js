/** Warm, customer-facing copy for the diet tab. */
export const DIET_COPY = {
  listTitle: 'Eat for your body',
  listTitleFor: (name) => `Diet plans for ${name}`,
  listText:
    'Seasonal, dosha-balanced meal plans from Ayurvedic experts - simple to follow and kind to your body.',
  listTextFor: (name) => `Gentle, expert-made meal plans to support you with ${name}.`,
  activeTitle: 'Your active plans',
  pastTitle: 'Paused plans',
  count: (n) => `${n} ${n === 1 ? 'plan' : 'plans'} to explore`,
  emptyTitle: 'Fresh plans are on their way',
  emptyText: 'Our Ayurvedic experts are still preparing plans here. Explore all diet plans in the meantime.',
  emptySearchTitle: 'No plans match that search',
  emptySearchText: 'Try a different word, or browse every plan we have.',
  emptyActiveTitle: 'No plan in progress yet',
  emptyActiveText: 'Pick a plan that suits your body and start eating with intention today.',
  emptyPausedTitle: 'Nothing paused',
  emptyPausedText: 'Plans you pause will wait for you here.',
  loading: 'Finding plans for you…',
  browseAll: 'Browse all plans',
};