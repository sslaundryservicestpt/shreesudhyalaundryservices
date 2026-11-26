export const sbhsClientName = 'SBHS Home Stays - Tiruchanoor';

// Reference amounts transcribed from the attached SBHS rate card, in rupees.
export const sbhsRates = [
  ['Single Bed Sheet', 12, 15],
  ['Double Bed Sheet', 22, 25],
  ['Single Duvet', 15, 20],
  ['Double Duvet', 27, 30],
  ['Pillow Cover', 12, 15],
  ['Bath Towel', 17, 20],
  ['Hand Towel', 7, 10],
  ['Bath Mat', 10, 15],
  ['Single Blanket', 10, 15],
  ['Double Blanket', 15, 20],
  ['Curtains', 25, 35],
  ['Sofa Cover', 7, 15],
  ['Bed Protector', 25, 30],
  ['Runner', 10, 15],
] as const;

export function referenceItemKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace('duet', 'duvet')
    .replace(/^blanketssingle$/, 'singleblanket')
    .replace(/^blanketsdouble$/, 'doubleblanket')
    .replace(/^pillowcase$/, 'pillowcover')
    .replace(/^tablerunner$/, 'runner');
}

export function isSbhsClient(name: string) {
  return name.trim().toLowerCase() === sbhsClientName.toLowerCase();
}
