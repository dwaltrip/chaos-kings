interface Variant {
  name: string;
  cssClass: string;
}

const VARIANTS: Variant[] = [
  { name: 'Default', cssClass: '' },
  { name: 'Dark', cssClass: 'variant-dark' },
];

export type { Variant };
export { VARIANTS };
