export type Card = {
  id: number;
  title: string;
  description?: string;
  tags?: string[];
  links?: {
    text: string
    url: string
    icon: string
  }[]
};