export type Quality = 'high' | 'low'
export interface VideoSet {
  title: string
  qualitySet: Quality[]
  canRotate: boolean
  hasLowMotion: boolean
}

export const videoSet: VideoSet[] = [{
  title: 'wave',
  qualitySet: ['high', 'low'],
  canRotate: false,
  hasLowMotion: true
},{
  title: 'visual-1',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'visual-2',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'visual-3',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'visual-4',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'visual-5',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'visual-6',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: false
},{
  title: 'hex',
  qualitySet: ['high', 'low'],
  canRotate: true,
  hasLowMotion: true
}]