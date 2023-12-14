import type { Card } from "./typing";

export const socialLinks = [
  {text: 'CV', url: 'https://read.cv/rg', icon: 'cv'},
  {text: 'LinkedIn', url: 'https://www.linkedin.com/in/r-groot/', icon: 'linkedin'},
  {text: 'GitHub', url: 'https://github.com/RickGroot', icon: 'github'},
  {text: 'E-mail', url: "mailto:RickGroot41@gmail.com", icon: 'mail'}
]

export const cards: {[key: string]: Card} = {
  name: {
    id: 1, title: 'Rick Groot', description: 'Creative front-end developer'
  },
  hobbies: {
    id: 2, title: 'Hobbies', tags: ['Playing trumpet', 'Photography', 'Gaming']
  },
  skills: {
    id: 3,
    title: 'My Skills',
    tags: ['HTML', '(S)CSS', 'JavaScript', 'TypeScript', 'Svelte(kit)', 'React', 'Git']
  },
  contact: {
    id: 4, title: 'Contact', description: 'Feel free to reach out to me',
    links: socialLinks  
  }
}