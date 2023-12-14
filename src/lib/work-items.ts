export interface WorkItem {
  id: number
  title: string
  description: string
  imageUrl: string
  company: string
  tags: string[]
}

const WORK_ITEMS: WorkItem[] = [{
  id: 0,
  title: 'NLZIET',
  description: 'Als SmartTV developer heb ik aan de app van NLZIET mogen werken. Met gebruik van web-technologieën zoals Svelte en Typescript heb ik een app ontwikkeld die op verschillende SmartTV\'s draait. Naast toffe features zoals chapters en een nieuwe zoekfunctionaliteit heb ik ook veel ervaring opgedaan met Google Analytics en streaming analytics.',
  imageUrl: 'nlziet.jpg',
  tags: ['Svelte', 'SmartTV', 'Video streaming'],
  company: "Triple"
}, {
  id: 1,
  title: 'NOS',
  description: '',
  imageUrl: 'nos.webp',
  tags: ['Svelte', 'SmartTV', 'Video streaming'],
  company: "Triple"
}, {
  id: 2,
  title: 'AJAX Webshop',
  description: 'Als onderdeel van mijn stage bij Triple heb ik mee mogen developen aan de webshop van Ajax. Daarbij heb ik kennis gemaakt met React en Typescript. Ik heb een half jaar meegedraaid op dit project waarbij ik heb geleerd om te werken in een framework en in een multidisciplinair team.',
  imageUrl: 'ajax.jpg',
  tags: ['React', 'TypeScript', 'Webshop'],
  company: "Triple"
}]

export default WORK_ITEMS