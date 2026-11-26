// Contact data transcribed from the two business posters supplied by the owner.
export const company = {
  name: 'Shree Sudhya',
  phone: '+917075577737',
  alternatePhone: '+917396777470',
  phoneDisplay: '70755 77737',
  alternatePhoneDisplay: '73967 77470',
  whatsapp: '917075577737',
  whatsappUrl: 'https://wa.me/message/74YQLIO236XGC1?src=qr',
  email: 'ss.laundryservices.tpt@gmail.com',
  address: 'Tirupati, Andhra Pradesh',
  hours: '', locations: 'Tirupati', siteUrl: '',
  // Owner-supplied Google Maps listing, resolved to the pin coordinates.
  mapUrl: 'https://maps.app.goo.gl/7VLbVzc1y3VRUAyP7',
  mapCoordinates: '13.6449346,79.449206',
};
export const services = [
  { name: 'Hotels & Hostels', detail: 'Bed sheets, pillowcases and bath towels.', description: 'Plan laundry around room turnover, occupancy and the linen your housekeeping team uses most.', icon: 'wash', tag: 'ACCOMMODATION' },
  { name: 'Restaurants & Catering', detail: 'Table linen, napkins, aprons and kitchen uniforms.', description: 'Discuss your service days and peak periods so collection and return can fit around your kitchen.', icon: 'sparkle', tag: 'FOOD SERVICE' },
  { name: 'Salons & Spas', detail: 'Treatment towels, robes and reusable linens.', description: 'Share your towel usage and appointment patterns to plan how often you need a fresh supply.', icon: 'leaf', tag: 'PERSONAL CARE BUSINESSES' },
  { name: 'Offices & Workwear', detail: 'Staff uniforms and other reusable workplace textiles.', description: 'Tell us what your team wears and how you want finished items sorted and returned.', icon: 'shirt', tag: 'WORKPLACE' },
  { name: 'Ironing & Folding', detail: 'Finishing for business linen and uniforms.', description: 'Choose the finish that fits how your team stores, presents or issues each item.', icon: 'wind', tag: 'FINISHING' },
  { name: 'Pickup & Delivery', detail: 'Collection and return for Tirupati businesses.', description: 'Share your site address, estimated load and preferred days so we can confirm scheduling options.', icon: 'truck', tag: 'COLLECTION & RETURN' },
] as const;
export type BusinessService = (typeof services)[number]['name'];
