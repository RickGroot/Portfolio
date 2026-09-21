export interface WorkItem {
  id: number
  title: string
  description: string
  imageUrl: string
  company: string
  tags: string[]
  color?: string
}

const WORK_ITEMS: WorkItem[] = [{
  id: 0,
  title: 'NLZIET',
  description: 'As a Connected TV developer, I contributed to the NLZIET app using modern web technologies like Svelte and TypeScript. I built an application that runs smoothly across various Smart TV platforms. My work included features like chapters, an improved search experience, and building/integrating the Bitmovin video player. I also gained valuable experience implementing Google Analytics and Conviva streaming and app analytics.',
  imageUrl: 'nlziet.jpg',
  tags: ['Svelte', 'Connected TV', 'Bitmovin player'],
  company: "Triple",
  color: "#ff145b"
}, {
  id: 4,
  title: 'ChromeCast',
  description: 'For multiple projects, I developed custom Chromecast receivers that enable streaming content from mobile devices to the TV. To streamline this process, I created a boilerplate in TypeScript, providing a solid foundation for media playback, error handling, and integration with the Cast SDK. The result: faster development, less repetitive code, and more consistency across projects.',
  imageUrl: 'chromecast.jpg',
  tags: ['JavaScript', 'ChromeCast', 'Shaka player'],
  company: "Triple",
  color: "#2c2c2c"
}, {
  id: 2,
  title: 'KIJK',
  description: 'As a Connected TV TV developer, I worked on the KIJK streaming platform, building a seamless and responsive app experience across multiple Smart TV brands. Using technologies like Svelte, TypeScript and THEOplayer, I helped implement key features such as user-friendly UI, video playback and advertisement integrations.',
  imageUrl: 'kijk.png',
  tags: ['Connected TV', 'Advertisements', 'THEOplayer'],
  company: "Triple",
  color: "#431093"
}, {
  id: 1,
  title: 'NOS',
  description: 'For the Dutch broadcaster NOS, I worked on the development of their Smart TV app, with focus on building the user interface. Using Svelte, I created a well performing and maintainable UI tailored for remote control navigation. THEOplayer was integrated for seamless playback of both live and on-demand content, creating a smooth and intuitive viewing experience on the big screen.',
  imageUrl: 'nos.webp',
  tags: ['Svelte', 'Connected TV', 'Video streaming'],
  company: "Triple",
  color: "#e61e14",
}
// , {
//   id: 2,
//   title: 'AJAX Webshop',
//   description: 'Als onderdeel van mijn stage bij Triple heb ik mee mogen developen aan de webshop van Ajax. Daarbij heb ik kennis gemaakt met React en Typescript. Ik heb een half jaar meegedraaid op dit project waarbij ik heb geleerd om te werken in een framework en in een multidisciplinair team.',
//   imageUrl: 'ajax.jpg',
//   tags: ['React', 'TypeScript', 'Webshop'],
//   company: "Triple",
//   color: "#d40a2a",
// }, {
//   id: 3,
//   title: 'NHNIEUWS/AT5',
//   description: 'text',
//   imageUrl: 'nhnieuws.jpg',
//   tags: ['React', 'TypeScript', 'News provider'],
//   company: "Triple",
//   color: "#1a5ccc",
// }
]

export default WORK_ITEMS