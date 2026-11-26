> Workspace update: public website source/assets/scripts now live under `apps/marketing/`. Relative source paths below refer to that workspace. For the new internal application, see `docs/implementation-status.md`.

# Contact section update

Only the contact section, shared contact data, footer contact lines and related export assertions were changed. Home, About, services, process, gallery, logo and global theme styles are preserved.

## Poster data

- Primary phone: +91 70755 77737 (both supplied posters).
- Additional phone: +91 73967 77470 (second poster).
- Email: ss.laundryservices.tpt@gmail.com (both).
- City: Tirupati, Andhra Pradesh (both).
- WhatsApp QR, decoded locally from the second poster: https://wa.me/message/74YQLIO236XGC1?src=qr . The direct chat button uses this exact destination.
- The first poster's location QR could not be reliably decoded. No street address, coordinates, map pin or opening hours were invented. The owner later supplied the Google Maps listing. The contact map and directions now use its confirmed pin. The published city label remains Tirupati, Andhra Pradesh.

## Form behaviour

The static-export application has no submission API or mailbox backend. The form validates name, phone, optional email and message, then prepares an encoded WhatsApp enquiry addressed to the poster's primary number. The customer must review and send it in WhatsApp. There is no false sent confirmation, database storage or server submission. The separate QR-based WhatsApp chat link remains available.

## Visual and accessibility

Form left, location card right on desktop; stacked on tablet/mobile. All animation is isolated in ContactSection.module.css and disabled for reduced motion. The location preview uses a perspective map plane and softly floating pin; it is decorative, not an exact geographic map. Labels, required markers, autocomplete, native validation, focus outlines, 16px mobile input text and status text are included. Footer links expose both phone numbers and the email. No message is automatically sent.

Run npm run check for lint, production build, types, cycle/layout/export tests and contact-data assertions. Browser interaction/visual confirmation remains subject to the previously recorded browser URL-policy limitation.

## Compact contact and location refinement

Reduced desktop heading to one line, contact-strip height, form/card padding, field gaps and message area height. Short desktops use a compact variant while preserving 44px inputs/buttons and natural document overflow when the window is too small. Replaced the oversized perspective street blocks with a contained SVG location illustration and a clearly labelled city-overview link to Google Maps for Tirupati. This does not claim exact business coordinates. Form validation, poster contacts, decoded business WhatsApp link and all other website sections remain unchanged.
